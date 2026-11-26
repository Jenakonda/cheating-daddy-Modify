const fs = require('fs');
const path = require('path');
const os = require('os');

const { sanitizeCustomPresets } = require('./utils/presets');
const { createSecretStore } = require('./utils/secret-store');
const { sanitizeKeys } = require('./utils/api-keys');
const { DEFAULT_MIXED_ROUTES, normalizeMixedRoutes } = require('./utils/routing');
const { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_LIVE_MODEL, PREVIOUS_GEMINI_LIVE_MODEL } = require('./utils/gemini-models');
const { getDataUsage: measureDataUsage, clearDataCategory: clearDataCategoryOnDisk, pruneOldSessions } = require('./utils/data-usage');

const CONFIG_VERSION = 1;
// Raised when saved Gemini model defaults have to be replaced once
const GEMINI_DEFAULTS_VERSION = 2;

// Size of the answer text in pixels; the range matches the slider in Settings
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 32;

/** Older versions saved a word such as 'medium', which is not a size. */
function normalizeFontSize(value) {
    const size = Number.parseInt(value, 10);
    return Number.isFinite(size) ? Math.min(Math.max(size, MIN_FONT_SIZE), MAX_FONT_SIZE) : DEFAULT_FONT_SIZE;
}

// Default values
const DEFAULT_CONFIG = {
    configVersion: CONFIG_VERSION,
    onboarded: false,
    layout: 'normal',
    geminiLiveModel: DEFAULT_GEMINI_LIVE_MODEL,
    geminiModel: DEFAULT_GEMINI_MODEL,
    geminiDefaultsVersion: GEMINI_DEFAULTS_VERSION,
    groqModel: 'qwen/qwen3.6-27b',
    groqImageModel: 'qwen/qwen3.6-27b',
    disableGroqThinking: true,
};

const DEFAULT_CREDENTIALS = {
    apiKey: '',
    groqApiKey: '',
    // Backup keys, one per line (a single string, so it is encrypted like any other key)
    backupApiKeys: '',
    backupGroqApiKeys: '',
};

const DEFAULT_PREFERENCES = {
    customPrompt: '',
    providerMode: 'cli',
    mixedRoutes: DEFAULT_MIXED_ROUTES,
    selectedProfile: 'interview',
    customPresets: [],
    historyRetentionDays: 0,
    speechVocabulary: '',
    selectedLanguage: 'auto',
    responseLanguage: 'auto',
    contextFolderEnabled: true,
    contextFolderPath: '',
    selectedScreenshotInterval: '5',
    selectedImageQuality: 'medium',
    advancedMode: false,
    audioMode: 'speaker_only',
    fontSize: DEFAULT_FONT_SIZE,
    backgroundTransparency: 0.8,
    googleSearchEnabled: false,
    localLlmModel: 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M',
    whisperModel: 'small-q5_1',
    cliPrimaryProvider: 'claude',
    cliFallbackEnabled: true,
    cliClaudeModel: 'sonnet',
    cliClaudeEffort: 'auto',
    cliGeminiModel: 'gemini-4-hydrogen-low',
    cliClaudePath: '',
    cliGeminiPath: '',
    cliUseSubscriptionAuth: true,
    cliWhisperEnabled: true,
    cliMicContextOnly: true,
};

const DEFAULT_KEYBINDS = null; // null means use system defaults

const DEFAULT_LIMITS = {
    data: [], // Array of { date: 'YYYY-MM-DD', flash: { count }, flashLite: { count }, groq: { 'qwen3-32b': { chars, limit }, 'gpt-oss-120b': { chars, limit }, 'gpt-oss-20b': { chars, limit } }, gemini: { 'gemma-4-26b-a4b-it': { chars } } }
};

// Get the config directory path based on OS
function getConfigDir() {
    const platform = os.platform();
    let configDir;

    if (platform === 'win32') {
        configDir = path.join(os.homedir(), 'AppData', 'Roaming', 'cheating-daddy-config');
    } else if (platform === 'darwin') {
        configDir = path.join(os.homedir(), 'Library', 'Application Support', 'cheating-daddy-config');
    } else {
        configDir = path.join(os.homedir(), '.config', 'cheating-daddy-config');
    }

    return configDir;
}

