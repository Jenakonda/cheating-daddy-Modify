const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { getProviderKeys, incrementCharUsage, getConfig, getDefaultContextDir, getPreferences } = require('../storage');
const { isKeyError, createKeyRing } = require('./api-keys');
const { normalizeMixedRoutes, resolveProvider, getMixedRequirements } = require('./routing');
const { loadContextFolder } = require('./context-folder');
const { createLineSplitter } = require('./sse');
const {
    DEFAULT_GEMINI_MODEL,
    DEFAULT_GEMINI_LIVE_MODEL,
    sanitizeModelId,
    buildLiveSessionOptions,
    isPermanentGeminiError,
    describeGeminiError,
    listGeminiModels,
    streamGeminiAnswer,
} = require('./gemini-models');
const { startTransportLog, logTransportEvent, closeTransportLog } = require('./transportLogger');

// Lazy-loaded to avoid circular dependency (localai.js and cliai.js import from gemini.js)
let _localai = null;
function getLocalAi() {
    if (!_localai) _localai = require('./localai');
    return _localai;
}

let _cliai = null;
function getCliAi() {
    if (!_cliai) _cliai = require('./cliai');
    return _cliai;
}

// Provider mode: 'cli', 'byok', 'local' or 'mixed' (CLI and API together)
let currentProviderMode = 'byok';
let mixedRoutes = null;

const keyRing = createKeyRing();
let streamCounter = 0;

/** The provider that serves 'voice', 'screen' or 'text' requests right now. */
function providerFor(task) {
    return resolveProvider(currentProviderMode, mixedRoutes, task);
}

function nextStreamId(prefix) {
    streamCounter += 1;
    return `${prefix}-${streamCounter}`;
}

/** In mixed mode the CLI also gets to know what the API answered. */
function shareWithCli(userText, answer) {
    if (currentProviderMode === 'mixed') {
        getCliAi().addExternalTurn(userText, answer);
    }
}

// Groq conversation history for context
let groqConversationHistory = [];

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let screenAnalysisHistory = [];
let currentProfile = null;
let currentCustomPrompt = null;
let isInitializingSession = false;
let lastInitError = '';
let lastInitKeyError = false;
let liveStream = '';
let currentSystemPrompt = null;

function formatSpeakerResults(results) {
    let text = '';
    for (const result of results) {
        if (result.transcript && result.speakerId) {
            const speakerLabel = result.speakerId === 1 ? 'Interviewer' : 'Candidate';
            text += `[${speakerLabel}]: ${result.transcript}\n`;
        }
    }
    return text;
}

module.exports.formatSpeakerResults = formatSpeakerResults;

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';
let groqRequestStartedForTurn = false;

const GROQ_MAX_COMPLETION_TOKENS = 16384;
const GROQ_EMPTY_RESPONSE_MESSAGE =
    'Groq reached the maximum completion-token limit before returning a final answer. Disable thinking in Home → AI responses and try again.';

// Reconnection variables
let isUserClosing = false;
let sessionParams = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;
// A connection that Google ends on schedule is resumed quickly, so that little audio is lost
const RESUME_DELAY = 300;
// A connection that lasted this long was healthy: its end does not count against the reconnect attempts
const STABLE_CONNECTION_MS = 30000;

function sendToRenderer(channel, ...args) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, ...args);
    }
}

// Build context message for session restoration
function buildContextMessage() {
    const lastTurns = conversationHistory.slice(-20);
    const validTurns = lastTurns.filter(turn => turn.transcription?.trim() && turn.ai_response?.trim());

    if (validTurns.length === 0) return null;

    const contextLines = validTurns.map(turn => `[Interviewer]: ${turn.transcription.trim()}\n[Your answer]: ${turn.ai_response.trim()}`);

    return `Session reconnected. Here's the conversation so far:\n\n${contextLines.join('\n\n')}\n\nContinue from here.`;
}

