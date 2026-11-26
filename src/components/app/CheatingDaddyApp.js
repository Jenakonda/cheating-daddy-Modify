import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AICustomizeView } from '../views/AICustomizeView.js';

export class CheatingDaddyApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: var(--font);
            margin: 0;
            padding: 0;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            overflow: hidden;
            border-radius: 12px;
            background: var(--bg-app);
            color: var(--text-primary);
        }

        /* ── Full app shell: top bar + sidebar/content ── */

        .app-shell {
            display: flex;
            height: calc(100vh - 2px);
            margin: 1px;
            overflow: hidden;
            border: 1px solid var(--border-strong);
            border-radius: 11px;
        }

        .top-drag-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            height: 38px;
            background: transparent;
        }

        .drag-region {
            flex: 1;
            height: 100%;
            -webkit-app-region: drag;
        }

        .top-drag-bar.hidden {
            display: none;
        }

        .window-controls {
            display: flex;
            align-items: center;
            gap: 2px;
            padding: 0 var(--space-sm);
            height: 100%;
            -webkit-app-region: no-drag;
        }

        .wc-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 26px;
            border: none;
            border-radius: var(--radius-sm);
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            transition:
                background var(--transition),
                color var(--transition);
        }

        .wc-btn svg {
            width: 14px;
            height: 14px;
        }

        .wc-btn:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
        }

        .wc-btn.close:hover {
            background: var(--danger);
            color: #ffffff;
        }

        .sidebar {
            width: var(--sidebar-width);
            min-width: var(--sidebar-width);
            background: var(--bg-app);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: var(--space-md) 0 var(--space-md) 0;
            transition:
                width var(--transition),
                min-width var(--transition),
                opacity var(--transition);
        }

        .sidebar.hidden {
            width: 0;
            min-width: 0;
            padding: 0;
            overflow: hidden;
            border-right: none;
            opacity: 0;
        }

        .sidebar-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 var(--space-md);
            margin-bottom: var(--space-lg);
            height: 28px;
        }

        .brand-mark {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: var(--radius-md);
            background: var(--accent-soft);
            color: var(--accent);
        }

        .brand-mark svg {
            width: 15px;
            height: 15px;
        }

        .sidebar-brand h1 {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-medium);
            color: var(--text-primary);
            letter-spacing: -0.01em;
        }

        .sidebar-nav {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: var(--space-xs);
            padding: 0 var(--space-sm);
            -webkit-app-region: no-drag;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: 8px var(--space-md);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-normal);
            cursor: pointer;
            transition:
                color var(--transition),
                background var(--transition);
            border: none;
            background: none;
            width: 100%;
            text-align: left;
        }

        .nav-item:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
        }

        .nav-item.active {
            color: var(--text-primary);
            background: var(--bg-elevated);
        }

        .nav-item.active svg {
            color: var(--accent);
        }

        .nav-item svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
        }

        .sidebar-footer {
            padding: var(--space-sm);
            margin-top: var(--space-sm);
            -webkit-app-region: no-drag;
        }

        .update-btn {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            width: 100%;
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius-md);
            border: 1px solid rgba(239, 68, 68, 0.2);
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            cursor: pointer;
            text-align: left;
            transition:
                background var(--transition),
                border-color var(--transition);
            animation: update-wobble 5s ease-in-out infinite;
        }

        .update-btn:hover {
            background: rgba(239, 68, 68, 0.14);
            border-color: rgba(239, 68, 68, 0.35);
        }

        @keyframes update-wobble {
            0%,
            90%,
            100% {
                transform: rotate(0deg);
            }
            92% {
                transform: rotate(-2deg);
            }
            94% {
                transform: rotate(2deg);
            }
            96% {
                transform: rotate(-1.5deg);
            }
            98% {
                transform: rotate(1.5deg);
            }
        }

        .update-btn svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        .version-text {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            padding: var(--space-xs) var(--space-md);
        }

        /* ── Main content area ── */

        .content {
            flex: 1;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--bg-app);
        }

        /* Live mode top bar */
        .live-bar {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
            padding: 0 var(--space-md);
            background: var(--bg-app);
            border-bottom: 1px solid var(--border);
            height: 40px;
            -webkit-app-region: drag;
        }

        .live-bar-left {
            display: flex;
            align-items: center;
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-back {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            cursor: pointer;
            background: none;
            border: none;
            padding: var(--space-xs);
            border-radius: var(--radius-sm);
            transition: color var(--transition);
        }

        .live-bar-back:hover {
            color: var(--text-primary);
        }

        .live-bar-back svg {
            width: 14px;
            height: 14px;
        }

        .live-bar-center {
            flex: 1;
            min-width: 0;
            padding: 0 var(--space-md);
            text-align: center;
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-weight: var(--font-weight-medium);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
        }

        .live-bar-right {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            gap: var(--space-sm);
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-text {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-family: var(--font-mono);
            white-space: nowrap;
        }

        .live-bar-text.status {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .live-bar-text.clickable {
            cursor: pointer;
            padding: 2px 8px;
            border-radius: var(--radius-sm);
            font-family: var(--font);
            transition:
                color var(--transition),
                background var(--transition);
        }

        .live-bar-text.clickable:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
        }

        .live-bar-text.badge {
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--bg-surface);
            font-family: var(--font);
        }

        .provider-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--bg-elevated);
            color: var(--text-secondary);
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
            cursor: pointer;
            transition:
                border-color var(--transition),
                color var(--transition),
                background var(--transition);
        }

        .provider-pill:hover:not(:disabled) {
            border-color: var(--accent);
            color: var(--text-primary);
            background: var(--bg-hover);
        }

        .provider-pill:disabled {
            cursor: default;
            opacity: 0.7;
        }

        .health-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
            background: var(--text-muted);
        }

        .health-dot.ok {
            background: var(--success);
        }

        .health-dot.warn {
            background: var(--warning);
        }

        .health-dot.danger {
            background: var(--danger);
        }

        .continue-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid var(--accent);
            background: var(--accent-soft);
            color: var(--text-primary);
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
            cursor: pointer;
            transition:
                border-color var(--transition),
                background var(--transition);
        }

        .continue-pill:hover {
            border-color: var(--accent-hover);
            background: rgba(139, 156, 255, 0.25);
        }

        /* Content inner */
        .content-inner {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .content-inner.live {
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        /* Onboarding fills everything */
        .fullscreen {
            position: fixed;
            inset: 0;
            z-index: 100;
            background: var(--bg-app);
        }

        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border-strong);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #444444;
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        _storageLoaded: { state: true },
        _updateAvailable: { state: true },
        _updateUrl: { state: true },
        _latestVersion: { state: true },
        _cliHealth: { state: true },
        _transcript: { state: true },
        _presetLabel: { state: true },
        _whisperDownloading: { state: true },
        _localAiDownloadProgress: { state: true },
        _activeCliProvider: { state: true },
        _cliAvailableProviders: { state: true },
        _bufferedCandidateCount: { state: true },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'auto';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.responses = [];
        this.currentResponseIndex = -1;
        this._responseStreams = new Map();
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this._storageLoaded = false;
        this._timerInterval = null;
        this._updateAvailable = false;
        this._whisperDownloading = false;
        this._localAiDownloadProgress = { active: false, label: '', percentage: null };
        this._activeCliProvider = null;
        this._cliAvailableProviders = { claude: false, gemini: false };
        this._bufferedCandidateCount = 0;
        this._localVersion = '';
        this._updateUrl = '';
        this._latestVersion = '';
        this._cliHealth = null;
        this._transcript = [];
        this._presetLabel = '';
        this._boundPresetsChanged = () => this._refreshPresetLabel();

        this._loadFromStorage();
        this._checkForUpdates();
    }

    async _checkForUpdates() {
        try {
            this._localVersion = await cheatingDaddy.getVersion();
            this.requestUpdate();

            const result = await cheatingDaddy.checkForUpdates();
            if (result?.updateAvailable) {
                this._updateAvailable = true;
                this._updateUrl = result.url || '';
                this._latestVersion = result.latestVersion || '';
            }
        } catch (e) {
            // silently ignore
        }
    }

    async _refreshPresetLabel() {
        try {
            this._presetLabel = (await cheatingDaddy.presets.label(this.selectedProfile)) || '';
        } catch (e) {
            this._presetLabel = '';
        }
    }

    async _loadFromStorage() {
        try {
            const [config, prefs] = await Promise.all([cheatingDaddy.storage.getConfig(), cheatingDaddy.storage.getPreferences()]);

            this.currentView = config.onboarded ? 'main' : 'onboarding';
            this.selectedProfile = cheatingDaddy.presets.lib.resolvePresetId(prefs.selectedProfile || 'interview', prefs.customPresets);
            this._refreshPresetLabel();
            this.selectedLanguage = prefs.selectedLanguage || 'auto';
            this.selectedScreenshotInterval = prefs.selectedScreenshotInterval || '5';
            this.selectedImageQuality = prefs.selectedImageQuality || 'medium';
            this.layoutMode = config.layout || 'normal';

            this._storageLoaded = true;
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading from storage:', error);
            this._storageLoaded = true;
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('new-response', (_, response, stream) => this.addNewResponse(response, stream));
            ipcRenderer.on('update-response', (_, response, stream) => this.updateCurrentResponse(response, stream));
            ipcRenderer.on('update-status', (_, status) => this.setStatus(status));
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('reconnect-failed', (_, data) => this.addNewResponse(data.message));
            ipcRenderer.on('whisper-downloading', (_, downloading) => {
                this._whisperDownloading = downloading;
            });
            ipcRenderer.on('local-ai-download-progress', (_, progress) => {
                this._localAiDownloadProgress = progress;
            });
            ipcRenderer.on('cli-provider-changed', (_, payload) => {
                if (payload && typeof payload === 'object') {
                    this._activeCliProvider = payload.provider || null;
                    this._cliAvailableProviders = payload.availableProviders || { claude: false, gemini: false };
                    this.requestUpdate();
                }
            });
            ipcRenderer.on('cli-candidate-context', (_, payload) => {
                this._bufferedCandidateCount = Number(payload?.count) || 0;
                this.requestUpdate();
            });
            ipcRenderer.on('cli-health', (_, payload) => {
                this._cliHealth = payload && typeof payload === 'object' ? payload : null;
            });
            ipcRenderer.on('transcript-line', (_, line) => this._addTranscriptLine(line));
        }
        window.addEventListener('presets-changed', this._boundPresetsChanged);
    }

    _addTranscriptLine(line) {
        if (!line || typeof line.text !== 'string' || !line.text.trim()) return;
        const entry = {
            id: String(line.id || Date.now()),
            source: line.source === 'you' ? 'you' : 'speaker',
            text: line.text.trim(),
            ts: Number(line.ts) || Date.now(),
        };
        this._transcript = [...this._transcript, entry].slice(-200);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('new-response');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('reconnect-failed');
            ipcRenderer.removeAllListeners('whisper-downloading');
            ipcRenderer.removeAllListeners('local-ai-download-progress');
            ipcRenderer.removeAllListeners('cli-provider-changed');
            ipcRenderer.removeAllListeners('cli-candidate-context');
            ipcRenderer.removeAllListeners('cli-health');
            ipcRenderer.removeAllListeners('transcript-line');
        }
        window.removeEventListener('presets-changed', this._boundPresetsChanged);
    }

    // ── Timer ──

    _startTimer() {
        this._stopTimer();
        if (this.startTime) {
            this._timerInterval = setInterval(() => this.requestUpdate(), 1000);
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getElapsedTime() {
        if (!this.startTime) return '0:00';
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor((elapsed % 3600) / 60);
        const s = elapsed % 60;
        const pad = n => String(n).padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${m}:${pad(s)}`;
    }

    // ── Status & Responses ──

    setStatus(text) {
        this.statusText = text;
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
        }
    }

    // A stream id keeps two answers that arrive at the same time (mixed mode) from overwriting each other
    addNewResponse(response, stream) {
        const wasOnLatest = this.currentResponseIndex === this.responses.length - 1;
        this.responses = [...this.responses, response];
        if (stream) {
            this._responseStreams.set(stream, this.responses.length - 1);
        }
        if (wasOnLatest || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }
        this._awaitingNewResponse = false;
        this.requestUpdate();
    }

    updateCurrentResponse(response, stream) {
        const index = stream ? this._responseStreams.get(stream) : this.responses.length - 1;
        if (index === undefined || index < 0 || index >= this.responses.length) {
            this.addNewResponse(response, stream);
            return;
        }
        this.responses = this.responses.map((existing, position) => (position === index ? response : existing));
        this.requestUpdate();
    }

    // ── Navigation ──

    navigate(view) {
        this.currentView = view;
        this.requestUpdate();
    }

    async handleClose() {
        if (this.currentView === 'assistant') {
            cheatingDaddy.stopCapture();
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
            }
            this.sessionActive = false;
            this._activeCliProvider = null;
            this._cliAvailableProviders = { claude: false, gemini: false };
            this._bufferedCandidateCount = 0;
            this._cliHealth = null;
            this._transcript = [];
            this._stopTimer();
            this.currentView = 'main';
        } else {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async _handleMinimize() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('window-minimize');
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // ── Session start ──

    async handleStart() {
        const prefs = await cheatingDaddy.storage.getPreferences();
        const providerMode = prefs.providerMode === 'cloud' ? 'cli' : prefs.providerMode || 'cli'; // 'cloud' was removed; old settings fall back to CLI

        if (providerMode === 'cli') {
            const success = await cheatingDaddy.initializeCli(this.selectedProfile, this.selectedLanguage);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerCliError) {
                    mainView.triggerCliError();
                }
                return;
            }
        } else if (providerMode === 'local') {
            const success = await cheatingDaddy.initializeLocal(this.selectedProfile);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }
        } else {
            const result =
                providerMode === 'mixed'
                    ? await cheatingDaddy.initializeMixed(this.selectedProfile, this.selectedLanguage)
                    : await cheatingDaddy.initializeGemini(this.selectedProfile, this.selectedLanguage);
            if (!result.success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerStartError) {
                    mainView.triggerStartError(result.error);
                }
                return;
            }
        }

        cheatingDaddy.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        this.responses = [];
        this.currentResponseIndex = -1;
        this._responseStreams = new Map();
        this._bufferedCandidateCount = 0;
        this._cliHealth = null;
        this._transcript = [];
        this.startTime = Date.now();
        this.sessionActive = true;
        this.currentView = 'assistant';
        this._startTimer();
    }

    async handleCancelLocalDownload() {
        await Promise.all([cheatingDaddy.cancelLocalInitialization(), cheatingDaddy.cancelCliInitialization()]);
    }

    async handleSuggestContinuation() {
        const result = await cheatingDaddy.suggestCliContinuation();
        if (!result?.success && result?.error) {
            this.setStatus(result.error);
        }
    }

    async handleSwitchCliProvider() {
        if (!this._activeCliProvider) return;
        const next = this._activeCliProvider === 'claude' ? 'gemini' : 'claude';
        if (!this._cliAvailableProviders?.[next]) {
            this.setStatus(`${next === 'claude' ? 'Claude' : 'Gemini'} CLI not available`);
            return;
        }
        await cheatingDaddy.switchCliProvider(next);
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://aistudio.google.com/apikey');
        }
    }

    async handleGroqAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://console.groq.com/keys');
        }
    }

    // ── Settings handlers ──

    async handleProfileChange(profile) {
        this.selectedProfile = profile;
        this._refreshPresetLabel();
        await cheatingDaddy.storage.updatePreference('selectedProfile', profile);
    }

    async handleLanguageChange(language) {
        this.selectedLanguage = language;
        await cheatingDaddy.storage.updatePreference('selectedLanguage', language);
    }

    async handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
        await cheatingDaddy.storage.updatePreference('selectedScreenshotInterval', interval);
    }

    async handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        await cheatingDaddy.storage.updatePreference('selectedImageQuality', quality);
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        await cheatingDaddy.storage.updateConfig('layout', layoutMode);
        this.requestUpdate();
    }

    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    async handleSendText(message) {
        const result = await window.cheatingDaddy.sendTextMessage(message);
        if (!result.success) {
            this.setStatus('Error sending message: ' + result.error);
        } else {
            this.setStatus('Message sent...');
            this._awaitingNewResponse = true;
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);
        }
    }

    // ── Helpers ──

    _isLiveMode() {
        return this.currentView === 'assistant';
    }

    // ── Render ──

    renderCurrentView() {
        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .selectedProfile=${this.selectedProfile}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .selectedLanguage=${this.selectedLanguage}
                        .onLanguageChange=${lang => this.handleLanguageChange(lang)}
                        .onStart=${() => this.handleStart()}
                        .onExternalLink=${url => this.handleExternalLinkClick(url)}
                        .whisperDownloading=${this._whisperDownloading}
                        .downloadProgress=${this._localAiDownloadProgress}
                        .onCancelDownload=${() => this.handleCancelLocalDownload()}
                    ></main-view>
                `;

            case 'ai-customize':
                return html`
                    <ai-customize-view
                        .selectedProfile=${this.selectedProfile}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                    ></ai-customize-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .onLanguageChange=${l => this.handleLanguageChange(l)}
                        .onScreenshotIntervalChange=${i => this.handleScreenshotIntervalChange(i)}
                        .onImageQualityChange=${q => this.handleImageQualityChange(q)}
                        .onLayoutModeChange=${lm => this.handleLayoutModeChange(lm)}
                    ></customize-view>
                `;

            case 'help':
                return html`<help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view>`;

            case 'history':
                return html`<history-view></history-view>`;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .transcript=${this._transcript}
                        .onSendText=${msg => this.handleSendText(msg)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    renderSidebar() {
        const items = [
            {
                id: 'main',
                label: 'Home',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="m19 8.71l-5.333-4.148a2.666 2.666 0 0 0-3.274 0L5.059 8.71a2.67 2.67 0 0 0-1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.2c0-.823-.38-1.6-1.03-2.105"
                        />
                        <path d="M16 15c-2.21 1.333-5.792 1.333-8 0" />
                    </g>
                </svg>`,
            },
            {
                id: 'ai-customize',
                label: 'AI Customization',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 3v7h6l-8 11v-7H5z"
                    />
                </svg>`,
            },
            {
                id: 'history',
                label: 'History',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="M10 20.777a9 9 0 0 1-2.48-.969M14 3.223a9.003 9.003 0 0 1 0 17.554m-9.421-3.684a9 9 0 0 1-1.227-2.592M3.124 10.5c.16-.95.468-1.85.9-2.675l.169-.305m2.714-2.941A9 9 0 0 1 10 3.223"
                        />
                        <path d="M12 8v4l3 3" />
                    </g>
                </svg>`,
            },
            {
                id: 'customize',
                label: 'Settings',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="M19.875 6.27A2.23 2.23 0 0 1 21 8.218v7.284c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.27 2.27 0 0 1-2.184 0l-6.75-4.27A2.23 2.23 0 0 1 3 15.502V8.217c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98z"
                        />
                        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
                    </g>
                </svg>`,
            },
            {
                id: 'help',
                label: 'Help',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9m0 13v.01" />
                        <path d="M12 13a2 2 0 0 0 .914-3.782a1.98 1.98 0 0 0-2.414.483" />
                    </g>
                </svg>`,
            },
        ];

        return html`
            <div class="sidebar ${this._isLiveMode() ? 'hidden' : ''}">
                <div class="sidebar-brand">
                    <span class="brand-mark">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M13 3v7h6l-8 11v-7H5z" />
                        </svg>
                    </span>
                    <h1>Cheating Daddy</h1>
                </div>
                <nav class="sidebar-nav">
                    ${items.map(
                        item => html`
                            <button
                                class="nav-item ${this.currentView === item.id ? 'active' : ''}"
                                @click=${() => this.navigate(item.id)}
                                title=${item.label}
                            >
                                ${item.icon} ${item.label}
                            </button>
                        `
                    )}
                </nav>
                <div class="sidebar-footer">
                    ${
                        this._updateAvailable
                            ? html`
                                  <button
                                      class="update-btn"
                                      title=${this._latestVersion ? `Version ${this._latestVersion} is available` : 'A new version is available'}
                                      @click=${() => this.handleExternalLinkClick(this._updateUrl || 'https://github.com/Jenakonda/cheating-daddy-Modify/releases/latest')}
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                          <path
                                              fill="none"
                                              stroke="currentColor"
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5m-5-7v12"
                                          />
                                      </svg>
                                      Update available
                                  </button>
                              `
                            : html` <div class="version-text">v${this._localVersion}</div> `
                    }
                </div>
            </div>
        `;
    }

    _providerTone() {
        const entry = this._cliHealth?.[this._activeCliProvider];
        return cheatingDaddy.describeCliHealth(entry).tone;
    }

    _healthTooltip() {
        const names = { claude: 'Claude', gemini: 'Gemini' };
        const lines = ['claude', 'gemini']
            .filter(provider => this._cliAvailableProviders?.[provider])
            .map(
                provider =>
                    `${names[provider]}${provider === this._activeCliProvider ? ' (active)' : ''}: ${cheatingDaddy.describeCliHealth(this._cliHealth?.[provider]).label}`
            );
        if (this._cliAvailableProviders?.claude && this._cliAvailableProviders?.gemini) {
            lines.push('Click to switch provider');
        }
        return lines.join('\n');
    }

    renderLiveBar() {
        if (!this._isLiveMode()) return '';

        const profileLabels = {
            interview: 'Interview',
            sales: 'Sales Call',
            meeting: 'Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam',
        };

        const providerTone = this._providerTone();
        const healthTitle = this._healthTooltip();

        return html`
            <div class="live-bar">
                <div class="live-bar-left">
                    <button class="live-bar-back" @click=${() => this.handleClose()} title="End session">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fill-rule="evenodd"
                                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
                <div class="live-bar-center">${profileLabels[this.selectedProfile] || this._presetLabel || 'Session'}</div>
                <div class="live-bar-right">
                    ${
                        this._activeCliProvider
                            ? html`
                                  <button
                                      class="continue-pill"
                                      @click=${() => this.handleSuggestContinuation()}
                                      title="Suggest how to continue your answer"
                                  >
                                      ${this._bufferedCandidateCount > 0 ? `Continue (${this._bufferedCandidateCount})` : 'Continue'}
                                  </button>
                                  <button
                                      class="provider-pill"
                                      @click=${() => this.handleSwitchCliProvider()}
                                      ?disabled=${!(this._cliAvailableProviders?.claude && this._cliAvailableProviders?.gemini)}
                                      title=${healthTitle}
                                  >
                                      <span class="health-dot ${providerTone}"></span>
                                      ${this._activeCliProvider === 'gemini' ? 'Gemini' : 'Claude'}${
                                          this._cliAvailableProviders?.claude && this._cliAvailableProviders?.gemini ? ' ⇄' : ''
                                      }
                                  </button>
                              `
                            : ''
                    }
                    ${this.statusText ? html`<span class="live-bar-text status" title=${this.statusText}>${this.statusText}</span>` : ''}
                    <span class="live-bar-text">${this.getElapsedTime()}</span>
                    ${this._isClickThrough ? html`<span class="live-bar-text badge">Click-through</span>` : ''}
                    <span class="live-bar-text clickable" @click=${() => this.handleHideToggle()}>Hide</span>
                </div>
            </div>
        `;
    }

    render() {
        // Onboarding is fullscreen, no sidebar
        if (this.currentView === 'onboarding') {
            return html` <div class="fullscreen">${this.renderCurrentView()}</div> `;
        }

        const isLive = this._isLiveMode();

        return html`
            <div class="app-shell">
                <div class="top-drag-bar ${isLive ? 'hidden' : ''}">
                    <div class="drag-region"></div>
                    <div class="window-controls">
                        <button class="wc-btn" @click=${() => this._handleMinimize()} title="Minimize" aria-label="Minimize">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                            >
                                <path d="M5 12h14" />
                            </svg>
                        </button>
                        <button class="wc-btn close" @click=${() => this.handleClose()} title="Close" aria-label="Close">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                            >
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                ${this.renderSidebar()}
                <div class="content">
                    ${isLive ? this.renderLiveBar() : ''}
                    <div class="content-inner ${isLive ? 'live' : ''}">${this.renderCurrentView()}</div>
                </div>
            </div>
        `;
    }
}

customElements.define('cheating-daddy-app', CheatingDaddyApp);
