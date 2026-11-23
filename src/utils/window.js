const { BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('node:path');
const storage = require('../storage');

let mouseEventsIgnored = false;

const DEFAULT_MAIN_WINDOW_SIZE = { width: 1100, height: 800 };
const MIN_WINDOW_SIZE = { width: 700, height: 320 };

function createWindow(sendToRenderer, geminiSessionRef) {
    let windowWidth = DEFAULT_MAIN_WINDOW_SIZE.width;
    let windowHeight = DEFAULT_MAIN_WINDOW_SIZE.height;

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        minWidth: MIN_WINDOW_SIZE.width,
        minHeight: MIN_WINDOW_SIZE.height,
        resizable: true,
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: process.platform === 'win32',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: change to true
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#00000000',
    });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setContentProtection(true);
    if (process.platform === 'win32') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    // Hide from Windows taskbar
    if (process.platform === 'win32') {
        try {
            mainWindow.setSkipTaskbar(true);
        } catch (error) {
            console.warn('Could not hide from taskbar:', error.message);
        }
    }

    // Hide from Mission Control on macOS
    if (process.platform === 'darwin') {
        try {
            mainWindow.setHiddenInMissionControl(true);
        } catch (error) {
            console.warn('Could not hide from Mission Control:', error.message);
        }
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // After window is created, initialize keybinds
    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            // Load keybinds from storage
            const savedKeybinds = storage.getKeybinds();
            if (savedKeybinds) {
                keybinds = { ...defaultKeybinds, ...savedKeybinds };
            }

            updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }, 150);
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef);

    return mainWindow;
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
        moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
        moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
        moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        emergencyErase: isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
    };
}

function registerGlobalShortcut(accelerator, actionName, callback) {
    try {
        const registered = globalShortcut.register(accelerator, callback);
        if (registered) {
            console.log(`Registered ${actionName}: ${accelerator}`);
        } else {
            console.warn(`Global shortcut ${actionName} (${accelerator}) is already claimed by Windows or another app`);
        }
        return registered;
    } catch (error) {
        console.error(`Failed to register ${actionName} (${accelerator}):`, error);
        return false;
    }
}

function dispatchToMainWindow(mainWindow, sendToRenderer, channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
        return;
    }
    sendToRenderer(channel, data);
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = Math.floor(Math.min(width, height) * 0.1);

    const movementActions = {
        moveUp: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY - moveIncrement);
        },
        moveDown: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY + moveIncrement);
        },
        moveLeft: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX - moveIncrement, currentY);
        },
        moveRight: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX + moveIncrement, currentY);
        },
    };

    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            registerGlobalShortcut(keybind, action, movementActions[action]);
        }
    });

    // Register toggle visibility shortcut
    if (keybinds.toggleVisibility) {
        registerGlobalShortcut(keybinds.toggleVisibility, 'toggleVisibility', () => {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
        });
    }

    // Register toggle click-through shortcut
    if (keybinds.toggleClickThrough) {
        registerGlobalShortcut(keybinds.toggleClickThrough, 'toggleClickThrough', () => {
            mouseEventsIgnored = !mouseEventsIgnored;
            if (mouseEventsIgnored) {
                mainWindow.setIgnoreMouseEvents(true, { forward: true });
                console.log('Mouse events ignored');
            } else {
                mainWindow.setIgnoreMouseEvents(false);
                console.log('Mouse events enabled');
            }
            mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
        });
    }

    // Register next step shortcut (either starts session or takes screenshot based on view)
    if (keybinds.nextStep) {
        registerGlobalShortcut(keybinds.nextStep, 'nextStep', async () => {
            console.log('Next step shortcut triggered');
            try {
                // Determine the shortcut key format
                const isMac = process.platform === 'darwin';
                const shortcutKey = isMac ? 'cmd+enter' : 'ctrl+enter';

                // Use the new handleShortcut function
                mainWindow.webContents.executeJavaScript(`
                    cheatingDaddy.handleShortcut('${shortcutKey}');
                `);
            } catch (error) {
                console.error('Error handling next step shortcut:', error);
            }
        });
    }

    // Register previous response shortcut
    if (keybinds.previousResponse) {
        registerGlobalShortcut(keybinds.previousResponse, 'previousResponse', () => {
            console.log('Previous response shortcut triggered');
            dispatchToMainWindow(mainWindow, sendToRenderer, 'navigate-previous-response');
        });
    }

    // Register next response shortcut
    if (keybinds.nextResponse) {
        registerGlobalShortcut(keybinds.nextResponse, 'nextResponse', () => {
            console.log('Next response shortcut triggered');
            dispatchToMainWindow(mainWindow, sendToRenderer, 'navigate-next-response');
        });
    }

    // Register scroll up shortcut
    if (keybinds.scrollUp) {
        registerGlobalShortcut(keybinds.scrollUp, 'scrollUp', () => {
            console.log('Scroll up shortcut triggered');
            dispatchToMainWindow(mainWindow, sendToRenderer, 'scroll-response-up');
        });
    }

    // Register scroll down shortcut
    if (keybinds.scrollDown) {
        registerGlobalShortcut(keybinds.scrollDown, 'scrollDown', () => {
            console.log('Scroll down shortcut triggered');
            dispatchToMainWindow(mainWindow, sendToRenderer, 'scroll-response-down');
        });
    }

    // Register emergency erase shortcut
    if (keybinds.emergencyErase) {
        registerGlobalShortcut(keybinds.emergencyErase, 'emergencyErase', () => {
            console.log('Emergency Erase triggered!');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.hide();

                if (geminiSessionRef.current) {
                    geminiSessionRef.current.close();
                    geminiSessionRef.current = null;
                }

                try {
                    require('./localai').closeLocalSession();
                } catch {
                    // Ignore cleanup error during emergency erase
                }

                try {
                    require('./cliai').closeCliSession();
                } catch {
                    // Ignore cleanup error during emergency erase
                }

                dispatchToMainWindow(mainWindow, sendToRenderer, 'clear-sensitive-data');

                setTimeout(() => {
                    const { app } = require('electron');
                    app.quit();
                }, 300);
            }
        });
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef) {
    ipcMain.on('view-changed', (event, view) => {
        if (!mainWindow.isDestroyed()) {
            const isLiveMode = view === 'assistant';

            if (process.platform !== 'win32') {
                mainWindow.setAlwaysOnTop(isLiveMode);
                mainWindow.setVisibleOnAllWorkspaces(isLiveMode, { visibleOnFullScreen: isLiveMode });
            }

            if (!isLiveMode) {
                mainWindow.setIgnoreMouseEvents(false);
            }
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            storage.setKeybinds(newKeybinds);
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling window visibility:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
