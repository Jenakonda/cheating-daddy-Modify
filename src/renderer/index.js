// Renderer entry point. Loaded by index.html as a classic script, so require() paths are relative to index.html.
const { ipcRenderer } = require('electron');
const { describeHealth } = require('./utils/cli-health.js');
const { storage, loadPreferencesCache } = require('./renderer/storage.js');
const { theme } = require('./renderer/theme.js');
const providers = require('./renderer/providers.js');
const capture = require('./renderer/capture.js');
const { presets, dataApi, copyText, escapeHtml, sanitizeHtml, exportSessionMarkdown, sessionMarkdown } = require('./renderer/ui-helpers.js');

const { isLinux, isMacOS } = capture;
const {
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
} = providers;
const { startCapture, stopCapture, sendTextMessage, handleShortcut, captureManualScreenshot } = capture;

// Create reference to the main app element
const cheatingDaddyApp = document.querySelector('cheating-daddy-app');

// Consolidated cheatingDaddy object - all functions in one place
const cheatingDaddy = {
    // App version
    getVersion: async () => ipcRenderer.invoke('get-app-version'),

    // Element access
    element: () => cheatingDaddyApp,
    e: () => cheatingDaddyApp,

    // App state functions - access properties directly from the app element
    getCurrentView: () => cheatingDaddyApp.currentView,
    getLayoutMode: () => cheatingDaddyApp.layoutMode,

    // Status and response functions
    setStatus: text => cheatingDaddyApp.setStatus(text),
    addNewResponse: response => cheatingDaddyApp.addNewResponse(response),
    updateCurrentResponse: response => cheatingDaddyApp.updateCurrentResponse(response),

    // Core functionality
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
    startCapture,
    stopCapture,
    sendTextMessage,
    handleShortcut,

    // Storage API
    storage,

    // Presets, data management, export and updates
    presets,
    data: dataApi,
    copyText,
    escapeHtml,
    sanitizeHtml,
    describeCliHealth: (entry, now = Date.now()) => describeHealth(entry, now),
    exportSessionMarkdown,
    sessionMarkdown,
    checkForUpdates: async () => ipcRenderer.invoke('check-for-updates'),

    // Theme API
    theme,

    // Context Folder API
    contextFolder: {
        getSummary: async (opts = {}) => ipcRenderer.invoke('context-folder:get-summary', opts),
        choose: async () => ipcRenderer.invoke('context-folder:choose'),
        open: async () => ipcRenderer.invoke('context-folder:open'),
        addFiles: async () => ipcRenderer.invoke('context-folder:add-files'),
        resetDefault: async () => ipcRenderer.invoke('context-folder:reset-default'),
    },

    // Refresh preferences cache (call after updating preferences)
    refreshPreferencesCache: loadPreferencesCache,

    // Platform detection
    isLinux: isLinux,
    isMacOS: isMacOS,
};

// Make it globally available
window.cheatingDaddy = cheatingDaddy;
// Used by the assistant view to trigger a manual screenshot
window.captureManualScreenshot = captureManualScreenshot;

// Load theme after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => theme.load());
} else {
    theme.load();
}