// File paths
function getConfigPath() {
    return path.join(getConfigDir(), 'config.json');
}

function getDefaultContextDir() {
    return path.join(getConfigDir(), 'context');
}

function getCredentialsPath() {
    return path.join(getConfigDir(), 'credentials.json');
}

function getPreferencesPath() {
    return path.join(getConfigDir(), 'preferences.json');
}

function getKeybindsPath() {
    return path.join(getConfigDir(), 'keybinds.json');
}

function getLimitsPath() {
    return path.join(getConfigDir(), 'limits.json');
}

function getHistoryDir() {
    return path.join(getConfigDir(), 'history');
}

// Helper to read JSON file safely
function readJsonFile(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn(`Error reading ${filePath}:`, error.message);
    }
    return defaultValue;
}

// API keys are encrypted at rest once Electron's safeStorage is provided (see setSecretStore)
let secretStore = createSecretStore(null);

function setSecretStore(safeStorage) {
    secretStore = createSecretStore(safeStorage);
}

// Writes through a temporary file so a crash cannot leave a half-written credentials file
function writeJsonFileAtomic(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        try {
            fs.rmSync(tempPath, { force: true });
        } catch {
            // Ignore cleanup errors
        }
        return false;
    }
}

// Encrypts plain API keys that older versions saved. The file is replaced only after the encrypted copy
// has been decrypted again and matches, otherwise it is left exactly as it was.
function migrateCredentials() {
    const credentialsPath = getCredentialsPath();
    const raw = readJsonFile(credentialsPath, null);
    if (!raw || !secretStore.needsMigration(raw)) {
        return { migrated: false };
    }

    const encrypted = secretStore.buildVerifiedMigration(raw);
    if (!encrypted) {
        console.warn('Could not verify encrypted credentials, leaving the file unchanged');
        return { migrated: false, error: 'verification failed' };
    }
    return { migrated: writeJsonFileAtomic(credentialsPath, encrypted) };
}

// Moves profiles that still carry the old default Live model to the current one. Runs once,
// so a model the user picks later is never overwritten.
function migrateGeminiDefaults() {
    const saved = readJsonFile(getConfigPath(), null);
    if (!saved || saved.geminiDefaultsVersion >= GEMINI_DEFAULTS_VERSION) {
        return false;
    }
    if (saved.geminiLiveModel === PREVIOUS_GEMINI_LIVE_MODEL) {
        saved.geminiLiveModel = DEFAULT_GEMINI_LIVE_MODEL;
    }
    saved.geminiDefaultsVersion = GEMINI_DEFAULTS_VERSION;
    return writeJsonFile(getConfigPath(), saved);
}

// Helper to write JSON file safely
function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

// Check if we need to reset (no configVersion or wrong version)
function needsReset() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return true;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return !config.configVersion || config.configVersion !== CONFIG_VERSION;
    } catch {
        return true;
    }
}

// Wipe and reinitialize the config directory
function resetConfigDir() {
    const configDir = getConfigDir();

    console.log('Resetting config directory...');

    // Remove existing directory if it exists
    if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
    }

    // Create fresh directory structure
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(getHistoryDir(), { recursive: true });

    // Initialize with defaults
    writeJsonFile(getConfigPath(), DEFAULT_CONFIG);
    writeJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
    writeJsonFile(getPreferencesPath(), DEFAULT_PREFERENCES);

    console.log('Config directory initialized with defaults');
}

// Initialize storage - call this on app startup
function initializeStorage() {
    if (needsReset()) {
        resetConfigDir();
    } else {
        // Ensure history directory exists
        const historyDir = getHistoryDir();
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
    }

    migrateGeminiDefaults();

    try {
        const result = migrateCredentials();
        if (result.migrated) {
            console.log('Saved API keys are now encrypted');
        }
    } catch (error) {
        console.warn('Credentials migration failed:', error.message);
    }
}

