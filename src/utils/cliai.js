const fs = require('fs');
const path = require('path');
const { getSystemPrompt } = require('./prompts');
const { getConfigDir, getDefaultContextDir, getPreferences } = require('../storage');
const { loadContextFolder, searchContextBundle } = require('./context-folder');
const { logTransportEvent } = require('./transportLogger');
const { WhisperSttEngine, VAD_MODES } = require('./whisper-stt');
const { ClaudeCliRunner, createGoogleCliRunner, normalizeClaudeEffort, resolveCliBinary } = require('./cli-runners');
const { createHealthTracker } = require('./cli-health');

function getGeminiBridge() {
    return require('./gemini');
}

function formatProviderName(provider) {
    return provider === 'gemini' ? 'Gemini' : 'Claude';
}

function removeDirWithRetry(dirToDelete, killedProcs = []) {
    if (!dirToDelete) return;

    const tryRemove = () => {
        try {
            fs.rmSync(dirToDelete, { recursive: true, force: true });
            return true;
        } catch {
            return false;
        }
    };

    if (tryRemove()) return;

    for (const proc of killedProcs) {
        if (proc && proc.exitCode === null) {
            proc.once('close', () => tryRemove());
        }
    }

    let attempts = 0;
    const scheduleRetry = () => {
        attempts += 1;
        if (tryRemove() || attempts >= 12) return;
        const timer = setTimeout(scheduleRetry, 80);
        timer.unref?.();
    };

    const timer = setTimeout(scheduleRetry, 50);
    timer.unref?.();
}

