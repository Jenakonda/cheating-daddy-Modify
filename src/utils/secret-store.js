// Encrypts API keys before they are written to disk. The encryption itself is done by Electron's safeStorage
// (Windows DPAPI, macOS Keychain, Linux keyring) and is injected, so this module can be tested without Electron.
//
// Stored format: a normal string value, or `enc:v1:<base64>` for an encrypted one. Plain values from older
// versions are still read and are encrypted the next time they are saved.

const PREFIX = 'enc:v1:';

// Fields that existed in older versions and are no longer used.
const REMOVED_FIELDS = ['cloudToken'];

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
}

function createSecretStore(safeStorage = null) {
    function isAvailable() {
        try {
            return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
        } catch {
            return false;
        }
    }

    function encryptValue(value) {
        if (typeof value !== 'string' || value === '' || isEncrypted(value) || !isAvailable()) {
            return value;
        }
        return PREFIX + Buffer.from(safeStorage.encryptString(value)).toString('base64');
    }

    function decryptValue(value) {
        if (!isEncrypted(value)) {
            return { value, ok: true };
        }
        try {
            return { value: safeStorage.decryptString(Buffer.from(value.slice(PREFIX.length), 'base64')), ok: true };
        } catch {
            return { value: '', ok: false };
        }
    }

    function encryptObject(object) {
        const result = {};
        for (const [key, value] of Object.entries(object || {})) {
            if (REMOVED_FIELDS.includes(key)) continue;
            result[key] = encryptValue(value);
        }
        return result;
    }

    /** Returns the readable values and the names of fields that could not be decrypted (never their contents). */
    function decryptObject(object) {
        const data = {};
        const unreadable = [];
        for (const [key, value] of Object.entries(object || {})) {
            if (REMOVED_FIELDS.includes(key)) continue;
            const decrypted = decryptValue(value);
            data[key] = decrypted.value;
            if (!decrypted.ok) unreadable.push(key);
        }
        return { data, unreadable };
    }

    /** True when the stored object holds plain values that could be encrypted, or fields that should be dropped. */
    function needsMigration(object) {
        if (!object || typeof object !== 'object') return false;
        if (REMOVED_FIELDS.some(key => key in object)) return true;
        if (!isAvailable()) return false;
        return Object.values(object).some(value => typeof value === 'string' && value !== '' && !isEncrypted(value));
    }

    /**
     * Builds the encrypted version of a stored object and checks that it decrypts back to the same values.
     * Returns null when that check fails, so the caller keeps the existing file untouched.
     */
    function buildVerifiedMigration(object) {
        const encrypted = encryptObject(object);
        const { data, unreadable } = decryptObject(encrypted);
        if (unreadable.length > 0) return null;

        for (const [key, value] of Object.entries(object)) {
            if (REMOVED_FIELDS.includes(key)) continue;
            if (data[key] !== decryptValue(value).value) return null;
        }
        return encrypted;
    }

    return { isAvailable, encryptValue, decryptValue, encryptObject, decryptObject, needsMigration, buildVerifiedMigration };
}

module.exports = { PREFIX, REMOVED_FIELDS, isEncrypted, createSecretStore };