// ============ CONFIG ============

function getConfig() {
    const saved = readJsonFile(getConfigPath(), {});
    return { ...DEFAULT_CONFIG, ...saved };
}

function setConfig(config) {
    const current = getConfig();
    const updated = { ...current, ...config, configVersion: CONFIG_VERSION };
    return writeJsonFile(getConfigPath(), updated);
}

function updateConfig(key, value) {
    const config = getConfig();
    config[key] = value;
    return writeJsonFile(getConfigPath(), config);
}

// ============ CREDENTIALS ============

function getCredentials() {
    const raw = readJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
    const { data, unreadable } = secretStore.decryptObject(raw);
    if (unreadable.length > 0) {
        console.warn(`Could not decrypt saved credentials (${unreadable.join(', ')}). They need to be entered again.`);
    }
    return { ...DEFAULT_CREDENTIALS, ...data };
}

function setCredentials(credentials) {
    const current = getCredentials();
    const updated = { ...current, ...credentials };
    return writeJsonFileAtomic(getCredentialsPath(), secretStore.encryptObject(updated));
}

function getApiKey() {
    return getCredentials().apiKey || '';
}

function setApiKey(apiKey) {
    return setCredentials({ apiKey });
}

function getGroqApiKey() {
    return getCredentials().groqApiKey || '';
}

function setGroqApiKey(groqApiKey) {
    return setCredentials({ groqApiKey });
}

const KEY_FIELDS = {
    gemini: { primary: 'apiKey', backup: 'backupApiKeys' },
    groq: { primary: 'groqApiKey', backup: 'backupGroqApiKeys' },
};

function getBackupKeys(provider) {
    const fields = KEY_FIELDS[provider];
    if (!fields) return [];
    return sanitizeKeys(String(getCredentials()[fields.backup] || '').split('\n'));
}

function setBackupKeys(provider, keys) {
    const fields = KEY_FIELDS[provider];
    if (!fields) return false;
    return setCredentials({ [fields.backup]: sanitizeKeys(keys).join('\n') });
}

/** Every usable key of a provider, the main one first. */
function getProviderKeys(provider) {
    const fields = KEY_FIELDS[provider];
    if (!fields) return [];
    return sanitizeKeys([getCredentials()[fields.primary], ...getBackupKeys(provider)]);
}

// ============ PREFERENCES ============

function getPreferences() {
    const saved = readJsonFile(getPreferencesPath(), {});
    const preferences = { ...DEFAULT_PREFERENCES, ...saved };
    const legacyWhisperModels = {
        'Xenova/whisper-tiny': 'tiny.en',
        'Xenova/whisper-base': 'base.en',
        'Xenova/whisper-small': 'small.en',
    };
    const legacyGeminiCliModels = {
        'gemini-2.5-flash': 'gemini-4-hydrogen-low',
        'gemini-2.5-pro': 'gemini-4-hydrogen-medium',
    };

    preferences.whisperModel = legacyWhisperModels[preferences.whisperModel] || preferences.whisperModel;
    preferences.cliGeminiModel = legacyGeminiCliModels[preferences.cliGeminiModel] || preferences.cliGeminiModel;
    preferences.customPresets = sanitizeCustomPresets(preferences.customPresets);
    preferences.mixedRoutes = normalizeMixedRoutes(preferences.mixedRoutes);
    preferences.fontSize = normalizeFontSize(preferences.fontSize);
    return preferences;
}

function normalizePreferenceValue(key, value) {
    if (key === 'customPresets') {
        return sanitizeCustomPresets(value);
    }
    if (key === 'fontSize') {
        return normalizeFontSize(value);
    }
    if (key === 'mixedRoutes') {
        return normalizeMixedRoutes(value);
    }
    if (key === 'speechVocabulary') {
        return String(value ?? '')
            .replace(/[\u0000-\u001f\u007f]+/g, ' ')
            .trim()
            .slice(0, 400);
    }
    if (key === 'historyRetentionDays') {
        const days = Number(value);
        return Number.isFinite(days) && days > 0 ? Math.min(Math.round(days), 3650) : 0;
    }
    return value;
}

