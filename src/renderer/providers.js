// Starting and controlling AI sessions (Gemini, local, CLI).
const { ipcRenderer } = require('electron');
const { storage, loadPreferencesCache } = require('./storage');

async function initializeGemini(profile = 'interview', language = 'en-US') {
    const apiKey = await storage.getApiKey();
    if (apiKey) {
        const prefs = await storage.getPreferences();
        const success = await ipcRenderer.invoke('initialize-gemini', apiKey, prefs.customPrompt || '', profile, language);
        if (success) {
            window.cheatingDaddy.setStatus('Live');
        } else {
            window.cheatingDaddy.setStatus('error');
        }
    }
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

async function initializeCli(profile = 'interview', language = null) {
    const prefs = await storage.getPreferences();
    const resolvedLanguage = language || prefs.selectedLanguage || 'auto';
    const options = {
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

    const success = await ipcRenderer.invoke('initialize-cli', options);
    if (!success) {
        window.cheatingDaddy.setStatus('error');
        return false;
    }
    return true;
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
    initializeLocal,
    cancelLocalInitialization,
    initializeCli,
    cancelCliInitialization,
    checkCliStatus,
    launchCliSetup,
    listCliModels,
    switchCliProvider,
    suggestCliContinuation,
};
