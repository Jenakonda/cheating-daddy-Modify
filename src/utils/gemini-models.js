// Gemini model choice for BYOK mode. No Electron imports, so it can be tested in Node.
// Google retires models regularly: the user can always pick another one on Home.

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.8-live';
// The Live default of version 0.11.0 and older, which Google has since replaced
const PREVIOUS_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

// Tried in this order when the selected model cannot answer a screen analysis because of load or limits
const BACKUP_GEMINI_MODELS = [DEFAULT_GEMINI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const BUSY_RETRY_DELAY_MS = 1500;

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

/** Returns a safe model id ("models/" prefix removed), or the fallback for empty and malformed values. */
function sanitizeModelId(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const id = value.trim().replace(/^models\//, '');
    return MODEL_ID_PATTERN.test(id) ? id : fallback;
}

/**
 * API version and setup config for a Live session. Models differ in what they accept:
 * only the 2.5 native audio models take the proactivity option (newer ones have it built in or not at all).
 * Native audio models pick the language themselves, so no language code is sent.
 *
 * With resumption on, Google sends handles during the session; passing the last one to a new connection
 * continues the same conversation.
 */
function buildLiveSessionOptions(model, { systemPrompt, tools = [], resumption = true, resumeHandle = '' }) {
    const isGemini25 = model.startsWith('gemini-2.5-') || model.startsWith('gemini-live-2.5-');
    const config = {
        responseModalities: ['AUDIO'],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools,
        contextWindowCompression: { slidingWindow: {} },
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    if (resumption) {
        config.sessionResumption = resumeHandle ? { handle: resumeHandle } : {};
    }
    if (isGemini25) {
        config.proactivity = { proactiveAudio: true };
    }
    return { apiVersion: isGemini25 ? 'v1alpha' : 'v1beta', config };
}

/** True when retrying cannot help: unknown or retired model, bad key, rejected request. */
function isPermanentGeminiError(message) {
    return /not[ _]found|no longer available|not supported|api[ _]key not valid|api_key_invalid|permission[ _]denied|invalid[ _]argument|unauthenticated/i.test(
        String(message || '')
    );
}

function getErrorText(error) {
    return String(error?.message || error || 'Unknown error');
}

/** HTTP status of an API error, taken from its fields or from the text. NaN or 0 when there is none. */
function getErrorCode(error) {
    const raw = getErrorText(error);
    return Number(error?.status || error?.code) || Number((raw.match(/status: (\d{3})/) || raw.match(/"code\\*"\s*:\s*(\d{3})/) || [])[1]);
}

/** True for temporary trouble on Google's side, such as "high demand". */
function isBusyGeminiError(error) {
    return [500, 502, 503, 504].includes(getErrorCode(error)) || /high demand|overloaded|\bUNAVAILABLE\b/.test(getErrorText(error));
}

/** Turns an API error (often a JSON string inside a message) into one readable sentence. */
function describeGeminiError(error, model) {
    const raw = getErrorText(error);
    const code = getErrorCode(error);

    if (code === 404 || /no longer available|is not found|not found for api version/i.test(raw)) {
        return `The model "${model}" is not available for your API key. Choose another Gemini model on Home.`;
    }
    if (/api[ _]key not valid|api_key_invalid/i.test(raw) || code === 401) {
        return 'The Gemini API key is not valid. Check it on Home.';
    }
    if (code === 429) {
        return `Gemini rate limit reached for "${model}". Wait a moment or choose another model on Home.`;
    }
    if (isBusyGeminiError(error)) {
        return `The model "${model}" is overloaded on Google's side. Try again in a moment or choose another model on Home.`;
    }
    // The readable text may sit in a JSON string nested inside another one, with escaped quotes
    const inner = raw.match(/"message\\*"\s*:\s*\\*"([^"\\{]+)/);
    return `Gemini error: ${(inner ? inner[1] : raw).slice(0, 300)}`;
}

/**
 * Streams one answer. A busy model is asked once more, then the backup models are tried; a rate limit goes
 * straight to the backups. Other errors of the selected model (bad key, retired model) are not retried.
 * Once text has reached the screen nothing is retried. Throws the selected model's error when all fail.
 *
 * generate(model) resolves to an async iterable of { text } chunks.
 */
async function streamGeminiAnswer({
    selected,
    generate,
    onText,
    onRetry = () => {},
    backups = BACKUP_GEMINI_MODELS,
    wait = () => new Promise(resolve => setTimeout(resolve, BUSY_RETRY_DELAY_MS)),
}) {
    const attempts = [selected, selected, ...backups.filter(model => model !== selected)];
    let selectedError = null;

    for (let index = 0; index < attempts.length; index++) {
        const model = attempts[index];
        let text = '';
        try {
            for await (const chunk of await generate(model)) {
                if (!chunk.text) continue;
                const isFirst = text === '';
                text += chunk.text;
                onText(text, isFirst);
            }
            return { text, model };
        } catch (error) {
            if (text) throw error;
            const busy = isBusyGeminiError(error);
            if (model === selected) {
                selectedError = error;
                if (!busy && getErrorCode(error) !== 429) throw error;
                // Asking the same model again only helps when it was busy
                if (!busy && attempts[index + 1] === selected) index++;
            }
            const next = attempts[index + 1];
            if (next) {
                onRetry(next);
                if (next === model) await wait();
            }
        }
    }
    throw selectedError;
}

/** Splits the answer of models.list into models usable for screen analysis and for the Live session. */
function groupGeminiModels(models) {
    const generate = new Set();
    const live = new Set();
    for (const entry of Array.isArray(models) ? models : []) {
        const id = sanitizeModelId(entry?.name, '');
        if (!/^(gemini|gemma)-/.test(id)) continue;
        const methods = Array.isArray(entry.supportedGenerationMethods) ? entry.supportedGenerationMethods : [];
        if (methods.includes('bidiGenerateContent')) {
            if (!/transcribe|translate/.test(id)) live.add(id);
        } else if (methods.includes('generateContent') && !/tts|image|embedding|audio|transcribe|robotics|computer-use/.test(id)) {
            generate.add(id);
        }
    }
    const newestFirst = (a, b) => b.localeCompare(a, 'en', { numeric: true });
    return { generate: [...generate].sort(newestFirst), live: [...live].sort(newestFirst) };
}

/** Asks Google which models this API key can use. The key travels in a header, never in the URL. */
async function listGeminiModels(apiKey, fetchImpl = fetch) {
    const models = [];
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
        const url = `${MODELS_URL}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const response = await fetchImpl(url, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            const body = await response.text();
            throw Object.assign(new Error(body || `status: ${response.status}`), { status: response.status });
        }
        const data = await response.json();
        models.push(...(data.models || []));
        pageToken = data.nextPageToken || '';
        if (!pageToken) break;
    }
    return groupGeminiModels(models);
}

module.exports = {
    DEFAULT_GEMINI_MODEL,
    DEFAULT_GEMINI_LIVE_MODEL,
    PREVIOUS_GEMINI_LIVE_MODEL,
    sanitizeModelId,
    buildLiveSessionOptions,
    isPermanentGeminiError,
    getErrorCode,
    isBusyGeminiError,
    describeGeminiError,
    streamGeminiAnswer,
    groupGeminiModels,
    listGeminiModels,
};
