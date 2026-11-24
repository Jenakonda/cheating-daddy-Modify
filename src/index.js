if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, globalShortcut, shell, ipcMain } = require('electron');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const { loadContextFolder, summarizeContextBundle, copyFilesIntoContextFolder, clearContextCache } = require('./utils/context-folder');
const storage = require('./storage');
const { checkForUpdates } = require('./utils/update-check');
const { formatBytes } = require('./utils/data-usage');

const MAX_EXPORT_BYTES = 5 * 1024 * 1024;

const geminiSessionRef = { current: null };
let mainWindow = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef);
    return mainWindow;
}

if (hasSingleInstanceLock) {
    app.whenReady().then(async () => {
        // Initialize storage (checks version, resets if needed)
        storage.initializeStorage();

        // Apply the history retention setting (does nothing when retention is off)
        try {
            const removed = storage.pruneHistory();
            if (removed > 0) {
                console.log(`Removed ${removed} saved session(s) older than the retention period`);
            }
        } catch (error) {
            console.warn('History pruning failed:', error.message);
        }

        // Trigger screen recording permission prompt on macOS if not already granted
        if (process.platform === 'darwin') {
            const { desktopCapturer } = require('electron');
            desktopCapturer.getSources({ types: ['screen'] }).catch(() => {});
        }

        createMainWindow();
        setupGeminiIpcHandlers(geminiSessionRef);
        setupStorageIpcHandlers();
        setupGeneralIpcHandlers();
        setupContextFolderIpcHandlers();
    });
}

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    require('./utils/localai').closeLocalSession();
    require('./utils/cliai').closeCliSession();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupStorageIpcHandlers() {
    // ============ CONFIG ============
    ipcMain.handle('storage:get-config', async () => {
        try {
            return { success: true, data: storage.getConfig() };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-config', async (event, config) => {
        try {
            storage.setConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-config', async (event, key, value) => {
        try {
            storage.updateConfig(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CREDENTIALS ============
    ipcMain.handle('storage:get-credentials', async () => {
        try {
            return { success: true, data: storage.getCredentials() };
        } catch (error) {
            console.error('Error getting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-credentials', async (event, credentials) => {
        try {
            storage.setCredentials(credentials);
            return { success: true };
        } catch (error) {
            console.error('Error setting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-api-key', async () => {
        try {
            return { success: true, data: storage.getApiKey() };
        } catch (error) {
            console.error('Error getting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-api-key', async (event, apiKey) => {
        try {
            storage.setApiKey(apiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-groq-api-key', async () => {
        try {
            return { success: true, data: storage.getGroqApiKey() };
        } catch (error) {
            console.error('Error getting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-groq-api-key', async (event, groqApiKey) => {
        try {
            storage.setGroqApiKey(groqApiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PREFERENCES ============
    ipcMain.handle('storage:get-preferences', async () => {
        try {
            return { success: true, data: storage.getPreferences() };
        } catch (error) {
            console.error('Error getting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-preferences', async (event, preferences) => {
        try {
            storage.setPreferences(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error setting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-preference', async (event, key, value) => {
        try {
            storage.updatePreference(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating preference:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ KEYBINDS ============
    ipcMain.handle('storage:get-keybinds', async () => {
        try {
            return { success: true, data: storage.getKeybinds() };
        } catch (error) {
            console.error('Error getting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-keybinds', async (event, keybinds) => {
        try {
            storage.setKeybinds(keybinds);
            return { success: true };
        } catch (error) {
            console.error('Error setting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ HISTORY ============
    ipcMain.handle('storage:get-all-sessions', async () => {
        try {
            return { success: true, data: storage.getAllSessions() };
        } catch (error) {
            console.error('Error getting sessions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-session', async (event, sessionId) => {
        try {
            return { success: true, data: storage.getSession(sessionId) };
        } catch (error) {
            console.error('Error getting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-session', async (event, sessionId, data) => {
        try {
            storage.saveSession(sessionId, data);
            return { success: true };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-session', async (event, sessionId) => {
        try {
            storage.deleteSession(sessionId);
            return { success: true };
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-all-sessions', async () => {
        try {
            storage.deleteAllSessions();
            return { success: true };
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ LIMITS ============
    ipcMain.handle('storage:get-today-limits', async () => {
        try {
            return { success: true, data: storage.getTodayLimits() };
        } catch (error) {
            console.error('Error getting today limits:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ DATA MANAGEMENT ============
    ipcMain.handle('data:get-usage', async () => {
        try {
            const usage = storage.getDataUsage().map(item => ({ ...item, size: formatBytes(item.bytes) }));
            return { success: true, data: usage };
        } catch (error) {
            console.error('Error reading data usage:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('data:clear-category', async (event, categoryId) => {
        if (typeof categoryId !== 'string') {
            return { success: false, error: 'Invalid category' };
        }
        try {
            return storage.clearDataCategory(categoryId);
        } catch (error) {
            console.error('Error clearing data category:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('data:prune-history', async () => {
        try {
            return { success: true, removed: storage.pruneHistory() };
        } catch (error) {
            console.error('Error pruning history:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CLEAR ALL ============
    ipcMain.handle('storage:clear-all', async () => {
        try {
            storage.clearAllData();
            return { success: true };
        } catch (error) {
            console.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    });
}

function setupGeneralIpcHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('check-for-updates', async () => {
        return checkForUpdates({ currentVersion: app.getVersion() });
    });

    ipcMain.handle('export:save-markdown', async (event, payload = {}) => {
        try {
            const content = typeof payload.content === 'string' ? payload.content : '';
            if (!content || Buffer.byteLength(content, 'utf8') > MAX_EXPORT_BYTES) {
                return { success: false, error: 'Nothing to export or the export is too large' };
            }

            const rawName = typeof payload.fileName === 'string' ? payload.fileName : 'cheating-daddy-session.md';
            const safeName = path.basename(rawName).replace(/[^\w.\- ]+/g, '_') || 'cheating-daddy-session.md';
            const dialogParent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
            const result = await dialog.showSaveDialog(dialogParent, {
                title: 'Export session',
                defaultPath: path.join(app.getPath('documents'), safeName),
                filters: [{ name: 'Markdown', extensions: ['md'] }],
            });
            if (result.canceled || !result.filePath) {
                return { success: true, canceled: true };
            }

            await fs.promises.writeFile(result.filePath, content, 'utf8');
            return { success: true, canceled: false, path: result.filePath };
        } catch (error) {
            console.error('Error exporting session:', error);
            return { success: false, error: error.message };
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });
}

function resolveActiveContextFolder() {
    const prefs = storage.getPreferences() || {};
    const customPath = typeof prefs.contextFolderPath === 'string' ? prefs.contextFolderPath.trim() : '';
    const isDefault = !customPath;
    const folderPath = isDefault ? storage.getDefaultContextDir() : path.resolve(customPath);
    const enabled = prefs.contextFolderEnabled !== false;
    return { folderPath, isDefault, enabled };
}

function setupContextFolderIpcHandlers() {
    ipcMain.handle('context-folder:get-summary', async (event, opts = {}) => {
        try {
            const { folderPath, isDefault, enabled } = resolveActiveContextFolder();
            if (isDefault && !fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            if (opts && opts.refresh) {
                clearContextCache();
            }
            const bundle = await loadContextFolder(folderPath);
            return {
                success: true,
                data: summarizeContextBundle(bundle, { isDefault, enabled }),
            };
        } catch (error) {
            console.error('Error getting context folder summary:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('context-folder:choose', async () => {
        try {
            const { folderPath: currentFolder } = resolveActiveContextFolder();
            const dialogParent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
            const result = await dialog.showOpenDialog(dialogParent, {
                title: 'Select Context Folder',
                defaultPath: fs.existsSync(currentFolder) ? currentFolder : undefined,
                properties: ['openDirectory', 'createDirectory'],
            });
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return { success: true, canceled: true };
            }

            const chosenPath = path.resolve(result.filePaths[0]);
            if (!fs.existsSync(chosenPath) || !fs.statSync(chosenPath).isDirectory()) {
                return { success: false, error: 'Selected path is not a directory' };
            }

            storage.updatePreference('contextFolderPath', chosenPath);
            storage.updatePreference('contextFolderEnabled', true);
            clearContextCache();

            const bundle = await loadContextFolder(chosenPath);
            return {
                success: true,
                canceled: false,
                data: summarizeContextBundle(bundle, { isDefault: false, enabled: true }),
            };
        } catch (error) {
            console.error('Error choosing context folder:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('context-folder:open', async () => {
        try {
            const { folderPath, isDefault } = resolveActiveContextFolder();
            if (isDefault && !fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
                return { success: false, error: 'Context folder does not exist' };
            }
            const errMsg = await shell.openPath(folderPath);
            if (errMsg) {
                return { success: false, error: errMsg };
            }
            return { success: true, path: folderPath };
        } catch (error) {
            console.error('Error opening context folder:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('context-folder:add-files', async () => {
        try {
            const { folderPath, isDefault, enabled } = resolveActiveContextFolder();
            const dialogParent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
            const result = await dialog.showOpenDialog(dialogParent, {
                title: 'Add Reference Files to Context Folder',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    {
                        name: 'Documents & Presentations',
                        extensions: ['pdf', 'pptx', 'docx', 'xlsx', 'odt', 'odp', 'rtf', 'md', 'txt', 'html', 'csv', 'json', 'yaml', 'yml'],
                    },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return { success: true, canceled: true };
            }

            if (isDefault && !fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            const { copied, skipped } = copyFilesIntoContextFolder(folderPath, result.filePaths);
            const bundle = await loadContextFolder(folderPath);
            return {
                success: true,
                canceled: false,
                copied,
                skipped,
                data: summarizeContextBundle(bundle, { isDefault, enabled }),
            };
        } catch (error) {
            console.error('Error adding files to context folder:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('context-folder:reset-default', async () => {
        try {
            storage.updatePreference('contextFolderPath', '');
            const defaultDir = storage.getDefaultContextDir();
            if (!fs.existsSync(defaultDir)) {
                fs.mkdirSync(defaultDir, { recursive: true });
            }
            clearContextCache();
            const prefs = storage.getPreferences() || {};
            const bundle = await loadContextFolder(defaultDir);
            return {
                success: true,
                data: summarizeContextBundle(bundle, { isDefault: true, enabled: prefs.contextFolderEnabled !== false }),
            };
        } catch (error) {
            console.error('Error resetting context folder:', error);
            return { success: false, error: error.message };
        }
    });
}
