const MAX_URL_LENGTH = 2048;

/** Only plain web links may be opened in the user's browser. Everything else (file:, custom protocols) is refused. */
function isSafeExternalUrl(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
        return false;
    }
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

module.exports = { isSafeExternalUrl };