// Conversation management functions
function initializeNewSession(profile = null, customPrompt = null) {
    currentSessionId = Date.now().toString();
    startTransportLog(currentSessionId);
    currentTranscription = '';
    groqRequestStartedForTurn = false;
    conversationHistory = [];
    screenAnalysisHistory = [];
    groqConversationHistory = [];
    currentProfile = profile;
    currentCustomPrompt = customPrompt;
    console.log('New conversation session started:', currentSessionId, 'profile:', profile);

    // Save initial session with profile context
    if (profile) {
        sendToRenderer('save-session-context', {
            sessionId: currentSessionId,
            profile: profile,
            customPrompt: customPrompt || '',
        });
    }
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function saveScreenAnalysis(prompt, response, model) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const analysisEntry = {
        timestamp: Date.now(),
        prompt: prompt,
        response: response.trim(),
        model: model,
    };

    screenAnalysisHistory.push(analysisEntry);
    console.log('Saved screen analysis:', analysisEntry);

    // Send to renderer to save
    sendToRenderer('save-screen-analysis', {
        sessionId: currentSessionId,
        analysis: analysisEntry,
        fullHistory: screenAnalysisHistory,
        profile: currentProfile,
        customPrompt: currentCustomPrompt,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

function getEnabledTools() {
    const tools = [];
    if (getPreferences().googleSearchEnabled === true) {
        tools.push({ googleSearch: {} });
    }
    console.log('Google Search enabled:', tools.length > 0);
    return tools;
}

// helper to check if groq has been configured
function hasGroqKey() {
    return getProviderKeys('groq').length > 0;
}

/** Calls Groq, moving to a backup key when one is rate-limited or rejected. */
async function requestGroq(body) {
    try {
        return await keyRing.run(
            'groq',
            getProviderKeys('groq'),
            async key => {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${key}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                if ([401, 403, 429].includes(response.status)) {
                    throw Object.assign(new Error(`Groq error: ${response.status}`), { status: response.status, response });
                }
                return response;
            },
            index => sendToRenderer('update-status', `Switching to Groq key ${index + 1}...`)
        );
    } catch (error) {
        // Every key was refused: the caller reports the last response like any other HTTP error
        if (error.response) return error.response;
        throw error;
    }
}

function sendFinalTranscriptionToGroq() {
    if (!hasGroqKey() || groqRequestStartedForTurn) {
        return;
    }

    const transcription = currentTranscription.trim();
    if (transcription === '') {
        return;
    }

    groqRequestStartedForTurn = true;
    sendToGroq(transcription);
}

function stripThinkingTags(text) {
    const trimmedStart = text.trimStart();
    if ('<think>'.startsWith(trimmedStart)) {
        return '';
    }

    return text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
}

function getGroqReasoningOptions(model, disableThinking) {
    if (model.includes('qwen3')) {
        const options = {
            reasoning_format: 'hidden',
        };

        if (disableThinking) {
            options.reasoning_effort = 'none';
        }

        return options;
    }

    if (model.startsWith('openai/gpt-oss-')) {
        return {
            include_reasoning: false,
        };
    }

    return {};
}

async function sendToGroq(transcription) {
    if (!hasGroqKey()) {
        console.log('No Groq API key configured, skipping Groq response');
        return;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Groq');
        return;
    }

    const config = getConfig();
    const modelToUse = config.groqModel;

    console.log(`Sending to Groq (${modelToUse}):`, transcription.substring(0, 100) + '...');
    logTransportEvent('groq.text.request', {
        model: modelToUse,
        transcription,
    });

    groqConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    if (groqConversationHistory.length > 20) {
        groqConversationHistory = groqConversationHistory.slice(-20);
    }

    try {
        const response = await requestGroq({
            model: modelToUse,
            messages: [{ role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' }, ...groqConversationHistory],
            stream: true,
            temperature: 0.7,
            max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
            ...getGroqReasoningOptions(modelToUse, config.disableGroqThinking),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error:', response.status, errorText);
            logTransportEvent('groq.text.http_error', {
                status: response.status,
                body: errorText,
            });
            sendToRenderer('update-status', `Groq error: ${response.status}`);
            return;
        }

        logTransportEvent('groq.text.http_response', {
            status: response.status,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const splitLines = createLineSplitter();
        let fullText = '';
        let isFirst = true;
        let finishReason = null;
        const stream = nextStreamId('groq');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            logTransportEvent('groq.text.stream_chunk', { chunk });
            const lines = splitLines(chunk);

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        logTransportEvent('groq.text.stream_event', json);
                        finishReason = json.choices?.[0]?.finish_reason || finishReason;
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullText += token;
                            const displayText = stripThinkingTags(fullText);
                            if (displayText) {
                                sendToRenderer(isFirst ? 'new-response' : 'update-response', displayText, stream);
                                isFirst = false;
                            }
                        }
                    } catch (parseError) {
                        logTransportEvent('groq.text.stream_parse_error', {
                            data,
                            error: parseError.message,
                        });
                    }
                }
            }
        }

        const cleanedResponse = stripThinkingTags(fullText);
        const modelKey = modelToUse.split('/').pop();

        const systemPromptChars = (currentSystemPrompt || 'You are a helpful assistant.').length;
        const historyChars = groqConversationHistory.reduce((sum, msg) => sum + (msg.content || '').length, 0);
        const inputChars = systemPromptChars + historyChars;
        const outputChars = cleanedResponse.length;

        incrementCharUsage('groq', modelKey, inputChars + outputChars);

        if (cleanedResponse) {
            groqConversationHistory.push({
                role: 'assistant',
                content: cleanedResponse,
            });

            saveConversationTurn(transcription, cleanedResponse);
            shareWithCli(transcription, cleanedResponse);
        } else {
            console.warn(`Groq returned no final answer (${modelToUse})`);
            logTransportEvent('groq.text.empty_response', {
                model: modelToUse,
                fullText,
                finishReason,
            });
            sendToRenderer('new-response', GROQ_EMPTY_RESPONSE_MESSAGE);
            sendToRenderer('update-status', 'Groq reached the completion-token limit');
            return;
        }

        logTransportEvent('groq.text.completed', {
            model: modelToUse,
            response: cleanedResponse,
        });
        console.log(`Groq response completed (${modelToUse})`);
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('Error calling Groq API:', error);
        logTransportEvent('groq.text.error', {
            error: error.message,
            stack: error.stack,
        });
        sendToRenderer('update-status', 'Groq error: ' + error.message);
    }
}

async function sendImageToGroq(base64Data, prompt) {
    const config = getConfig();
    const model = config.groqImageModel;

    logTransportEvent('groq.image.request', {
        model,
        prompt,
        imageBytes: Buffer.byteLength(base64Data, 'base64'),
    });

    try {
        const response = await requestGroq({
            model,
            messages: [
                { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Data}`,
                            },
                        },
                    ],
                },
            ],
            stream: true,
            temperature: 0.7,
            max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
            ...getGroqReasoningOptions(model, config.disableGroqThinking),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq image API error:', response.status, errorText);
            logTransportEvent('groq.image.http_error', {
                status: response.status,
                body: errorText,
            });
            return { success: false, error: `Groq error: ${response.status}` };
        }

        logTransportEvent('groq.image.http_response', {
            status: response.status,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const splitLines = createLineSplitter();
        let fullText = '';
        let isFirst = true;
        let finishReason = null;
        const stream = nextStreamId('groq-image');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            logTransportEvent('groq.image.stream_chunk', { chunk });
            const lines = splitLines(chunk);

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    logTransportEvent('groq.image.stream_event', json);
                    finishReason = json.choices?.[0]?.finish_reason || finishReason;
                    const token = json.choices?.[0]?.delta?.content || '';
                    if (!token) continue;

                    fullText += token;
                    const displayText = stripThinkingTags(fullText);
                    if (displayText) {
                        sendToRenderer(isFirst ? 'new-response' : 'update-response', displayText, stream);
                        isFirst = false;
                    }
                } catch (parseError) {
                    logTransportEvent('groq.image.stream_parse_error', {
                        data,
                        error: parseError.message,
                    });
                }
            }
        }

        const cleanedResponse = stripThinkingTags(fullText);
        if (!cleanedResponse) {
            logTransportEvent('groq.image.empty_response', {
                model,
                fullText,
                finishReason,
            });
            return { success: false, error: GROQ_EMPTY_RESPONSE_MESSAGE };
        }

        saveScreenAnalysis(prompt, cleanedResponse, model);
        shareWithCli(`[Screen analysis] ${prompt}`, cleanedResponse);
        logTransportEvent('groq.image.completed', {
            model,
            response: cleanedResponse,
        });
        return { success: true, text: cleanedResponse, model };
    } catch (error) {
        console.error('Error calling Groq image API:', error);
        logTransportEvent('groq.image.error', {
            error: error.message,
            stack: error.stack,
        });
        return { success: false, error: error.message };
    }
}

/**
 * The system prompts for API requests: profile, custom instructions, language and the context folder.
 * `live` may mention Google Search; `request` is for Groq and plain HTTP requests, which have no search tool.
 */
async function buildApiSystemPrompts(profile, customPrompt) {
    const prefs = getPreferences() || {};
    const responseLanguage = prefs.responseLanguage || 'auto';
    let folderContext = null;
    if (prefs.contextFolderEnabled !== false) {
        const rawFolder = prefs.contextFolderPath && String(prefs.contextFolderPath).trim() ? prefs.contextFolderPath.trim() : getDefaultContextDir();
        if (rawFolder && fs.existsSync(rawFolder)) {
            const loadedBundle = await loadContextFolder(rawFolder);
            if (loadedBundle && loadedBundle.mode !== 'empty') {
                folderContext = loadedBundle;
            }
        }
    }
    const build = search => getSystemPrompt(profile, customPrompt, search, responseLanguage, folderContext);
    return { live: build(prefs.googleSearchEnabled === true), request: build(false) };
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnect = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    if (!isReconnect) {
        sendToRenderer('session-initializing', true);
    }

    // Store params for reconnection
    if (!isReconnect) {
        isUserClosing = false;
        sessionParams = { apiKey, customPrompt, profile, language, triedKeys: new Set(), resumeHandle: '', resumption: true };
        reconnectAttempts = 0;
    }

    const liveModel = sanitizeModelId(getConfig().geminiLiveModel, DEFAULT_GEMINI_LIVE_MODEL);
    const enabledTools = getEnabledTools();
    const prompts = await buildApiSystemPrompts(profile, customPrompt);
    currentSystemPrompt = prompts.request;

    // Initialize new conversation session only on first connect
    if (!isReconnect) {
        initializeNewSession(profile, customPrompt);
    }

    // State of this one connection
    const usedHandle = sessionParams?.resumeHandle || '';
    let openedAt = 0;
    let setupDone = false;

    try {
        const liveOptions = buildLiveSessionOptions(liveModel, {
            systemPrompt: prompts.live,
            tools: enabledTools,
            resumption: sessionParams?.resumption !== false,
            resumeHandle: usedHandle,
        });
        const client = new GoogleGenAI({
            vertexai: false,
            apiKey: apiKey,
            httpOptions: { apiVersion: liveOptions.apiVersion },
        });
        const session = await client.live.connect({
            model: liveModel,
            callbacks: {
                onopen: function () {
                    openedAt = Date.now();
                    logTransportEvent('gemini.live.opened', {});
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    console.log('----------------', message);
                    logTransportEvent('gemini.live.message', message);

                    if (message.setupComplete) {
                        setupDone = true;
                    }
                    const update = message.sessionResumptionUpdate;
                    if (update?.resumable && update.newHandle && sessionParams) {
                        sessionParams.resumeHandle = update.newHandle;
                    }

                    // The key works: remember it, and allow every backup again should it fail later
                    if (message.serverContent && sessionParams) {
                        keyRing.markWorking('gemini', apiKey);
                        sessionParams.triedKeys.clear();
                    }

                    // Handle input transcription (what was spoken)
                    if (message.serverContent?.inputTranscription?.results) {
                        currentTranscription += formatSpeakerResults(message.serverContent.inputTranscription.results);
                    } else if (message.serverContent?.inputTranscription?.text) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text.trim() !== '') {
                            currentTranscription += text;
                        }
                    }

                    if (message.serverContent?.inputTranscription) {
                        sendFinalTranscriptionToGroq();
                    }

                    if (!hasGroqKey() && message.serverContent?.outputTranscription?.text) {
                        const isFirstChunk = messageBuffer === '';
                        if (isFirstChunk) liveStream = nextStreamId('live');
                        messageBuffer += message.serverContent.outputTranscription.text;
                        sendToRenderer(isFirstChunk ? 'new-response' : 'update-response', messageBuffer, liveStream);
                    }

                    // Not every model sends generationComplete, so turnComplete saves the turn too
                    if (message.serverContent?.generationComplete || message.serverContent?.turnComplete) {
                        if (currentTranscription.trim() !== '') {
                            if (!hasGroqKey() && messageBuffer.trim() !== '') {
                                saveConversationTurn(currentTranscription, messageBuffer);
                                shareWithCli(currentTranscription.trim(), messageBuffer.trim());
                            }
                            currentTranscription = '';
                        }
                        messageBuffer = '';
                    }

                    if (message.serverContent?.turnComplete) {
                        currentTranscription = '';
                        messageBuffer = '';
                        groqRequestStartedForTurn = false;
                        sendToRenderer('update-status', 'Listening...');
                    }
                },
                onerror: function (e) {
                    console.log('Session error:', e.message);
                    logTransportEvent('gemini.live.error', {
                        error: e.message,
                    });
                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.log('Session closed:', e.reason);
                    logTransportEvent('gemini.live.closed', {
                        reason: e.reason,
                    });

                    // Don't reconnect if user intentionally closed
                    if (isUserClosing) {
                        isUserClosing = false;
                        closeTransportLog();
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }

                    if (openedAt && Date.now() - openedAt >= STABLE_CONNECTION_MS) {
                        reconnectAttempts = 0;
                    }

                    // A rate-limited or rejected key: carry on with the next backup key
                    if (sessionParams && isKeyError(e.reason) && getProviderKeys('gemini').length > 1) {
                        sessionParams.triedKeys.add(apiKey);
                        const keys = getProviderKeys('gemini');
                        const next = keyRing.order('gemini', keys).find(key => !sessionParams.triedKeys.has(key));
                        if (next) {
                            sessionParams.apiKey = next;
                            // A handle belongs to the project of the key that received it
                            sessionParams.resumeHandle = '';
                            reconnectAttempts = 0;
                            sendToRenderer('update-status', `Switching to Gemini key ${keys.indexOf(next) + 1}...`);
                            attemptReconnect();
                            return;
                        }
                        sessionParams = null;
                        closeTransportLog();
                        sendToRenderer('new-response', `None of your Gemini keys worked. ${describeGeminiError(e.reason, liveModel)}`);
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }

                    // Google refused to resume (expired handle, or a model without resumption):
                    // start a fresh connection, which gets the conversation as text instead
                    const refusedResumption = !setupDone && (usedHandle || /resumption/i.test(e.reason || ''));
                    if (sessionParams && refusedResumption && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        sessionParams.resumeHandle = '';
                        if (/resumption/i.test(e.reason || '')) sessionParams.resumption = false;
                        attemptReconnect();
                        return;
                    }

                    // A retired model or a bad key fails the same way every time: say why and stop
                    if (isPermanentGeminiError(e.reason)) {
                        sessionParams = null;
                        closeTransportLog();
                        sendToRenderer('new-response', describeGeminiError(e.reason, liveModel));
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }

                    // Attempt reconnection
                    if (sessionParams && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        attemptReconnect();
                    } else {
                        if (sessionParams) giveUpReconnecting();
                        closeTransportLog();
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: liveOptions.config,
        });

        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return session;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        lastInitError = describeGeminiError(error, liveModel);
        lastInitKeyError = isKeyError(error);
        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return null;
    }
}

function giveUpReconnecting() {
    console.log('Max reconnection attempts reached');
    sendToRenderer('reconnect-failed', {
        message: 'Lost the connection to Gemini and could not restore it. Check your internet connection and start a new session.',
    });
    sessionParams = null;
}

async function attemptReconnect() {
    const params = sessionParams;
    if (!params) return false;
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    // Clear stale buffers
    messageBuffer = '';
    currentTranscription = '';
    // Don't reset groqConversationHistory to preserve context across reconnects

    sendToRenderer('update-status', `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    // Wait before attempting
    const delay = params.resumeHandle && reconnectAttempts === 1 ? RESUME_DELAY : RECONNECT_DELAY;
    await new Promise(resolve => setTimeout(resolve, delay));

    // The session may have been closed, or replaced by a new one, while waiting
    if (sessionParams !== params) return false;

    try {
        const resuming = Boolean(params.resumeHandle);
        const session = await initializeGeminiSession(
            sessionParams.apiKey,
            sessionParams.customPrompt,
            sessionParams.profile,
            sessionParams.language,
            true // isReconnect
        );

        if (session && sessionParams !== params) {
            // Closed while connecting: do not leave this connection open
            isUserClosing = true;
            await session.close();
            return false;
        }

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;

            // A resumed session still knows the conversation; a fresh one gets it as a text message
            const contextMessage = resuming ? null : buildContextMessage();
            if (contextMessage) {
                try {
                    console.log('Restoring conversation context...');
                    await session.sendRealtimeInput({ text: contextMessage });
                } catch (contextError) {
                    console.error('Failed to restore context:', contextError);
                    // Continue without context - better than failing
                }
            }

            // The attempts are reset once this connection has proved stable (see onclose)
            sendToRenderer('update-status', 'Reconnected! Listening...');
            console.log('Session reconnected successfully');
            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectAttempts} failed:`, error);
    }

    // If we still have attempts left, try again
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        return attemptReconnect();
    }

    if (sessionParams === params) giveUpReconnecting();
    return false;
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
        },
    };

    systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            if (providerFor('voice') === 'local') {
                getLocalAi().processLocalAudio(monoChunk, 'interviewer');
            } else if (providerFor('voice') === 'cli') {
                getCliAi().processCliAudio(monoChunk, 'interviewer');
            } else {
                const base64Data = monoChunk.toString('base64');
                sendAudioToGemini(base64Data, geminiSessionRef);
            }

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

/** One streamed Gemini answer over HTTP, with the session's instructions, backup keys and backup models. */
async function streamGeminiHttp({ contents }) {
    const config = currentSystemPrompt ? { systemInstruction: currentSystemPrompt } : undefined;
    const model = sanitizeModelId(getConfig().geminiModel, DEFAULT_GEMINI_MODEL);
    const keys = getProviderKeys('gemini');
    if (keys.length === 0) {
        return { success: false, error: 'No API key configured' };
    }

    let retried = false;
    const stream = nextStreamId('gemini');
    try {
        console.log(`Asking ${model} (streaming)...`);
        const answer = await streamGeminiAnswer({
            selected: model,
            generate: candidate =>
                keyRing.run(
                    'gemini',
                    keys,
                    apiKey => new GoogleGenAI({ apiKey }).models.generateContentStream({ model: candidate, contents, config }),
                    index => {
                        retried = true;
                        sendToRenderer('update-status', `Switching to Gemini key ${index + 1}...`);
                    }
                ),
            // New response for the first chunk, update for the following ones
            onText: (text, isFirst) => sendToRenderer(isFirst ? 'new-response' : 'update-response', text, stream),
            onRetry: next => {
                retried = true;
                console.warn(`Gemini is busy, trying ${next}`);
                sendToRenderer('update-status', `Gemini is busy, trying ${next}...`);
            },
        });

        // Say so when a backup model answered instead of the chosen one
        let fullText = answer.text;
        if (answer.model !== model && fullText) {
            fullText += `\n\n*Answered by ${answer.model} because ${model} was unavailable.*`;
            sendToRenderer('update-response', fullText, stream);
        }
        if (retried) {
            sendToRenderer('update-status', 'Listening...');
        }

        console.log(`Response completed from ${answer.model}`);
        return { success: true, text: fullText, model: answer.model };
    } catch (error) {
        console.error('Error calling Gemini over HTTP:', error);
        if (retried) {
            sendToRenderer('update-status', 'Listening...');
        }
        return { success: false, error: describeGeminiError(error, model) };
    }
}

async function sendImageToGeminiHttp(base64Data, prompt) {
    const result = await streamGeminiHttp({
        contents: [{ inlineData: { mimeType: 'image/jpeg', data: base64Data } }, { text: prompt }],
    });
    if (result.success) {
        // Save screen analysis to history
        saveScreenAnalysis(prompt, result.text, result.model);
        shareWithCli(`[Screen analysis] ${prompt}`, result.text);
    }
    return result;
}

/** A typed question answered over HTTP, for a mixed session without a Live connection. */
async function sendTextToGeminiHttp(text) {
    const contents = conversationHistory.slice(-10).flatMap(turn => [
        { role: 'user', parts: [{ text: turn.transcription }] },
        { role: 'model', parts: [{ text: turn.ai_response }] },
    ]);
    contents.push({ role: 'user', parts: [{ text }] });

    const result = await streamGeminiHttp({ contents });
    if (result.success && result.text) {
        saveConversationTurn(text, result.text);
        shareWithCli(text, result.text);
    }
    return result;
}

/** Connects Gemini Live with the saved keys, moving to a backup when a key is refused. */
async function startLiveSession(customPrompt, profile, language) {
    const keys = keyRing.order('gemini', getProviderKeys('gemini'));
    if (keys.length === 0) {
        return { session: null, error: 'Enter your Gemini API key first.' };
    }
    for (const apiKey of keys) {
        lastInitError = '';
        lastInitKeyError = false;
        const session = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        if (session) {
            return { session, error: '' };
        }
        if (!lastInitKeyError) break;
    }
    return { session: null, error: lastInitError };
}

async function closeLiveSession(geminiSessionRef) {
    // Set flag to prevent reconnection attempts
    isUserClosing = true;
    sessionParams = null;

    // Cleanup session
    if (geminiSessionRef.current) {
        await geminiSessionRef.current.close();
        geminiSessionRef.current = null;
    } else {
        closeTransportLog();
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-gemini', async (event, customPrompt, profile = 'interview', language = 'en-US') => {
        currentProviderMode = 'byok';
        const { session, error } = await startLiveSession(customPrompt, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return { success: true };
        }
        return { success: false, error };
    });

    ipcMain.handle('initialize-mixed', async (event, options) => {
        const safeOptions = options && typeof options === 'object' ? options : {};
        const profile = typeof safeOptions.profile === 'string' ? safeOptions.profile : 'interview';
        const customPrompt = typeof safeOptions.customPrompt === 'string' ? safeOptions.customPrompt : '';
        const language = typeof safeOptions.language === 'string' ? safeOptions.language : 'auto';

        mixedRoutes = normalizeMixedRoutes(getPreferences().mixedRoutes);
        const needs = getMixedRequirements(mixedRoutes);
        const hasGemini = getProviderKeys('gemini').length > 0;
        if (needs.live && !hasGemini) {
            return { success: false, error: 'Voice over the API needs a Gemini API key.' };
        }
        if (needs.apiKey && !hasGemini && !hasGroqKey()) {
            return { success: false, error: 'Add a Gemini or Groq API key for the tasks that use the API.' };
        }

        currentProviderMode = 'mixed';
        const fail = error => {
            if (needs.cli) getCliAi().closeCliSession();
            currentProviderMode = 'byok';
            return { success: false, error };
        };

        if (needs.cli) {
            const started = await getCliAi().initializeCliSession({
                ...safeOptions,
                // The CLI transcribes speech only when voice is routed to it
                whisperEnabled: mixedRoutes.voice === 'cli',
                startsSession: !needs.live,
            });
            if (!started) {
                return fail('Could not start the CLI part. Check the CLI installation and sign-in.');
            }
        }

        if (needs.live) {
            const { session, error } = await startLiveSession(customPrompt, profile, safeOptions.language || 'en-US');
            if (!session) {
                return fail(error);
            }
            geminiSessionRef.current = session;
        } else {
            // The CLI part has started the session record; the API only needs its prompt
            currentSystemPrompt = (await buildApiSystemPrompts(profile, customPrompt)).request;
        }

        console.log('Mixed session started:', JSON.stringify(mixedRoutes), 'language:', language);
        return { success: true };
    });

    // The key is read here, so the renderer passes nothing in
    ipcMain.handle('gemini:list-models', async () => {
        const keys = getProviderKeys('gemini');
        if (keys.length === 0) {
            return { success: false, error: 'Enter your Gemini API key first.' };
        }
        try {
            return { success: true, data: await keyRing.run('gemini', keys, apiKey => listGeminiModels(apiKey)) };
        } catch (error) {
            console.error('Error listing Gemini models:', error.message);
            return { success: false, error: describeGeminiError(error, 'models list') };
        }
    });

    ipcMain.handle('initialize-local', async (event, localLlmModel, whisperModel, profile, customPrompt) => {
        currentProviderMode = 'local';
        const success = await getLocalAi().initializeLocalSession(localLlmModel, whisperModel, profile, customPrompt);
        if (!success) {
            currentProviderMode = 'byok';
        }
        return success;
    });

    ipcMain.handle('cancel-local-initialization', async () => {
        const cancelled = await getLocalAi().cancelLocalInitialization();
        if (cancelled) {
            currentProviderMode = 'byok';
        }
        return cancelled;
    });

    ipcMain.handle('initialize-cli', async (event, options) => {
        const safeOptions = options && typeof options === 'object' ? options : {};
        currentProviderMode = 'cli';
        const success = await getCliAi().initializeCliSession(safeOptions);
        if (!success) {
            currentProviderMode = 'byok';
        }
        return success;
    });

    ipcMain.handle('cancel-cli-initialization', async () => {
        const cancelled = await getCliAi().cancelCliInitialization();
        if (cancelled) {
            currentProviderMode = 'byok';
        }
        return cancelled;
    });

    ipcMain.handle('cli:check-status', async (event, paths) => {
        try {
            const safePaths = paths && typeof paths === 'object' ? paths : {};
            const claudePath = typeof safePaths.claudePath === 'string' ? safePaths.claudePath : '';
            const geminiPath = typeof safePaths.geminiPath === 'string' ? safePaths.geminiPath : '';
            const { checkAllCliStatuses } = require('./cli-runners');
            const data = await checkAllCliStatuses({ claudePath, geminiPath });
            return { success: true, data };
        } catch (error) {
            console.error('Error checking CLI status:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cli:launch-setup', async (event, options) => {
        try {
            const safeOpts = options && typeof options === 'object' ? options : {};
            const provider = safeOpts.provider;
            if (provider !== 'claude' && provider !== 'gemini') {
                return { success: false, error: 'Invalid CLI provider' };
            }
            const action = safeOpts.action === undefined ? 'install' : safeOpts.action;
            if (action !== 'install' && action !== 'login') {
                return { success: false, error: 'Invalid CLI setup action' };
            }
            const customPath = typeof safeOpts.customPath === 'string' ? safeOpts.customPath.trim() : '';
            const { isSafeCustomPath, launchCliSetup } = require('./cli-runners');
            if (customPath && !isSafeCustomPath(customPath)) {
                return { success: false, error: 'Invalid custom CLI path' };
            }
            return launchCliSetup({ provider, action, customPath });
        } catch (error) {
            console.error('Error launching CLI setup:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cli:list-models', async (event, options) => {
        try {
            const safeOpts = options && typeof options === 'object' ? options : {};
            const geminiPath = typeof safeOpts.geminiPath === 'string' ? safeOpts.geminiPath : '';
            const useSubscriptionAuth = safeOpts.useSubscriptionAuth !== false;
            const { listAgyModels } = require('./cli-runners');
            const data = await listAgyModels({ customPath: geminiPath, useSubscriptionAuth });
            return { success: true, data };
        } catch (error) {
            console.error('Error listing CLI models:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cli:switch-provider', async (event, provider) => {
        if (provider !== 'claude' && provider !== 'gemini') {
            return { success: false, error: 'Invalid CLI provider' };
        }
        return getCliAi().switchCliProvider(provider);
    });

    ipcMain.handle('cli:get-active-provider', async () => {
        return { success: true, data: getCliAi().getActiveCliProvider() };
    });

    ipcMain.handle('cli:suggest-continuation', async () => {
        return getCliAi().suggestCliContinuation();
    });

    function parseAudioSampleRate(mimeType, sampleRate) {
        const numericRate = Number(sampleRate);
        if (Number.isFinite(numericRate) && numericRate > 0) {
            return numericRate;
        }
        if (typeof mimeType === 'string') {
            const match = mimeType.match(/rate=(\d+)/i);
            if (match) {
                const parsed = Number(match[1]);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
        }
        return 24000;
    }

    ipcMain.handle('send-audio-content', async (event, { data, mimeType, sampleRate }) => {
        const resolvedRate = parseAudioSampleRate(mimeType, sampleRate);
        if (providerFor('voice') === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer, 'interviewer', resolvedRate);
                return { success: true };
            } catch (error) {
                console.error('Error sending local audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (providerFor('voice') === 'cli') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getCliAi().processCliAudio(pcmBuffer, 'interviewer', resolvedRate);
                return { success: true };
            } catch (error) {
                console.error('Error sending CLI audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };
        try {
            process.stdout.write('.');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle microphone audio on a separate channel
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType, sampleRate }) => {
        const resolvedRate = parseAudioSampleRate(mimeType, sampleRate);
        if (providerFor('voice') === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer, 'candidate', resolvedRate);
                return { success: true };
            } catch (error) {
                console.error('Error sending local mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (providerFor('voice') === 'cli') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getCliAi().processCliAudio(pcmBuffer, 'candidate', resolvedRate);
                return { success: true };
            } catch (error) {
                console.error('Error sending CLI mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };
        try {
            process.stdout.write(',');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending mic audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, prompt }) => {
        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            process.stdout.write('!');

            if (providerFor('screen') === 'local') {
                const result = await getLocalAi().sendLocalImage(data, prompt);
                return result;
            }

            if (providerFor('screen') === 'cli') {
                const result = await getCliAi().sendCliImage(data, prompt);
                return result;
            }

            const result = hasGroqKey() ? await sendImageToGroq(data, prompt) : await sendImageToGeminiHttp(data, prompt);
            return result;
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return { success: false, error: 'Invalid text message' };
        }

        if (providerFor('text') === 'local') {
            try {
                console.log('Sending text to local Llama:', text);
                return await getLocalAi().sendLocalText(text.trim());
            } catch (error) {
                console.error('Error sending local text:', error);
                return { success: false, error: error.message };
            }
        }

        if (providerFor('text') === 'cli') {
            try {
                console.log('Sending text to CLI:', text);
                return await getCliAi().sendCliText(text.trim());
            } catch (error) {
                console.error('Error sending CLI text:', error);
                return { success: false, error: error.message };
            }
        }

        // Mixed mode with voice on the CLI has no Live connection to type into
        if (currentProviderMode === 'mixed' && !geminiSessionRef.current && mixedRoutes.voice === 'cli') {
            if (hasGroqKey()) {
                sendToGroq(text.trim());
                return { success: true };
            }
            return sendTextToGeminiHttp(text.trim());
        }

        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

        try {
            console.log('Sending text message:', text);

            if (hasGroqKey()) {
                groqRequestStartedForTurn = true;
                sendToGroq(text.trim());
            }

            await geminiSessionRef.current.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            if (currentProviderMode === 'local') {
                getLocalAi().closeLocalSession();
                currentProviderMode = 'byok';
                closeTransportLog();
                return { success: true };
            }

            if (currentProviderMode === 'cli') {
                getCliAi().closeCliSession();
                currentProviderMode = 'byok';
                closeTransportLog();
                return { success: true };
            }

            if (currentProviderMode === 'mixed') {
                getCliAi().closeCliSession();
                currentProviderMode = 'byok';
            }

            await closeLiveSession(geminiSessionRef);

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    saveScreenAnalysis,
    getCurrentSessionData,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    sendImageToGeminiHttp,
    setupGeminiIpcHandlers,
    formatSpeakerResults,
};
