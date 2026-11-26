// Backup API keys: when a key is rate-limited or rejected, the next one takes over.
// No Electron imports, so it can be tested in Node.
const { getErrorCode } = require('./gemini-models');

const MAX_KEY_LENGTH = 300;
const KEY_ERROR_PATTERN =
    /quota|resource[ _]has[ _]been[ _]exhausted|resource_exhausted|rate[ _]limit|too many requests|api[ _]key|api_key_invalid|permission[ _]denied|unauthenticated|billing/i;

/** Cleans a list of keys: strings only, no spaces or line breaks, no duplicates. */
function sanitizeKeys(keys) {
    if (!Array.isArray(keys)) return [];
    const cleaned = keys
        .map(key => (typeof key === 'string' ? key.replace(/[\s\u0000-\u001f\u007f]+/g, '') : ''))
        .filter(key => key !== '' && key.length <= MAX_KEY_LENGTH);
    return [...new Set(cleaned)];
}

/** True when another key could succeed where this one failed. Takes an API error or a close reason. */
function isKeyError(error) {
    if (!error) return false;
    const code = getErrorCode(error);
    if ([401, 403, 429].includes(code)) return true;
    // A busy or broken service fails for every key
    if (code >= 500) return false;
    return KEY_ERROR_PATTERN.test(String(error.message || error));
}

/** Remembers, per provider, which key worked last, so an exhausted key is not asked first every time. */
function createKeyRing() {
    const preferred = new Map();

    /** The keys, starting with the preferred one. */
    function order(provider, keys) {
        const start = Math.max(0, keys.indexOf(preferred.get(provider)));
        return [...keys.slice(start), ...keys.slice(0, start)];
    }

    function markWorking(provider, key) {
        preferred.set(provider, key);
    }

    /**
     * Calls attempt(key) with one key after another until one works. Errors that another key cannot fix
     * are thrown at once; when every key fails the first error is thrown.
     */
    async function run(provider, keys, attempt, onSwitch = () => {}) {
        const queue = order(provider, keys);
        let firstError = new Error('No API key configured');
        for (let index = 0; index < queue.length; index++) {
            try {
                const result = await attempt(queue[index]);
                markWorking(provider, queue[index]);
                return result;
            } catch (error) {
                if (!isKeyError(error)) throw error;
                if (index === 0) firstError = error;
                if (index + 1 < queue.length) onSwitch(keys.indexOf(queue[index + 1]));
            }
        }
        throw firstError;
    }

    return { order, markWorking, run };
}

module.exports = { MAX_KEY_LENGTH, sanitizeKeys, isKeyError, createKeyRing };