function setPreferences(preferences) {
    const current = getPreferences();
    const incoming = {};
    for (const [key, value] of Object.entries(preferences || {})) {
        incoming[key] = normalizePreferenceValue(key, value);
    }
    const updated = { ...current, ...incoming };
    return writeJsonFile(getPreferencesPath(), updated);
}

function updatePreference(key, value) {
    const preferences = getPreferences();
    preferences[key] = normalizePreferenceValue(key, value);
    return writeJsonFile(getPreferencesPath(), preferences);
}

// ============ KEYBINDS ============

function getKeybinds() {
    return readJsonFile(getKeybindsPath(), DEFAULT_KEYBINDS);
}

function setKeybinds(keybinds) {
    return writeJsonFile(getKeybindsPath(), keybinds);
}

// ============ LIMITS (Rate Limiting) ============

function getLimits() {
    return readJsonFile(getLimitsPath(), DEFAULT_LIMITS);
}

function setLimits(limits) {
    return writeJsonFile(getLimitsPath(), limits);
}

function getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTodayLimits() {
    const limits = getLimits();
    const today = getTodayDateString();

    // Find today's entry
    const todayEntry = limits.data.find(entry => entry.date === today);

    if (todayEntry) {
        // ensure new fields exist
        if (!todayEntry.groq) {
            todayEntry.groq = {
                'qwen3-32b': { chars: 0, limit: 1500000 },
                'gpt-oss-120b': { chars: 0, limit: 600000 },
                'gpt-oss-20b': { chars: 0, limit: 600000 },
                'kimi-k2-instruct': { chars: 0, limit: 600000 },
            };
        }
        if (!todayEntry.gemini) {
            todayEntry.gemini = {
                'gemma-4-26b-a4b-it': { chars: 0 },
            };
        }
        setLimits(limits);
        return todayEntry;
    }

    // No entry for today - clean old entries and create new one
    limits.data = limits.data.filter(entry => entry.date === today);
    const newEntry = {
        date: today,
        flash: { count: 0 },
        flashLite: { count: 0 },
        groq: {
            'qwen3-32b': { chars: 0, limit: 1500000 },
            'gpt-oss-120b': { chars: 0, limit: 600000 },
            'gpt-oss-20b': { chars: 0, limit: 600000 },
            'kimi-k2-instruct': { chars: 0, limit: 600000 },
        },
        gemini: {
            'gemma-4-26b-a4b-it': { chars: 0 },
        },
    };
    limits.data.push(newEntry);
    setLimits(limits);

    return newEntry;
}

function incrementCharUsage(provider, model, charCount) {
    getTodayLimits();

    const limits = getLimits();
    const today = getTodayDateString();
    const todayEntry = limits.data.find(entry => entry.date === today);

    if (todayEntry[provider] && todayEntry[provider][model]) {
        todayEntry[provider][model].chars += charCount;
        setLimits(limits);
    }

    return todayEntry;
}

function getModelForToday() {
    const todayEntry = getTodayLimits();
    const groq = todayEntry.groq;

    if (groq['gpt-oss-120b'].chars < groq['gpt-oss-120b'].limit) {
        return 'openai/gpt-oss-120b';
    }
    if (groq['gpt-oss-20b'].chars < groq['gpt-oss-20b'].limit) {
        return 'openai/gpt-oss-20b';
    }
    if (groq['kimi-k2-instruct'].chars < groq['kimi-k2-instruct'].limit) {
        return 'moonshotai/kimi-k2-instruct';
    }

    // All limits exhausted
    return null;
}

// ============ HISTORY ============

function getSessionPath(sessionId) {
    return path.join(getHistoryDir(), `${sessionId}.json`);
}

