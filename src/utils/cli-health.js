const PROVIDERS = ['claude', 'gemini'];

function createEntry() {
    return { state: 'unknown', turns: 0, failures: 0, lastCode: null, lastError: null, lastErrorAt: null, lastOkAt: null };
}

function formatAgo(timestamp, now = Date.now()) {
    if (!timestamp) return '';
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} h ago`;
}

function stateFromCode(code) {
    switch (code) {
        case 'RATE_LIMIT':
            return 'limited';
        case 'AUTH_REQUIRED':
            return 'auth';
        case 'NOT_INSTALLED':
            return 'missing';
        default:
            return 'error';
    }
}

/** Tracks how each subscription CLI behaved during the current session. */
function createHealthTracker({ now = Date.now } = {}) {
    let entries = { claude: createEntry(), gemini: createEntry() };

    return {
        reset() {
            entries = { claude: createEntry(), gemini: createEntry() };
        },
        recordSuccess(provider) {
            const entry = entries[provider];
            if (!entry) return;
            entry.state = 'ok';
            entry.turns += 1;
            entry.lastOkAt = now();
        },
        recordFailure(provider, { code = null, message = '' } = {}) {
            const entry = entries[provider];
            if (!entry) return;
            entry.state = stateFromCode(code);
            entry.failures += 1;
            entry.lastCode = code;
            entry.lastError = String(message || '').slice(0, 300);
            entry.lastErrorAt = now();
        },
        snapshot() {
            return {
                claude: { ...entries.claude },
                gemini: { ...entries.gemini },
            };
        },
    };
}

/** Turns a tracker entry into a short label and a tone for the UI. */
function describeHealth(entry, now = Date.now()) {
    if (!entry || entry.state === 'unknown') {
        return { tone: 'idle', label: 'No requests yet' };
    }
    const ago = formatAgo(entry.lastErrorAt, now);
    switch (entry.state) {
        case 'ok':
            return { tone: 'ok', label: `Working · ${entry.turns} ${entry.turns === 1 ? 'reply' : 'replies'}` };
        case 'limited':
            return { tone: 'warn', label: `Rate limit reached ${ago}`.trim() };
        case 'auth':
            return { tone: 'danger', label: 'Sign-in required' };
        case 'missing':
            return { tone: 'danger', label: 'CLI not installed' };
        default:
            return { tone: 'danger', label: `Error ${ago}`.trim() };
    }
}

module.exports = {
    PROVIDERS,
    formatAgo,
    stateFromCode,
    createHealthTracker,
    describeHealth,
};
