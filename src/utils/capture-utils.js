// Pure helpers for the capture pipeline. They have no Electron or DOM dependencies so they can be tested in Node.

const MANUAL_SCREENSHOT_LANGUAGE_LABELS = {
    uk: 'Ukrainian',
    en: 'English',
    ru: 'Russian',
    pl: 'Polish',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
};

/** Converts float samples (-1..1) to 16-bit PCM, clamping values that would clip. */
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Collects incoming float samples and hands them out as fixed-size 16-bit PCM chunks, oldest first.
 * Leftover samples wait for the next push.
 */
function createPcmChunker(samplesPerChunk) {
    const size = Math.max(1, Math.floor(samplesPerChunk) || 1);
    let buffer = [];

    return {
        push(samples) {
            for (let i = 0; i < samples.length; i++) {
                buffer.push(samples[i]);
            }
            const chunks = [];
            while (buffer.length >= size) {
                chunks.push(convertFloat32ToInt16(buffer.splice(0, size)));
            }
            return chunks;
        },
        get pending() {
            return buffer.length;
        },
        reset() {
            buffer = [];
        },
    };
}

function buildManualScreenshotPrompt(responseLanguage = 'auto') {
    const raw = typeof responseLanguage === 'string' ? responseLanguage.trim() : '';
    const base = raw ? raw.split('-')[0].toLowerCase() : 'auto';
    const label =
        raw && base !== 'auto' ? MANUAL_SCREENSHOT_LANGUAGE_LABELS[raw.toLowerCase()] || MANUAL_SCREENSHOT_LANGUAGE_LABELS[base] || raw : '';
    const languageLine = label
        ? `Analyze the question or content on this screen and give a direct, accurate answer in ${label} (unless the question explicitly requires another language).`
        : 'Analyze the question or content on this screen and give a direct, accurate answer in the same language as the question.';

    return `${languageLine}
- Carefully verify all calculations, formulas, tables, and logic BEFORE writing the first line. Give one consistent, verified final verdict — never guess and revise it mid-message.
- If it is a multiple-choice question: put the verified correct option (or ALL correct options if multiple answers / checkboxes apply) in bold on the first line, then a concise justification on the lines below.
- If it is a coding question: give the approach in a few bullet points, then the complete code.
- If it is a general question about the page: give a concise, complete, readable answer.`;
}

module.exports = {
    MANUAL_SCREENSHOT_LANGUAGE_LABELS,
    convertFloat32ToInt16,
    arrayBufferToBase64,
    createPcmChunker,
    buildManualScreenshotPrompt,
};