function saveSession(sessionId, data) {
    const sessionPath = getSessionPath(sessionId);

    // Load existing session to preserve metadata
    const existingSession = readJsonFile(sessionPath, null);

    const sessionData = {
        sessionId,
        createdAt: existingSession?.createdAt || parseInt(sessionId),
        lastUpdated: Date.now(),
        // Profile context - set once when session starts
        profile: data.profile || existingSession?.profile || null,
        customPrompt: data.customPrompt || existingSession?.customPrompt || null,
        // Conversation data
        conversationHistory: data.conversationHistory || existingSession?.conversationHistory || [],
        screenAnalysisHistory: data.screenAnalysisHistory || existingSession?.screenAnalysisHistory || [],
    };
    return writeJsonFile(sessionPath, sessionData);
}

function getSession(sessionId) {
    return readJsonFile(getSessionPath(sessionId), null);
}

function getAllSessions() {
    const historyDir = getHistoryDir();

    try {
        if (!fs.existsSync(historyDir)) {
            return [];
        }

        const files = fs
            .readdirSync(historyDir)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => {
                // Sort by timestamp descending (newest first)
                const tsA = parseInt(a.replace('.json', ''));
                const tsB = parseInt(b.replace('.json', ''));
                return tsB - tsA;
            });

        return files
            .map(file => {
                const sessionId = file.replace('.json', '');
                const data = readJsonFile(path.join(historyDir, file), null);
                if (data) {
                    return {
                        sessionId,
                        createdAt: data.createdAt,
                        lastUpdated: data.lastUpdated,
                        messageCount: data.conversationHistory?.length || 0,
                        screenAnalysisCount: data.screenAnalysisHistory?.length || 0,
                        profile: data.profile || null,
                        customPrompt: data.customPrompt || null,
                    };
                }
                return null;
            })
            .filter(Boolean);
    } catch (error) {
        console.error('Error reading sessions:', error.message);
        return [];
    }
}

function deleteSession(sessionId) {
    const sessionPath = getSessionPath(sessionId);
    try {
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            return true;
        }
    } catch (error) {
        console.error('Error deleting session:', error.message);
    }
    return false;
}

function deleteAllSessions() {
    const historyDir = getHistoryDir();
    try {
        if (fs.existsSync(historyDir)) {
            const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
            files.forEach(file => {
                fs.unlinkSync(path.join(historyDir, file));
            });
        }
        return true;
    } catch (error) {
        console.error('Error deleting all sessions:', error.message);
        return false;
    }
}

// ============ DATA MANAGEMENT ============

function getDataUsage() {
    return measureDataUsage(getConfigDir());
}

function clearDataCategory(categoryId) {
    return clearDataCategoryOnDisk(getConfigDir(), categoryId);
}

function pruneHistory() {
    const days = getPreferences().historyRetentionDays;
    return pruneOldSessions(getHistoryDir(), days);
}

// ============ CLEAR ALL DATA ============

function clearAllData() {
    resetConfigDir();
    return true;
}

module.exports = {
    // Initialization
    initializeStorage,
    setSecretStore,
    migrateCredentials,
    getConfigDir,
    getDefaultContextDir,

    // Config
    getConfig,
    setConfig,
    updateConfig,

    // Credentials
    getCredentials,
    setCredentials,
    getApiKey,
    setApiKey,
    getGroqApiKey,
    setGroqApiKey,
    getBackupKeys,
    setBackupKeys,
    getProviderKeys,

    // Preferences
    getPreferences,
    setPreferences,
    updatePreference,

    // Keybinds
    getKeybinds,
    setKeybinds,

    // Limits (Rate Limiting)
    getLimits,
    setLimits,
    getTodayLimits,
    incrementCharUsage,
    getModelForToday,

    // History
    saveSession,
    getSession,
    getAllSessions,
    deleteSession,
    deleteAllSessions,

    // Data management
    getDataUsage,
    clearDataCategory,
    pruneHistory,

    // Clear all
    clearAllData,
};
