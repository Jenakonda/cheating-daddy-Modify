// Starting and controlling AI sessions (Gemini, local, CLI).
const { ipcRenderer } = require('electron');
const { storage, loadPreferencesCache } = require('./storage');

// The main process reads the saved keys itself, including the backup ones
async function initializeGemini(profile = 'interview', language = 'en-US') {
    const prefs = await storage.getPreferences();
    const result = await ipcRenderer.invoke('initialize-gemini', prefs.customPrompt || '', profile, language);
    window.cheatingDaddy.setStatus(result.success ? 'Live' : 'error');
    return result;
}

async function listGeminiModels() {
    return ipcRenderer.invoke('gemini:list-models');
}

async function initializeLocal(profile = 'interview') {
    const prefs = await storage.getPreferences();
    const localLlmModel = prefs.localLlmModel || 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M';
    const whisperModel = prefs.whisperModel || 'tiny.en';
    const customPrompt = prefs.customPrompt || '';

    const success = await ipcRenderer.invoke('initialize-local', localLlmModel, whisperModel, profile, customPrompt);
    if (success) {
        window.cheatingDaddy.setStatus('Local AI Live');
        return true;
    } else {
        window.cheatingDaddy.setStatus('error');
        return false;
    }
}

async function cancelLocalInitialization() {
    return ipcRenderer.invoke('cancel-local-initialization');
}

function buildCliOptions(prefs, profile, language) {
    const resolvedLanguage = language || prefs.selectedLanguage || 'auto';
    return {
        primaryProvider: prefs.cliPrimaryProvider || 'claude',
        fallbackEnabled: prefs.cliFallbackEnabled ?? true,
        useSubscriptionAuth: prefs.cliUseSubscriptionAuth ?? true,
        whisperEnabled: prefs.cliWhisperEnabled ?? true,
        whisperModel: prefs.whisperModel || 'small-q5_1',
        claudeModel: prefs.cliClaudeModel || 'sonnet',
        claudeEffort: prefs.cliClaudeEffort || 'auto',
        geminiModel: prefs.cliGeminiModel || 'gemini-4-hydrogen-low',
        claudePath: prefs.cliClaudePath || '',
        geminiPath: prefs.cliGeminiPath || '',
        profile,
        customPrompt: prefs.customPrompt || '',
        language: resolvedLanguage,
        responseLanguage: prefs.responseLanguage || 'auto',
        contextFolderEnabled: prefs.contextFolderEnabled ?? true,
        contextFolderPath: prefs.contextFolderPath || '',
        googleSearchEnabled: prefs.googleSearchEnabled ?? false,
        audioMode: prefs.audioMode || 'speaker_only',
        micContextOnly: prefs.cliMicContextOnly ?? true,
    };
}

async function initializeCli(profile = 'interview', language = null) {
    const prefs = await storage.getPreferences();
    const success = await ipcRenderer.invoke('initialize-cli', buildCliOptions(prefs, profile, language));
    if (!success) {
        window.cheatingDaddy.setStatus('error');
        return false;
    }
    return true;
}

// CLI and API together; which one serves what is read from the saved routes
async function initializeMixed(profile = 'interview', language = null) {
    const prefs = await storage.getPreferences();
    const result = await ipcRenderer.invoke('initialize-mixed', buildCliOptions(prefs, profile, language));
    if (!result.success) {
        window.cheatingDaddy.setStatus('error');
    }
    return result;
}

async function cancelCliInitialization() {
    return ipcRenderer.invoke('cancel-cli-initialization');
}

async function checkCliStatus(paths = {}) {
    const result = await ipcRenderer.invoke('cli:check-status', paths);
    return result.success ? result.data : null;
}

async function launchCliSetup(options = {}) {
    return ipcRenderer.invoke('cli:launch-setup', options);
}

async function listCliModels(options = {}) {
    const result = await ipcRenderer.invoke('cli:list-models', options);
    return result.success ? result.data : null;
}

async function switchCliProvider(provider) {
    return ipcRenderer.invoke('cli:switch-provider', provider);
}

async function suggestCliContinuation() {
    return ipcRenderer.invoke('cli:suggest-continuation');
}

module.exports = {
    initializeGemini,
    listGeminiModels,
    initializeLocal,
    cancelLocalInitialization,
    initializeCli,
    initializeMixed,
    cancelCliInitialization,
    checkCliStatus,
    launchCliSetup,
    listCliModels,
    switchCliProvider,
    suggestCliContinuation,
};