function createCliSessionManager(deps = {}) {
    const getBridge = deps.getBridge || getGeminiBridge;
    const sendToRenderer = deps.sendToRenderer || ((...args) => getBridge().sendToRenderer(...args));
    const initializeNewSession = deps.initializeNewSession || ((profile, customPrompt) => getBridge().initializeNewSession(profile, customPrompt));
    const saveConversationTurn = deps.saveConversationTurn || ((t, r) => getBridge().saveConversationTurn(t, r));
    const saveScreenAnalysis = deps.saveScreenAnalysis || ((p, r, m) => getBridge().saveScreenAnalysis(p, r, m));
    const getPrefs = deps.getPreferences || getPreferences;
    const resolveConfigDir = deps.getConfigDir || getConfigDir;
    const resolveDefaultContextDir = deps.getDefaultContextDir || getDefaultContextDir;
    const loadContextFolderFn = deps.loadContextFolder || loadContextFolder;
    const logEvent = deps.logTransportEvent || logTransportEvent;
    const buildSystemPromptFn = deps.getSystemPrompt || getSystemPrompt;
    const resolveBinaryFn = deps.resolveCliBinary || resolveCliBinary;
    const ClaudeRunnerClass = deps.ClaudeCliRunner || ClaudeCliRunner;
    const createGoogleRunnerFn =
        deps.createGoogleCliRunner || (deps.GeminiCliRunner ? opts => new deps.GeminiCliRunner(opts) : createGoogleCliRunner);
    const whisperEngine = deps.whisperEngine || new WhisperSttEngine();
    const healthTracker = deps.healthTracker || createHealthTracker();
    let transcriptCounter = 0;

    let isCliActive = false;
    let initializationController = null;
    let activeProvider = 'claude';
    let fallbackEnabled = true;
    let whisperEnabled = true;
    let audioMode = 'speaker_only';
    let micContextOnly = true;
    let pendingCandidateUtterances = [];
    let activeContextBundle = null;
    let sessionDir = null;
    let runners = { claude: null, gemini: null };
    let runnerModels = { claude: 'sonnet', gemini: 'gemini-2.5-flash' };
    let conversationHistory = [];
    let providerSyncedTurns = { claude: 0, gemini: 0 };
    let turnQueue = Promise.resolve();
    let generation = 0;
    let streamCounter = 0;

    function getAvailableProviders() {
        return {
            claude: Boolean(runners.claude),
            gemini: Boolean(runners.gemini),
        };
    }

    function emitProviderChanged(reason = null) {
        sendToRenderer('cli-provider-changed', {
            provider: activeProvider,
            availableProviders: getAvailableProviders(),
            fallbackEnabled,
            reason,
        });
    }

    function emitHealth() {
        sendToRenderer('cli-health', healthTracker.snapshot());
    }

    function emitTranscriptLine(source, text) {
        transcriptCounter += 1;
        sendToRenderer('transcript-line', {
            id: `${Date.now()}-${transcriptCounter}`,
            source: source === 'candidate' ? 'you' : 'speaker',
            text,
            ts: Date.now(),
        });
    }

    function emitCandidateContextCount() {
        sendToRenderer('cli-candidate-context', {
            count: pendingCandidateUtterances.length,
        });
    }

    function consumeCandidateContext() {
        if (pendingCandidateUtterances.length === 0) {
            return '';
        }
        const combined = pendingCandidateUtterances.join(' ').trim();
        pendingCandidateUtterances = [];
        emitCandidateContextCount();
        return combined;
    }

    async function handleWhisperTranscription(text, source, meta = {}) {
        logEvent('cli.whisper.transcription', {
            source,
            length: text.length,
            text: text.slice(0, 200),
            inferMs: meta?.inferMs ?? null,
            language: meta?.language || null,
            detectedLanguage: meta?.detectedLanguage || null,
            avgLogprob: meta?.avgLogprob ?? null,
            noSpeechProb: meta?.noSpeechProb ?? null,
        });

        const cleanText = String(text || '').trim();
        if (!cleanText || !isCliActive) {
            return;
        }

        emitTranscriptLine(source, cleanText);

        if (audioMode === 'both' && micContextOnly && source === 'candidate') {
            pendingCandidateUtterances.push(cleanText);
            while (pendingCandidateUtterances.length > 10) {
                pendingCandidateUtterances.shift();
            }
            while (pendingCandidateUtterances.length > 1 && pendingCandidateUtterances.join(' ').length > 1500) {
                pendingCandidateUtterances.shift();
            }
            emitCandidateContextCount();
            logEvent('cli.whisper.candidate_buffered', {
                length: cleanText.length,
                bufferedCount: pendingCandidateUtterances.length,
            });
            sendToRenderer('update-status', 'Listening...');
            return;
        }

        if (audioMode === 'both' && source === 'interviewer') {
            const candidateContext = consumeCandidateContext();
            const payloadText = candidateContext
                ? `[Candidate just said]:\n${candidateContext}\n\n[Interviewer]: ${cleanText}`
                : `[Interviewer]: ${cleanText}`;
            await sendCliText(payloadText);
            return;
        }

        const prefix = audioMode === 'both' ? `[${source === 'candidate' ? 'Candidate' : 'Interviewer'}]: ` : '';
        await sendCliText(`${prefix}${cleanText}`);
    }

    function sendDownloadProgress(label, progress = null) {
        const percentage = progress?.expectedBytes ? Math.min(100, Math.floor((progress.downloadedBytes / progress.expectedBytes) * 100)) : null;
        sendToRenderer('local-ai-download-progress', {
            active: true,
            label,
            percentage,
        });
    }

    function pushConversationTurn(userText, assistantText, external = false) {
        const cleanUser = String(userText || '').trim();
        const cleanAssistant = String(assistantText || '').trim();
        if (!cleanAssistant) return;

        conversationHistory.push({
            userText: cleanUser,
            assistantText: cleanAssistant,
            external,
        });

        if (conversationHistory.length > 20) {
            const dropped = conversationHistory.length - 20;
            conversationHistory = conversationHistory.slice(-20);
            providerSyncedTurns.claude = Math.max(0, providerSyncedTurns.claude - dropped);
            providerSyncedTurns.gemini = Math.max(0, providerSyncedTurns.gemini - dropped);
        }
    }

    /** Adds an answer given by another provider, so the CLI learns about it with its next turn. */
    function addExternalTurn(userText, assistantText) {
        if (isCliActive) {
            pushConversationTurn(userText, assistantText, true);
        }
    }

    function buildMissedContextPrefix(provider) {
        const synced = providerSyncedTurns[provider] || 0;
        if (synced >= conversationHistory.length || conversationHistory.length === 0) {
            return '';
        }

        const missed = conversationHistory.slice(synced).slice(-10);
        if (missed.length === 0) {
            return '';
        }

        const formattedTurns = missed.map(turn => `User/Interviewer: ${turn.userText || '(screen)'}\nAssistant: ${turn.assistantText}`).join('\n\n');

        return `[Earlier conversation context from this session — continue consistently]:\n${formattedTurns}\n\n[Current message]:\n`;
    }

    async function runOnProvider(provider, { text, imageBase64, isScreenAnalysis }) {
        const runner = runners[provider];
        if (!runner) {
            throw new Error(`${formatProviderName(provider)} CLI is not configured`);
        }

        const contextPrefix = buildMissedContextPrefix(provider);
        let promptText = contextPrefix ? `${contextPrefix}${text}` : text;

        if (!isScreenAnalysis && activeContextBundle?.mode === 'rag') {
            const rag = searchContextBundle(activeContextBundle, text);
            if (rag.formattedText) {
                promptText = `${rag.formattedText}\n\n[Current question]:\n${promptText}`;
            }
        }

        const turnsBefore = new Set(conversationHistory);
        let isFirstChunk = true;
        streamCounter += 1;
        const stream = `cli-${streamCounter}`;
        const result = await runner.sendTurn({
            text: promptText,
            imageBase64,
            onDelta: partialText => {
                if (!partialText) return;
                sendToRenderer(isFirstChunk ? 'new-response' : 'update-response', partialText, stream);
                isFirstChunk = false;
            },
        });

        const finalText = (result?.text || '').trim();
        if (!finalText) {
            throw new Error(`${formatProviderName(provider)} CLI returned an empty response`);
        }

        const historyUserLabel = isScreenAnalysis ? `[Screen analysis] ${text}` : text;
        pushConversationTurn(historyUserLabel, finalText);
        const unseen = conversationHistory.findIndex(turn => turn.external && !turnsBefore.has(turn));
        providerSyncedTurns[provider] = unseen === -1 ? conversationHistory.length : unseen;
        healthTracker.recordSuccess(provider);
        emitHealth();

        if (isScreenAnalysis) {
            saveScreenAnalysis(text, finalText, `cli:${provider}:${runnerModels[provider]}`);
        } else {
            saveConversationTurn(text, finalText);
        }

        logEvent(`cli.${provider}.completed`, {
            provider,
            model: runnerModels[provider],
            isScreenAnalysis,
            responseLength: finalText.length,
        });

        return {
            success: true,
            text: finalText,
            model: `cli:${provider}:${runnerModels[provider]}`,
            provider,
        };
    }

    function executeTurn({ text, imageBase64 = null, isScreenAnalysis = false }) {
        const turnGen = generation;
        const run = async () => {
            if (!isCliActive || generation !== turnGen) {
                return { success: false, error: 'No active CLI session' };
            }

            const primary = activeProvider;
            const secondary = primary === 'claude' ? 'gemini' : 'claude';

            sendToRenderer(
                'update-status',
                isScreenAnalysis ? `Analyzing screen (${formatProviderName(primary)})...` : `Generating (${formatProviderName(primary)})...`
            );
            logEvent('cli.turn.start', {
                provider: primary,
                isScreenAnalysis,
                textLength: (text || '').length,
            });

            try {
                const outcome = await runOnProvider(primary, { text, imageBase64, isScreenAnalysis });
                sendToRenderer('update-status', whisperEnabled ? 'Listening...' : 'Ready');
                return outcome;
            } catch (primaryError) {
                if (!isCliActive || generation !== turnGen) {
                    return { success: false, error: 'CLI session closed' };
                }

                logEvent('cli.turn.error', {
                    provider: primary,
                    code: primaryError.code || 'EXECUTION_ERROR',
                    error: primaryError.message,
                });
                healthTracker.recordFailure(primary, { code: primaryError.code, message: primaryError.message });
                emitHealth();

                const canFallback = fallbackEnabled && Boolean(runners[secondary]) && primaryError.fallbackRecommended !== false;

                if (!canFallback) {
                    sendToRenderer('update-status', `${formatProviderName(primary)} error: ${primaryError.message}`);
                    return { success: false, error: primaryError.message };
                }

                logEvent('cli.fallback', {
                    from: primary,
                    to: secondary,
                    code: primaryError.code || 'EXECUTION_ERROR',
                    reason: primaryError.message,
                });

                activeProvider = secondary;
                emitProviderChanged(primaryError.code || 'FALLBACK');
                sendToRenderer(
                    'update-status',
                    `${formatProviderName(primary)} unavailable (${primaryError.code || 'error'}) — switched to ${formatProviderName(secondary)}...`
                );

                try {
                    const fallbackOutcome = await runOnProvider(secondary, { text, imageBase64, isScreenAnalysis });
                    sendToRenderer('update-status', whisperEnabled ? 'Listening...' : 'Ready');
                    return fallbackOutcome;
                } catch (secondaryError) {
                    logEvent('cli.turn.error', {
                        provider: secondary,
                        code: secondaryError.code || 'EXECUTION_ERROR',
                        error: secondaryError.message,
                    });
                    healthTracker.recordFailure(secondary, { code: secondaryError.code, message: secondaryError.message });
                    emitHealth();
                    sendToRenderer('update-status', `Both CLIs failed: ${secondaryError.message}`);
                    return { success: false, error: secondaryError.message };
                }
            }
        };

        const queued = turnQueue.then(run, run);
        turnQueue = queued.catch(() => {});
        return queued;
    }

    async function initializeCliSession(options = {}) {
        sendToRenderer('session-initializing', true);

        try {
            closeCliSession();
            initializationController = new AbortController();
            const currentGen = generation;

            const prefs = getPrefs() || {};
            const primaryProvider =
                options.primaryProvider === 'gemini'
                    ? 'gemini'
                    : options.primaryProvider === 'claude'
                      ? 'claude'
                      : prefs.cliPrimaryProvider === 'gemini'
                        ? 'gemini'
                        : 'claude';
            const secondaryProvider = primaryProvider === 'claude' ? 'gemini' : 'claude';

            fallbackEnabled = options.fallbackEnabled ?? prefs.cliFallbackEnabled ?? true;
            const useSubscriptionAuth = options.useSubscriptionAuth ?? prefs.cliUseSubscriptionAuth ?? true;
            whisperEnabled = options.whisperEnabled ?? prefs.cliWhisperEnabled ?? true;
            const whisperModel = options.whisperModel || prefs.whisperModel || 'small-q5_1';
            const claudeModel = options.claudeModel || prefs.cliClaudeModel || 'sonnet';
            const claudeEffort = normalizeClaudeEffort(options.claudeEffort ?? prefs.cliClaudeEffort ?? 'auto');
            const geminiModel = options.geminiModel || prefs.cliGeminiModel || 'gemini-4-hydrogen-low';
            const claudePath = options.claudePath ?? prefs.cliClaudePath ?? '';
            const geminiPath = options.geminiPath ?? prefs.cliGeminiPath ?? '';
            const profile = options.profile || prefs.selectedProfile || 'interview';
            const customPrompt = options.customPrompt ?? prefs.customPrompt ?? '';
            const language = options.language || prefs.selectedLanguage || 'auto';
            const responseLanguage = options.responseLanguage || prefs.responseLanguage || 'auto';
            const googleSearchEnabled = Boolean(options.googleSearchEnabled ?? prefs.googleSearchEnabled ?? false);
            audioMode = options.audioMode || prefs.audioMode || 'speaker_only';
            micContextOnly = options.micContextOnly ?? prefs.cliMicContextOnly ?? true;
            pendingCandidateUtterances = [];
            emitCandidateContextCount();

            const claudeResolved = resolveBinaryFn('claude', claudePath);
            const geminiResolved = resolveBinaryFn('gemini', geminiPath);
            const resolvedMap = {
                claude: claudeResolved,
                gemini: geminiResolved,
            };

            let startNotice = null;
            if (resolvedMap[primaryProvider].found) {
                activeProvider = primaryProvider;
            } else if (fallbackEnabled && resolvedMap[secondaryProvider].found) {
                activeProvider = secondaryProvider;
                startNotice = `${formatProviderName(primaryProvider)} CLI not found — using ${formatProviderName(secondaryProvider)} CLI`;
            } else {
                sendToRenderer('session-initializing', false);
                sendToRenderer('update-status', 'No CLI found. Install Claude CLI or Gemini CLI.');
                return false;
            }

            const contextFolderEnabled = options.contextFolderEnabled ?? prefs.contextFolderEnabled ?? true;
            const rawFolderPath = options.contextFolderPath ?? prefs.contextFolderPath ?? '';
            const resolvedContextFolder =
                rawFolderPath && String(rawFolderPath).trim() ? path.resolve(String(rawFolderPath).trim()) : resolveDefaultContextDir();
            activeContextBundle =
                contextFolderEnabled && resolvedContextFolder && fs.existsSync(resolvedContextFolder)
                    ? await loadContextFolderFn(resolvedContextFolder)
                    : null;

            // The CLI session searches the folder for each question, so the prompt may say so
            const folderContext =
                activeContextBundle && activeContextBundle.mode !== 'empty' ? { ...activeContextBundle, excerptsAttached: true } : null;
            const systemPrompt = buildSystemPromptFn(profile, customPrompt, googleSearchEnabled, responseLanguage, folderContext);
            const sessionFolderName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            sessionDir = path.join(resolveConfigDir(), 'cli-sessions', sessionFolderName);
            const claudeCwd = path.join(sessionDir, 'claude');
            const geminiCwd = path.join(sessionDir, 'gemini');
            fs.mkdirSync(claudeCwd, { recursive: true });
            fs.mkdirSync(geminiCwd, { recursive: true });

            runnerModels = { claude: claudeModel, gemini: geminiModel };
            runners = {
                claude: claudeResolved.found
                    ? new ClaudeRunnerClass({
                          binaryPath: claudeResolved.path,
                          model: claudeModel,
                          effort: claudeEffort,
                          systemPrompt,
                          cwd: claudeCwd,
                          useSubscriptionAuth,
                          turnTimeoutMs: options.turnTimeoutMs || 60000,
                          onLog: logEvent,
                      })
                    : null,
                gemini: geminiResolved.found
                    ? createGoogleRunnerFn({
                          binaryPath: geminiResolved.path,
                          model: geminiModel,
                          systemPrompt,
                          cwd: geminiCwd,
                          useSubscriptionAuth,
                          turnTimeoutMs: options.turnTimeoutMs || 60000,
                          onLog: logEvent,
                      })
                    : null,
            };

            if (whisperEnabled) {
                await whisperEngine.start({
                    whisperModel,
                    language,
                    initialPrompt: options.speechVocabulary ?? prefs.speechVocabulary ?? '',
                    vadMode: VAD_MODES.BALANCED,
                    onStatus: status => sendToRenderer('update-status', status),
                    onProgress: (label, progress) => sendDownloadProgress(label, progress),
                    onDownloadingChange: downloading => sendToRenderer('whisper-downloading', downloading),
                    onTranscription: async (text, source, meta = {}) => {
                        if (!isCliActive || generation !== currentGen) return;
                        await handleWhisperTranscription(text, source, meta);
                    },
                    onFiltered: ({ text, source, reason, meta = {} }) => {
                        if (generation !== currentGen) return;
                        logEvent('cli.whisper.filtered', {
                            source,
                            reason,
                            length: (text || '').length,
                            text: (text || '').slice(0, 120),
                            inferMs: meta?.inferMs ?? null,
                            avgLogprob: meta?.avgLogprob ?? null,
                            noSpeechProb: meta?.noSpeechProb ?? null,
                        });
                    },
                    signal: initializationController.signal,
                });
            }

            if (initializationController.signal.aborted || generation !== currentGen) {
                const abortErr = new Error('CLI initialization cancelled');
                abortErr.name = 'AbortError';
                throw abortErr;
            }

            if (activeProvider === 'claude' && runners.claude) {
                try {
                    runners.claude.ensureStarted();
                } catch (spawnError) {
                    if (fallbackEnabled && runners.gemini) {
                        activeProvider = 'gemini';
                        startNotice = `Claude CLI failed to start — using Gemini CLI`;
                    } else {
                        throw spawnError;
                    }
                }
            } else if (activeProvider === 'gemini' && runners.gemini) {
                try {
                    if (typeof runners.gemini.ensureStarted === 'function') {
                        runners.gemini.ensureStarted();
                    } else if (typeof runners.gemini.ensurePrepared === 'function') {
                        runners.gemini.ensurePrepared();
                    }
                } catch (spawnError) {
                    if (fallbackEnabled && runners.claude) {
                        activeProvider = 'claude';
                        startNotice = `Google CLI failed to start — using Claude CLI`;
                    } else {
                        throw spawnError;
                    }
                }
            }

            conversationHistory = [];
            providerSyncedTurns = { claude: 0, gemini: 0 };
            turnQueue = Promise.resolve();

            // In a mixed session the Live connection may already own the session record
            if (options.startsSession !== false) {
                initializeNewSession(profile, customPrompt);
            }
            isCliActive = true;
            initializationController = null;

            sendToRenderer('local-ai-download-progress', { active: false });
            sendToRenderer('session-initializing', false);
            healthTracker.reset();
            emitHealth();
            emitProviderChanged();
            sendToRenderer(
                'update-status',
                startNotice || `${formatProviderName(activeProvider)} CLI ready - ${whisperEnabled ? 'Listening...' : 'Text & Screen mode'}`
            );

            logEvent('cli.session.started', {
                activeProvider,
                availableProviders: getAvailableProviders(),
                claudeModel,
                claudeEffort,
                geminiModel,
                whisperEnabled,
                whisperModel,
                whisperLanguage: language,
                responseLanguage,
                contextFolder: activeContextBundle
                    ? {
                          enabled: true,
                          mode: activeContextBundle.mode,
                          loadedFileCount: activeContextBundle.loadedFileCount,
                          totalChars: activeContextBundle.totalChars,
                      }
                    : {
                          enabled: Boolean(contextFolderEnabled),
                          mode: 'empty',
                          loadedFileCount: 0,
                          totalChars: 0,
                      },
                audioMode,
                micContextOnly,
                useSubscriptionAuth,
            });
            return true;
        } catch (error) {
            const wasCancelled = error.name === 'AbortError' || initializationController?.signal.aborted;
            console.error('[CliAI] Initialization error:', error);
            closeCliSession();
            sendToRenderer('local-ai-download-progress', { active: false });
            sendToRenderer('session-initializing', false);
            sendToRenderer('update-status', wasCancelled ? 'CLI initialization cancelled' : `CLI error: ${error.message}`);
            return false;
        }
    }

    async function cancelCliInitialization() {
        if (!initializationController) {
            return false;
        }

        initializationController.abort();
        whisperEngine.stop();
        await new Promise(resolve => setTimeout(resolve, 200));
        closeCliSession();
        sendToRenderer('local-ai-download-progress', { active: false });
        sendToRenderer('session-initializing', false);
        return true;
    }

    function processCliAudio(monoChunk, source = 'interviewer', sampleRate = 24000) {
        if (!isCliActive || !whisperEnabled) {
            return;
        }
        whisperEngine.processAudio(monoChunk, source, sampleRate);
    }

    async function sendCliText(text) {
        if (!isCliActive) {
            return { success: false, error: 'No active CLI session' };
        }
        if (!text || typeof text !== 'string' || !text.trim()) {
            return { success: false, error: 'Empty message' };
        }
        return executeTurn({ text: text.trim(), isScreenAnalysis: false });
    }

    async function sendCliImage(base64Data, prompt = '') {
        if (!isCliActive) {
            return { success: false, error: 'No active CLI session' };
        }
        if (!base64Data || typeof base64Data !== 'string') {
            return { success: false, error: 'Invalid image data' };
        }
        const effectivePrompt = prompt && prompt.trim() ? prompt.trim() : 'Analyze this screen and provide the direct answer.';
        return executeTurn({
            text: effectivePrompt,
            imageBase64: base64Data,
            isScreenAnalysis: true,
        });
    }

    async function suggestCliContinuation() {
        if (!isCliActive) {
            return { success: false, error: 'No active CLI session' };
        }

        const candidateContext = consumeCandidateContext();
        const prompt = candidateContext
            ? `[Candidate just started saying]:\n${candidateContext}\n\n[Request]: The candidate paused and needs help continuing this exact response naturally. Provide the next 1-2 short, ready-to-speak sentences in the same language to continue smoothly without repeating what was already said.`
            : `[Request]: Provide 1-2 short, ready-to-speak follow-up sentences to continue the previous answer naturally in the same language.`;

        logEvent('cli.continuation.requested', {
            hasCandidateContext: Boolean(candidateContext),
            contextLength: candidateContext.length,
        });

        return executeTurn({ text: prompt, isScreenAnalysis: false });
    }

    function switchCliProvider(provider) {
        if (provider !== 'claude' && provider !== 'gemini') {
            return { success: false, error: 'Unsupported CLI provider' };
        }
        if (!isCliActive) {
            return { success: false, error: 'No active CLI session' };
        }
        if (!runners[provider]) {
            return { success: false, error: `${formatProviderName(provider)} CLI is not installed or unavailable` };
        }

        activeProvider = provider;
        emitProviderChanged('manual');
        sendToRenderer('update-status', `Switched to ${formatProviderName(provider)} CLI`);
        logEvent('cli.provider_switched', { provider });

        return {
            success: true,
            provider: activeProvider,
            availableProviders: getAvailableProviders(),
        };
    }

    function getActiveCliProvider() {
        return {
            active: isCliActive,
            provider: isCliActive ? activeProvider : null,
            availableProviders: getAvailableProviders(),
            fallbackEnabled,
        };
    }

    function teardownState() {
        generation += 1;
        isCliActive = false;
        initializationController?.abort();
        initializationController = null;
        whisperEngine.stop();

        const currentRunners = runners;
        runners = { claude: null, gemini: null };
        conversationHistory = [];
        providerSyncedTurns = { claude: 0, gemini: 0 };
        pendingCandidateUtterances = [];
        activeContextBundle = null;
        emitCandidateContextCount();
        turnQueue = Promise.resolve();

        const dirToDelete = sessionDir;
        sessionDir = null;

        return { currentRunners, dirToDelete };
    }

    function closeCliSession() {
        const { currentRunners, dirToDelete } = teardownState();
        const killedProcs = [];

        for (const runner of [currentRunners.claude, currentRunners.gemini]) {
            if (!runner) continue;
            try {
                const proc = runner.close();
                if (proc) killedProcs.push(proc);
            } catch {
                // Ignore close errors
            }
        }

        removeDirWithRetry(dirToDelete, killedProcs);
    }

    async function closeCliSessionAsync() {
        const { currentRunners, dirToDelete } = teardownState();

        for (const runner of [currentRunners.claude, currentRunners.gemini]) {
            if (!runner) continue;
            try {
                if (typeof runner.closeAsync === 'function') {
                    await runner.closeAsync();
                } else {
                    runner.close();
                }
            } catch {
                // Ignore close errors
            }
        }

        if (dirToDelete) {
            try {
                fs.rmSync(dirToDelete, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
            } catch (err) {
                console.warn('[CliAI] Failed to clean session directory:', err.message);
            }
        }
    }

    function isCliSessionActive() {
        return isCliActive;
    }

    return {
        initializeCliSession,
        cancelCliInitialization,
        processCliAudio,
        sendCliText,
        sendCliImage,
        addExternalTurn,
        suggestCliContinuation,
        switchCliProvider,
        getActiveCliProvider,
        closeCliSession,
        closeCliSessionAsync,
        isCliSessionActive,
    };
}

const defaultManager = createCliSessionManager();

module.exports = {
    createCliSessionManager,
    ...defaultManager,
};
