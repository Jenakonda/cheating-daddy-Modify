import { html, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { mainViewStyles } from './main/styles.js';
import {
    LOCAL_LLM_PRESETS,
    WHISPER_MODEL_OPTIONS,
    AUDIO_INPUT_OPTIONS,
    SPEECH_LANGUAGE_OPTIONS,
    SPEECH_VOCABULARY_MAX_LENGTH,
    suggestWhisperUpgrade,
    PROFILE_OPTIONS,
    RESPONSE_LANGUAGE_OPTIONS,
    CLAUDE_MODEL_PRESETS,
    CLAUDE_EFFORT_OPTIONS,
    EFFORT_TIER_LABELS,
    DEFAULT_AGY_MODELS,
    AGY_GROUP_ORDER,
    buildAgyModelFamilies,
    resolveAgyModelSelection,
    GEMINI_MODEL_PRESETS,
    GEMINI_LIVE_MODEL_PRESETS,
    geminiModelChoices,
    MODE_OPTIONS,
    MIXED_ROUTE_FIELDS,
} from './main/options.js';

export class MainView extends LitElement {
    static styles = mainViewStyles;

    static properties = {
        onStart: { type: Function },
        onExternalLink: { type: Function },
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        selectedLanguage: { type: String },
        onLanguageChange: { type: Function },
        isInitializing: { type: Boolean },
        whisperDownloading: { type: Boolean },
        downloadProgress: { type: Object },
        onCancelDownload: { type: Function },
        // Internal state
        _mode: { state: true },
        _presetOptions: { state: true },
        _geminiKey: { state: true },
        _groqKey: { state: true },
        _openaiKey: { state: true },
        _geminiLiveModel: { state: true },
        _geminiModel: { state: true },
        _geminiModelLists: { state: true },
        _geminiCustomFields: { state: true },
        _geminiModelStatus: { state: true },
        _startError: { state: true },
        _backupKeys: { state: true },
        _mixedRoutes: { state: true },
        _groqModel: { state: true },
        _groqImageModel: { state: true },
        _disableGroqThinking: { state: true },
        _tokenError: { state: true },
        _keyError: { state: true },
        // Local AI state
        _localLlmModel: { state: true },
        _useCustomLocalLlmModel: { state: true },
        _whisperModel: { state: true },
        _speechVocabulary: { state: true },
        _showLocalHelp: { state: true },
        // CLI state
        _cliPrimaryProvider: { state: true },
        _cliFallbackEnabled: { state: true },
        _cliClaudeModel: { state: true },
        _cliClaudeEffort: { state: true },
        _useCustomClaudeModel: { state: true },
        _cliGeminiModel: { state: true },
        _useCustomGeminiModel: { state: true },
        _agyLiveModels: { state: true },
        _loadingCliModels: { state: true },
        _cliClaudePath: { state: true },
        _cliGeminiPath: { state: true },
        _cliUseSubscriptionAuth: { state: true },
        _cliWhisperEnabled: { state: true },
        _cliMicContextOnly: { state: true },
        _audioMode: { state: true },
        _selectedLanguage: { state: true },
        _responseLanguage: { state: true },
        _contextFolderEnabled: { state: true },
        _contextFolderSummary: { state: true },
        _loadingContextFolder: { state: true },
        _contextFolderNotice: { state: true },
        _cliStatus: { state: true },
        _checkingCliStatus: { state: true },
        _launchingCliSetup: { state: true },
        _cliSetupNotice: { state: true },
        _showCliHelp: { state: true },
        _cliError: { state: true },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.onExternalLink = () => {};
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this.selectedLanguage = 'auto';
        this.onLanguageChange = null;
        this.isInitializing = false;
        this.whisperDownloading = false;
        this.downloadProgress = { active: false, label: '', percentage: null };
        this.onCancelDownload = () => {};

        this._mode = 'cli';
        this._geminiKey = '';
        this._groqKey = '';
        this._openaiKey = '';
        this._geminiLiveModel = 'gemini-3.8-live';
        this._geminiModel = 'gemini-3.8-flash';
        this._geminiModelLists = null;
        this._geminiCustomFields = {};
        this._geminiModelStatus = '';
        this._startError = '';
        this._backupKeys = { gemini: [], groq: [] };
        this._mixedRoutes = { voice: 'byok', screen: 'cli', text: 'cli' };
        this._groqModel = 'qwen/qwen3.6-27b';
        this._groqImageModel = 'qwen/qwen3.6-27b';
        this._disableGroqThinking = true;
        this._tokenError = false;
        this._keyError = false;
        this._showLocalHelp = false;
        this._localLlmModel = 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M';
        this._useCustomLocalLlmModel = false;
        this._whisperModel = 'small-q5_1';
        this._speechVocabulary = '';

        this._cliPrimaryProvider = 'claude';
        this._cliFallbackEnabled = true;
        this._cliClaudeModel = 'sonnet';
        this._cliClaudeEffort = 'auto';
        this._useCustomClaudeModel = false;
        this._cliGeminiModel = 'gemini-4-hydrogen-low';
        this._useCustomGeminiModel = false;
        this._agyLiveModels = [];
        this._loadingCliModels = false;
        this._cliClaudePath = '';
        this._cliGeminiPath = '';
        this._cliUseSubscriptionAuth = true;
        this._cliWhisperEnabled = true;
        this._cliMicContextOnly = true;
        this._audioMode = 'speaker_only';
        this._selectedLanguage = 'auto';
        this._responseLanguage = 'auto';
        this._contextFolderEnabled = true;
        this._contextFolderSummary = null;
        this._loadingContextFolder = false;
        this._contextFolderNotice = '';
        this._cliStatus = null;
        this._checkingCliStatus = false;
        this._launchingCliSetup = '';
        this._cliSetupNotice = '';
        this._pendingCliSetupRefresh = false;
        this._showCliHelp = false;
        this._cliError = '';

        this.boundKeydownHandler = this._handleKeydown.bind(this);
        this.boundFocusHandler = this._handleWindowFocus.bind(this);
        this._presetOptions = PROFILE_OPTIONS;
        this._boundPresetsChanged = () => this._loadPresetOptions();
        this._loadPresetOptions();
        this._loadFromStorage();
    }

    async _loadPresetOptions() {
        try {
            this._presetOptions = await cheatingDaddy.presets.list();
        } catch (error) {
            console.warn('Could not load presets:', error);
        }
    }

    async _loadFromStorage() {
        try {
            const [config, prefs, creds] = await Promise.all([
                cheatingDaddy.storage.getConfig(),
                cheatingDaddy.storage.getPreferences(),
                cheatingDaddy.storage.getCredentials().catch(() => ({})),
            ]);

            const storedMode = prefs.providerMode || 'cli';
            this._mode = storedMode === 'cloud' ? 'cli' : storedMode;

            if (storedMode === 'cloud') {
                await cheatingDaddy.storage.updatePreference('providerMode', this._mode);
            }

            // Load keys
            this._geminiKey = (await cheatingDaddy.storage.getApiKey().catch(() => '')) || '';
            this._groqKey = (await cheatingDaddy.storage.getGroqApiKey().catch(() => '')) || '';
            this._openaiKey = creds.openaiKey || '';
            this._backupKeys = {
                gemini: await cheatingDaddy.storage.getBackupKeys('gemini').catch(() => []),
                groq: await cheatingDaddy.storage.getBackupKeys('groq').catch(() => []),
            };
            this._mixedRoutes = { ...this._mixedRoutes, ...prefs.mixedRoutes };
            this._geminiLiveModel = config.geminiLiveModel || 'gemini-3.8-live';
            this._geminiModel = config.geminiModel || 'gemini-3.8-flash';
            this._groqModel = config.groqModel || 'qwen/qwen3.6-27b';
            this._groqImageModel = config.groqImageModel || 'qwen/qwen3.6-27b';
            this._disableGroqThinking = config.disableGroqThinking === true;

            // Load local AI settings
            this._localLlmModel = prefs.localLlmModel || 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M';
            this._useCustomLocalLlmModel = !LOCAL_LLM_PRESETS.some(preset => preset.value === this._localLlmModel);
            this._whisperModel = prefs.whisperModel || 'small-q5_1';
            this._speechVocabulary = prefs.speechVocabulary || '';

            // Load CLI settings
            this._cliPrimaryProvider = prefs.cliPrimaryProvider || 'claude';
            this._cliFallbackEnabled = prefs.cliFallbackEnabled ?? true;
            this._cliClaudeModel = prefs.cliClaudeModel || 'sonnet';
            this._cliClaudeEffort = prefs.cliClaudeEffort || 'auto';
            this._useCustomClaudeModel = !CLAUDE_MODEL_PRESETS.some(preset => preset.value === this._cliClaudeModel);
            this._cliGeminiModel = prefs.cliGeminiModel || 'gemini-4-hydrogen-low';
            this._useCustomGeminiModel = resolveAgyModelSelection(this._cliGeminiModel, this._getAgyFamilies()).mode === 'custom';
            this._cliClaudePath = prefs.cliClaudePath || '';
            this._cliGeminiPath = prefs.cliGeminiPath || '';
            this._cliUseSubscriptionAuth = prefs.cliUseSubscriptionAuth ?? true;
            this._cliWhisperEnabled = prefs.cliWhisperEnabled ?? true;
            this._cliMicContextOnly = prefs.cliMicContextOnly ?? true;
            this._audioMode = prefs.audioMode || 'speaker_only';
            this._selectedLanguage = prefs.selectedLanguage || this.selectedLanguage || 'auto';
            this._responseLanguage = prefs.responseLanguage || 'auto';
            this._contextFolderEnabled = prefs.contextFolderEnabled ?? true;

            this.requestUpdate();
            this._refreshCliStatus();
            this._refreshCliModels();
            this._refreshContextFolder(false);
        } catch (e) {
            console.error('Error loading MainView storage:', e);
        }
    }

    async _refreshCliStatus() {
        if (!cheatingDaddy.checkCliStatus) return;
        this._checkingCliStatus = true;
        this.requestUpdate();
        try {
            const status = await cheatingDaddy.checkCliStatus({
                claudePath: this._cliClaudePath,
                geminiPath: this._cliGeminiPath,
            });
            if (status) {
                this._cliStatus = status;
            }
        } catch (err) {
            console.error('Error checking CLI status:', err);
        } finally {
            this._checkingCliStatus = false;
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('keydown', this.boundKeydownHandler);
        window.addEventListener('focus', this.boundFocusHandler);
        window.addEventListener('presets-changed', this._boundPresetsChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.boundKeydownHandler);
        window.removeEventListener('focus', this.boundFocusHandler);
        window.removeEventListener('presets-changed', this._boundPresetsChanged);
    }

    async _handleWindowFocus() {
        if (!this._pendingCliSetupRefresh || !this._usesCli()) {
            return;
        }
        this._pendingCliSetupRefresh = false;
        await this._refreshCliStatus();
        if (this._cliStatus?.gemini?.installed) {
            this._refreshCliModels?.();
        }
    }

    async _launchCliSetup(provider, action = 'install') {
        if (!cheatingDaddy.launchCliSetup) return;
        this._launchingCliSetup = provider;
        this._cliError = '';
        this.requestUpdate();

        try {
            const customPath = provider === 'claude' ? this._cliClaudePath : this._cliGeminiPath;
            const res = await cheatingDaddy.launchCliSetup({ provider, action, customPath });
            if (res?.success) {
                this._pendingCliSetupRefresh = true;
                this._cliSetupNotice =
                    action === 'install'
                        ? `Terminal opened for ${res.label}. Finish installation & browser sign-in there, then return here.`
                        : `Terminal opened for ${res.label} sign-in. Complete login there, then return here.`;
            } else {
                this._cliError = res?.error || 'Failed to open CLI setup terminal.';
            }
        } catch (err) {
            this._cliError = err?.message || 'Failed to open CLI setup terminal.';
        } finally {
            this._launchingCliSetup = '';
            this.requestUpdate();
        }
    }

    async _checkCliSetupStatus() {
        this._pendingCliSetupRefresh = false;
        await this._refreshCliStatus();
        if (this._cliStatus?.gemini?.installed) {
            await this._refreshCliModels?.();
        }
        const claudeReady = this._cliStatus?.claude?.installed && this._cliStatus?.claude?.authStatus !== 'unauthenticated';
        const geminiReady = this._cliStatus?.gemini?.installed && this._cliStatus?.gemini?.authStatus !== 'unauthenticated';
        if (claudeReady || geminiReady) {
            this._cliSetupNotice = '';
            this.requestUpdate();
        }
    }

    _handleKeydown(e) {
        if (e.key === 'Escape') {
            if (this._showLocalHelp) {
                this._closeLocalHelp();
                return;
            }
            if (this._showCliHelp) {
                this._closeCliHelp();
                return;
            }
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            this._handleStart();
        }
    }

    // ── Mode and keys ──

    _usesCli() {
        return this._mode === 'cli' || (this._mode === 'mixed' && Object.values(this._mixedRoutes).includes('cli'));
    }

    _usesApi() {
        return this._mode === 'byok' || (this._mode === 'mixed' && Object.values(this._mixedRoutes).includes('byok'));
    }

    _hasApiKey(provider) {
        const primary = provider === 'gemini' ? this._geminiKey : this._groqKey;
        return Boolean(primary.trim()) || this._backupKeys[provider].some(key => key.trim());
    }

    async _saveMixedRoute(task, value) {
        this._mixedRoutes = { ...this._mixedRoutes, [task]: value };
        this._cliError = '';
        this._startError = '';
        this._keyError = false;
        await cheatingDaddy.storage.updatePreference('mixedRoutes', this._mixedRoutes);
        if (value === 'cli') {
            this._refreshCliStatus();
        }
    }

    async _saveBackupKeys(provider, keys) {
        this._backupKeys = { ...this._backupKeys, [provider]: keys };
        this._keyError = false;
        this._startError = '';
        await cheatingDaddy.storage.setBackupKeys(provider, keys);
    }

    // ── Persistence ──

    async _saveMode(mode) {
        this._mode = mode;
        this._tokenError = false;
        this._keyError = false;
        this._cliError = '';
        this._startError = '';
        await cheatingDaddy.storage.updatePreference('providerMode', mode);
        if (this._usesCli()) {
            this._refreshCliStatus();
        }
        this.requestUpdate();
    }

    async _saveGeminiKey(val) {
        this._geminiKey = val;
        this._keyError = false;
        this._geminiModelLists = null;
        this._geminiModelStatus = '';
        this._startError = '';
        await cheatingDaddy.storage.setApiKey(val);
        this.requestUpdate();
    }

    async _saveGroqKey(val) {
        this._groqKey = val;
        await cheatingDaddy.storage.setGroqApiKey(val);
        this.requestUpdate();
    }

    async _saveGeminiLiveModel(val) {
        this._geminiLiveModel = val;
        this._startError = '';
        await cheatingDaddy.storage.updateConfig('geminiLiveModel', val);
        this.requestUpdate();
    }

    async _saveGeminiModel(val) {
        this._geminiModel = val;
        await cheatingDaddy.storage.updateConfig('geminiModel', val);
        this.requestUpdate();
    }

    async _loadGeminiModels() {
        this._geminiModelStatus = 'Loading...';
        const result = await cheatingDaddy.listGeminiModels();
        if (result.success) {
            this._geminiModelLists = result.data;
            this._geminiModelStatus = `Loaded ${result.data.generate.length + result.data.live.length} models available to your key.`;
        } else {
            this._geminiModelStatus = result.error;
        }
    }

    triggerStartError(message) {
        this._startError = message || 'Could not start the session.';
    }

    _renderGeminiModelSelect({ field, label, value, choices, save }) {
        const custom = this._geminiCustomFields[field] || !choices.includes(value);
        return html`
            <div class="form-group" data-field=${field}>
                <label class="form-label">${label}</label>
                <select
                    @change=${e => {
                        const next = e.target.value;
                        this._geminiCustomFields = { ...this._geminiCustomFields, [field]: next === '__custom__' };
                        if (next !== '__custom__') save(next);
                    }}
                >
                    ${choices.map(id => html`<option value=${id} .selected=${!custom && id === value}>${id}</option>`)}
                    <option value="__custom__" .selected=${custom}>Custom model ID...</option>
                </select>
                ${custom ? html`<input type="text" placeholder="e.g. ${choices[0]}" .value=${value} @input=${e => save(e.target.value)} />` : ''}
            </div>
        `;
    }

    async _saveGroqModel(val) {
        this._groqModel = val;
        await cheatingDaddy.storage.updateConfig('groqModel', val);
        this.requestUpdate();
    }

    async _saveGroqImageModel(val) {
        this._groqImageModel = val;
        await cheatingDaddy.storage.updateConfig('groqImageModel', val);
        this.requestUpdate();
    }

    async _saveDisableGroqThinking(disabled) {
        this._disableGroqThinking = disabled;
        await cheatingDaddy.storage.updateConfig('disableGroqThinking', disabled);
        this.requestUpdate();
    }

    async _saveOpenaiKey(val) {
        this._openaiKey = val;
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            await cheatingDaddy.storage.setCredentials({ ...creds, openaiKey: val });
        } catch (e) {}
        this.requestUpdate();
    }

    async _saveLocalLlmModel(val) {
        this._localLlmModel = val;
        await cheatingDaddy.storage.updatePreference('localLlmModel', val);
        this.requestUpdate();
    }

    async _selectLocalLlmModel(value) {
        if (value === 'custom') {
            this._useCustomLocalLlmModel = true;
            this.requestUpdate();
            return;
        }

        this._useCustomLocalLlmModel = false;
        await this._saveLocalLlmModel(value);
    }

    async _saveSpeechVocabulary(val) {
        this._speechVocabulary = String(val || '').slice(0, SPEECH_VOCABULARY_MAX_LENGTH);
        await cheatingDaddy.storage.updatePreference('speechVocabulary', this._speechVocabulary);
    }

    async _saveWhisperModel(val) {
        this._whisperModel = val;
        await cheatingDaddy.storage.updatePreference('whisperModel', val);
        this.requestUpdate();
    }

    async _saveCliPrimaryProvider(val) {
        this._cliPrimaryProvider = val === 'gemini' ? 'gemini' : 'claude';
        this._cliError = '';
        await cheatingDaddy.storage.updatePreference('cliPrimaryProvider', this._cliPrimaryProvider);
        this.requestUpdate();
    }

    async _saveCliFallbackEnabled(enabled) {
        this._cliFallbackEnabled = Boolean(enabled);
        await cheatingDaddy.storage.updatePreference('cliFallbackEnabled', this._cliFallbackEnabled);
        this.requestUpdate();
    }

    async _saveCliUseSubscriptionAuth(enabled) {
        this._cliUseSubscriptionAuth = Boolean(enabled);
        await cheatingDaddy.storage.updatePreference('cliUseSubscriptionAuth', this._cliUseSubscriptionAuth);
        this.requestUpdate();
    }

    async _saveCliWhisperEnabled(enabled) {
        this._cliWhisperEnabled = Boolean(enabled);
        await cheatingDaddy.storage.updatePreference('cliWhisperEnabled', this._cliWhisperEnabled);
        this.requestUpdate();
    }

    async _saveAudioMode(val) {
        this._audioMode = val;
        await cheatingDaddy.storage.updatePreference('audioMode', val);
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    async _saveCliMicContextOnly(enabled) {
        this._cliMicContextOnly = Boolean(enabled);
        await cheatingDaddy.storage.updatePreference('cliMicContextOnly', this._cliMicContextOnly);
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    async _saveSelectedLanguage(val) {
        this._selectedLanguage = val;
        if (typeof this.onLanguageChange === 'function') {
            await this.onLanguageChange(val);
        } else {
            await cheatingDaddy.storage.updatePreference('selectedLanguage', val);
        }
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    async _saveProfile(val) {
        this.selectedProfile = val;
        if (typeof this.onProfileChange === 'function') {
            await this.onProfileChange(val);
        } else {
            await cheatingDaddy.storage.updatePreference('selectedProfile', val);
        }
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    async _saveResponseLanguage(val) {
        this._responseLanguage = val;
        await cheatingDaddy.storage.updatePreference('responseLanguage', val);
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    async _toggleContextFolder(enabled) {
        this._contextFolderEnabled = Boolean(enabled);
        this._contextFolderNotice = '';
        await cheatingDaddy.storage.updatePreference('contextFolderEnabled', this._contextFolderEnabled);
        await cheatingDaddy.refreshPreferencesCache?.();
        if (this._contextFolderSummary) {
            this._contextFolderSummary = { ...this._contextFolderSummary, enabled: this._contextFolderEnabled };
        }
        this.requestUpdate();
    }

    async _refreshContextFolder(force = false) {
        if (!cheatingDaddy.contextFolder?.getSummary) return;
        this._loadingContextFolder = true;
        this.requestUpdate();
        try {
            const res = await cheatingDaddy.contextFolder.getSummary({ refresh: Boolean(force) });
            if (res?.success && res.data) {
                this._contextFolderSummary = res.data;
                if (force) {
                    this._contextFolderNotice = '';
                }
            } else if (res?.error) {
                this._contextFolderNotice = res.error;
            }
        } catch (err) {
            this._contextFolderNotice = err?.message || 'Failed to inspect context folder';
        } finally {
            this._loadingContextFolder = false;
            this.requestUpdate();
        }
    }

    async _chooseContextFolder() {
        if (!cheatingDaddy.contextFolder?.choose) return;
        try {
            const res = await cheatingDaddy.contextFolder.choose();
            if (res?.success && !res.canceled && res.data) {
                this._contextFolderEnabled = true;
                this._contextFolderSummary = res.data;
                this._contextFolderNotice = '';
                await cheatingDaddy.refreshPreferencesCache?.();
                this.requestUpdate();
            } else if (res?.error) {
                this._contextFolderNotice = res.error;
                this.requestUpdate();
            }
        } catch (err) {
            this._contextFolderNotice = err?.message || 'Failed to choose folder';
            this.requestUpdate();
        }
    }

    async _openContextFolder() {
        if (!cheatingDaddy.contextFolder?.open) return;
        try {
            const res = await cheatingDaddy.contextFolder.open();
            if (!res?.success && res?.error) {
                this._contextFolderNotice = res.error;
                this.requestUpdate();
            }
        } catch (err) {
            this._contextFolderNotice = err?.message || 'Failed to open folder';
            this.requestUpdate();
        }
    }

    async _addContextFiles() {
        if (!cheatingDaddy.contextFolder?.addFiles) return;
        try {
            const res = await cheatingDaddy.contextFolder.addFiles();
            if (res?.success && !res.canceled && res.data) {
                this._contextFolderSummary = res.data;
                const copiedCount = res.copied?.length || 0;
                const skippedCount = res.skipped?.length || 0;
                this._contextFolderNotice =
                    skippedCount > 0 ? `Added ${copiedCount} file(s), skipped ${skippedCount}` : `Added ${copiedCount} file(s)`;
                this.requestUpdate();
            } else if (res?.error) {
                this._contextFolderNotice = res.error;
                this.requestUpdate();
            }
        } catch (err) {
            this._contextFolderNotice = err?.message || 'Failed to add files';
            this.requestUpdate();
        }
    }

    async _resetDefaultContextFolder() {
        if (!cheatingDaddy.contextFolder?.resetDefault) return;
        try {
            const res = await cheatingDaddy.contextFolder.resetDefault();
            if (res?.success && res.data) {
                this._contextFolderSummary = res.data;
                this._contextFolderNotice = '';
                await cheatingDaddy.refreshPreferencesCache?.();
                this.requestUpdate();
            } else if (res?.error) {
                this._contextFolderNotice = res.error;
                this.requestUpdate();
            }
        } catch (err) {
            this._contextFolderNotice = err?.message || 'Failed to reset folder';
            this.requestUpdate();
        }
    }

    async _applyUkrainianWhisperPreset() {
        this._whisperModel = 'small-q5_1';
        this._selectedLanguage = 'uk-UA';
        await cheatingDaddy.storage.updatePreference('whisperModel', 'small-q5_1');
        if (typeof this.onLanguageChange === 'function') {
            await this.onLanguageChange('uk-UA');
        } else {
            await cheatingDaddy.storage.updatePreference('selectedLanguage', 'uk-UA');
        }
        await cheatingDaddy.refreshPreferencesCache?.();
        this.requestUpdate();
    }

    _getAgyFamilies() {
        return buildAgyModelFamilies(this._agyLiveModels);
    }

    async _refreshCliModels() {
        if (!cheatingDaddy.listCliModels) return;
        this._loadingCliModels = true;
        this.requestUpdate();
        try {
            const res = await cheatingDaddy.listCliModels({
                geminiPath: this._cliGeminiPath,
                useSubscriptionAuth: this._cliUseSubscriptionAuth,
            });
            if (res?.supported && Array.isArray(res.models) && res.models.length > 0) {
                this._agyLiveModels = res.models;
                const families = this._getAgyFamilies();
                if (resolveAgyModelSelection(this._cliGeminiModel, families).mode !== 'custom') {
                    this._useCustomGeminiModel = false;
                }
            }
        } catch (e) {
            console.error('Error loading CLI models:', e);
        } finally {
            this._loadingCliModels = false;
            this.requestUpdate();
        }
    }

    async _saveCliClaudeModel(val) {
        this._cliClaudeModel = val;
        await cheatingDaddy.storage.updatePreference('cliClaudeModel', val);
        this.requestUpdate();
    }

    async _saveCliClaudeEffort(level) {
        this._cliClaudeEffort = level;
        await cheatingDaddy.storage.updatePreference('cliClaudeEffort', level);
        this.requestUpdate();
    }

    async _selectCliClaudeModel(val) {
        if (val === 'custom') {
            this._useCustomClaudeModel = true;
            this.requestUpdate();
            return;
        }
        this._useCustomClaudeModel = false;
        await this._saveCliClaudeModel(val);
    }

    async _saveCliGeminiModel(val) {
        this._cliGeminiModel = val;
        await cheatingDaddy.storage.updatePreference('cliGeminiModel', val);
        this.requestUpdate();
    }

    async _selectAgyFamily(value) {
        if (value === 'custom') {
            this._useCustomGeminiModel = true;
            this.requestUpdate();
            return;
        }
        this._useCustomGeminiModel = false;
        if (value === 'auto') {
            await this._saveCliGeminiModel('auto');
            return;
        }

        const families = this._getAgyFamilies();
        const family = families.find(f => f.baseId === value);
        if (!family) {
            await this._saveCliGeminiModel(value);
            return;
        }
        if (family.fixedId) {
            await this._saveCliGeminiModel(family.fixedId);
            return;
        }

        const currentSelection = resolveAgyModelSelection(this._cliGeminiModel, families);
        const desiredTier = currentSelection.tier;
        const nextTierObj =
            (desiredTier && family.tiers.find(t => t.tier === desiredTier)) ||
            family.tiers.find(t => t.tier === 'low') ||
            family.tiers.find(t => t.tier === 'medium') ||
            family.tiers[0];
        if (nextTierObj) {
            await this._saveCliGeminiModel(nextTierObj.id);
        }
    }

    async _selectAgyTier(family, tier) {
        if (!family) return;
        const match = family.tiers.find(t => t.tier === tier);
        if (match) {
            this._useCustomGeminiModel = false;
            await this._saveCliGeminiModel(match.id);
        }
    }

    async _saveCliClaudePath(val) {
        this._cliClaudePath = val;
        this._cliError = '';
        await cheatingDaddy.storage.updatePreference('cliClaudePath', val);
        this.requestUpdate();
    }

    async _saveCliGeminiPath(val) {
        this._cliGeminiPath = val;
        this._cliError = '';
        await cheatingDaddy.storage.updatePreference('cliGeminiPath', val);
        this.requestUpdate();
    }

    _handleProfileChange(e) {
        this.onProfileChange(e.target.value);
    }

    _openLocalHelp() {
        this._showLocalHelp = true;
    }

    _closeLocalHelp() {
        this._showLocalHelp = false;
    }

    _openCliHelp() {
        this._showCliHelp = true;
    }

    _closeCliHelp() {
        this._showCliHelp = false;
    }

    _handleHelpDialogClick(e) {
        e.stopPropagation();
    }

    // ── Start ──

    _handleStart() {
        if (this.isInitializing || this.downloadProgress.active) return;

        if (this._mode === 'local') {
            if (!this._localLlmModel.trim()) {
                return;
            }
        }
        if (this._usesCli()) {
            this._cliError = '';
            if (this._cliStatus && !this._cliStatus.claude?.installed && !this._cliStatus.gemini?.installed) {
                this._cliError = 'Neither Claude CLI nor Gemini CLI was found. Install at least one CLI or specify a custom path.';
                this.requestUpdate();
                return;
            }
        }
        if (this._usesApi()) {
            const needsGemini = this._mode === 'byok' || this._mixedRoutes.voice === 'byok';
            if (!this._hasApiKey('gemini') && (needsGemini || !this._hasApiKey('groq'))) {
                this._keyError = true;
                this._startError = needsGemini ? 'Enter a Gemini API key first.' : 'Enter a Gemini or Groq API key first.';
                return;
            }
        }

        this.onStart();
    }

    triggerCliError(message = 'Could not start CLI session. Check CLI installation, custom path, or OAuth login status.') {
        this._cliError = message;
        this.requestUpdate();
    }

    triggerApiKeyError() {
        this._keyError = this._mode !== 'local';
        this.requestUpdate();
        setTimeout(() => {
            this._tokenError = false;
            this._keyError = false;
            this.requestUpdate();
        }, 2000);
    }

    // ── Render helpers ──

    _renderStartButton() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isDownloading = (this._mode === 'local' || this._usesCli()) && this.downloadProgress.active;
        const percentage = this.downloadProgress.percentage;
        const hasPercentage = Number.isFinite(percentage);

        const cmdIcon = html`<svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path
                d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
            />
        </svg>`;
        const ctrlIcon = html`<svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M6 15l6-6 6 6" />
        </svg>`;
        const enterIcon = html`<svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M9 10l-5 5 5 5" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        </svg>`;

        return html`
            <button
                class="start-button ${this.isInitializing || isDownloading ? 'disabled' : ''}"
                ?disabled=${this.isInitializing || isDownloading}
                @click=${() => this._handleStart()}
            >
                ${
                    isDownloading
                        ? html`<span
                              class="download-progress-fill ${hasPercentage ? '' : 'indeterminate'}"
                              style=${hasPercentage ? `width: ${percentage}%` : ''}
                          ></span>`
                        : ''
                }
                <span class="btn-label">
                    ${isDownloading ? (hasPercentage ? `${percentage}%` : 'Preparing...') : 'Start Session'}
                    ${isDownloading ? '' : html`<span class="shortcut-hint">${isMac ? cmdIcon : ctrlIcon}${enterIcon}</span>`}
                </span>
            </button>
            ${
                isDownloading
                    ? html`
                          <div class="download-controls">
                              <span>Downloading: ${this.downloadProgress.label || 'Local AI files'}</span>
                              <button class="download-cancel" @click=${() => this.onCancelDownload()}>Cancel</button>
                          </div>
                      `
                    : ''
            }
        `;
    }

    _renderModeSwitch() {
        return html`
            <div class="mode-switch" role="radiogroup" aria-label="AI provider mode">
                ${MODE_OPTIONS.map(
                    option => html`
                        <button
                            type="button"
                            role="radio"
                            aria-checked=${this._mode === option.value ? 'true' : 'false'}
                            class="mode-tab ${this._mode === option.value ? 'active' : ''}"
                            data-mode=${option.value}
                            @click=${() => this._saveMode(option.value)}
                        >
                            <span class="mode-tab-title">${option.label}</span>
                            <span class="mode-tab-hint">${option.hint}</span>
                        </button>
                    `
                )}
            </div>
        `;
    }

    // ── API mode ──

    _renderConfigChevron() {
        return html`
            <svg class="config-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
    }

    _renderKeyBackups(provider, label) {
        const keys = this._backupKeys[provider];
        return html`
            <div class="form-group" data-backups=${provider}>
                <label class="form-label">Backup ${label} keys</label>
                ${keys.map(
                    (key, index) => html`
                        <div class="key-row">
                            <input
                                type="password"
                                placeholder="Backup key ${index + 1}"
                                .value=${key}
                                @input=${e =>
                                    this._saveBackupKeys(
                                        provider,
                                        this._backupKeys[provider].map((existing, position) => (position === index ? e.target.value : existing))
                                    )}
                            />
                            <button
                                type="button"
                                class="context-action-btn key-remove"
                                aria-label="Remove backup key ${index + 1}"
                                @click=${() =>
                                    this._saveBackupKeys(
                                        provider,
                                        this._backupKeys[provider].filter((_, position) => position !== index)
                                    )}
                            >
                                Remove
                            </button>
                        </div>
                    `
                )}
                <div>
                    <button
                        type="button"
                        class="context-action-btn key-add"
                        @click=${() => this._saveBackupKeys(provider, [...this._backupKeys[provider], ''])}
                    >
                        + Add backup key
                    </button>
                </div>
                <div class="form-hint">Used automatically when the key above hits its limit or is rejected.</div>
            </div>
        `;
    }

    _renderStartError() {
        return this._startError ? html`<div class="config-note" role="alert">${this._startError}</div>` : '';
    }

    _renderByokMode() {
        return html` ${this._renderStartError()} ${this._renderStartButton()} ${this._renderApiSections()} `;
    }

    _renderApiSections() {
        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Gemini</span>
                        <span class="config-summary-description">API key and models</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="form-group">
                        <label class="form-label">Gemini API Key</label>
                        <input
                            type="password"
                            placeholder="Required"
                            .value=${this._geminiKey}
                            @input=${e => this._saveGeminiKey(e.target.value)}
                            class=${this._keyError ? 'error' : ''}
                        />
                        <div class="form-hint">
                            <span class="link" @click=${() => this.onExternalLink('https://aistudio.google.com/apikey')}>Get Gemini key</span>
                        </div>
                    </div>

                    ${this._renderKeyBackups('gemini', 'Gemini')}
                    ${this._renderGeminiModelSelect({
                        field: 'live',
                        label: 'Gemini Live Model',
                        value: this._geminiLiveModel,
                        choices: geminiModelChoices(GEMINI_LIVE_MODEL_PRESETS, this._geminiModelLists?.live),
                        save: val => this._saveGeminiLiveModel(val),
                    })}
                    ${this._renderGeminiModelSelect({
                        field: 'screen',
                        label: 'Gemini Model for screen analysis',
                        value: this._geminiModel,
                        choices: geminiModelChoices(GEMINI_MODEL_PRESETS, this._geminiModelLists?.generate),
                        save: val => this._saveGeminiModel(val),
                    })}

                    <div class="form-hint">
                        <span class="link" @click=${() => this._loadGeminiModels()}>Load models available to my key</span>
                        ${this._geminiModelStatus ? html`<div>${this._geminiModelStatus}</div>` : ''}
                    </div>
                    <div class="config-note">The screen analysis model is used when no Groq API key is set.</div>
                </div>
            </details>

            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">AI responses</span>
                        <span class="config-summary-description">Groq key and response model</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="form-group">
                        <label class="form-label">Groq API Key</label>
                        <input type="password" placeholder="Optional" .value=${this._groqKey} @input=${e => this._saveGroqKey(e.target.value)} />
                        <div class="form-hint">
                            <span class="link" @click=${() => this.onExternalLink('https://console.groq.com/keys')}>Get Groq key</span>
                        </div>
                    </div>

                    ${this._renderKeyBackups('groq', 'Groq')}

                    <div class="form-group">
                        <label class="form-label">Groq Model</label>
                        <input type="text" .value=${this._groqModel} @input=${e => this._saveGroqModel(e.target.value)} />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Groq Image Model</label>
                        <input type="text" .value=${this._groqImageModel} @input=${e => this._saveGroqImageModel(e.target.value)} />
                    </div>

                    <label class="config-checkbox">
                        <input
                            type="checkbox"
                            .checked=${this._disableGroqThinking}
                            @change=${e => this._saveDisableGroqThinking(e.target.checked)}
                        />
                        <span class="config-checkbox-text">
                            <span class="config-summary-title">Disable thinking</span>
                            <span class="config-summary-description">Faster responses with less internal reasoning</span>
                        </span>
                    </label>

                    <div class="config-note">
                        If the Groq API key is empty, Gemini Live is used for answers instead. Its answer quality may be lower.
                    </div>
                </div>
            </details>
        `;
    }

    // ── Mixed mode ──

    _renderMixedRoutes() {
        return html`
            <div class="quick-settings-card">
                ${MIXED_ROUTE_FIELDS.map(
                    field => html`
                        <div class="form-group route-row" data-route=${field.task}>
                            <label class="form-label">${field.label}</label>
                            <select @change=${e => this._saveMixedRoute(field.task, e.target.value)}>
                                ${field.options.map(
                                    option =>
                                        html`<option value=${option.value} .selected=${this._mixedRoutes[field.task] === option.value}>
                                            ${option.label}
                                        </option>`
                                )}
                            </select>
                        </div>
                    `
                )}
                <div class="form-hint">The CLI also receives what the API answered. Gemini Live does not see the CLI answers.</div>
            </div>
        `;
    }

    _renderMixedMode() {
        return html`
            ${this._usesCli() ? html`${this._renderCliStatusBar()} ${this._renderCliError()}` : ''} ${this._renderStartError()}
            ${this._renderStartButton()}
            ${
                this._usesCli()
                    ? html`${this._renderCliProviderSection()} ${this._renderCliModelsSection()}
                      ${this._mixedRoutes.voice === 'cli' ? this._renderCliVoiceSection({ optional: false }) : ''} ${this._renderCliPathsSection()}`
                    : ''
            }
            ${this._usesApi() ? this._renderApiSections() : ''}
        `;
    }

    _getWhisperModelShortLabel() {
        if (this._whisperModel === 'small-q5_1') return 'Small Q5';
        if (this._whisperModel === 'base-q5_1') return 'Base Q5';
        if (this._whisperModel === 'large-v3-turbo-q5_0') return 'Large v3 Turbo';
        return this._whisperModel;
    }

    _getAudioModeShortLabel() {
        if (this._audioMode === 'mic_only') return 'Mic only';
        if (this._audioMode === 'both') return 'Mic + System';
        return 'System audio';
    }

    _renderCliAudioControls() {
        const activeLanguage = this._selectedLanguage || this.selectedLanguage || 'auto';
        const hasPresetLanguage = SPEECH_LANGUAGE_OPTIONS.some(option => option.value === activeLanguage);
        const isEnglishOnlyModel = String(this._whisperModel || '').endsWith('.en');
        const isNonEnglishOrAuto = !String(activeLanguage).toLowerCase().startsWith('en');
        const isWeakMultilingualModel =
            (this._whisperModel === 'tiny' || this._whisperModel === 'base' || this._whisperModel === 'base-q5_1') && isNonEnglishOrAuto;
        const showWhisperWarning = (isEnglishOnlyModel || isWeakMultilingualModel) && isNonEnglishOrAuto;
        const isHeavyTurboModel = this._whisperModel === 'large-v3-turbo-q5_0';

        return html`
            <div class="form-group">
                <label class="form-label">Audio Input</label>
                <select .value=${this._audioMode} @change=${e => this._saveAudioMode(e.target.value)}>
                    ${AUDIO_INPUT_OPTIONS.map(
                        option => html`<option value=${option.value} ?selected=${this._audioMode === option.value}>${option.label}</option>`
                    )}
                </select>
                <div class="form-hint">Choose Microphone Only or Both if you are speaking; System Audio Only captures Zoom/Meet output.</div>
            </div>

            ${
                this._audioMode === 'both'
                    ? html`
                          <label class="config-checkbox">
                              <input
                                  type="checkbox"
                                  .checked=${this._cliMicContextOnly}
                                  @change=${e => this._saveCliMicContextOnly(e.target.checked)}
                              />
                              <span class="config-checkbox-text">
                                  <span class="config-summary-title">Silent microphone context (recommended for 1-on-1 calls)</span>
                                  <span class="config-summary-description"
                                      >Buffers your speech for context without changing the screen; click "Continue" during a session if you get
                                      stuck</span
                                  >
                              </span>
                          </label>
                      `
                    : ''
            }

            <div class="form-group">
                <label class="form-label">Speech Language</label>
                <select .value=${activeLanguage} @change=${e => this._saveSelectedLanguage(e.target.value)}>
                    ${SPEECH_LANGUAGE_OPTIONS.map(
                        option => html`<option value=${option.value} ?selected=${activeLanguage === option.value}>${option.label}</option>`
                    )}
                    ${!hasPresetLanguage && activeLanguage ? html`<option value=${activeLanguage} selected>Custom (${activeLanguage})</option>` : ''}
                </select>
                <div class="form-hint">Pick Ukrainian (uk-UA) for best Ukrainian accuracy, or Auto-detect for mixed speech.</div>
            </div>

            ${this._renderWhisperSelect()}
            ${
                showWhisperWarning
                    ? html`
                          <div class="whisper-warning">
                              ${
                                  isEnglishOnlyModel
                                      ? `English-only Whisper model (${this._whisperModel}) cannot transcribe ${activeLanguage === 'auto' ? 'multilingual / Ukrainian' : activeLanguage} speech accurately.`
                                      : `Model "${this._whisperModel}" can misclassify Ukrainian${activeLanguage === 'auto' ? ' (especially with Auto-detect)' : ''}. Switch to Small Q5 + Ukrainian (uk-UA) for fast, accurate recognition.`
                              }
                              <div>
                                  <button class="whisper-fix-btn" @click=${() => this._applyUkrainianWhisperPreset()}>
                                      Use Small Q5 + Ukrainian (uk-UA)
                                  </button>
                              </div>
                          </div>
                      `
                    : ''
            }
            ${isHeavyTurboModel ? html` <div class="form-hint">Best Ukrainian accuracy (~1.1s on Vulkan GPU, ~6s on CPU-only).</div> ` : ''}
        `;
    }

    _renderWhisperSelect() {
        const language = this._selectedLanguage || this.selectedLanguage || 'auto';
        const suggestedModel = suggestWhisperUpgrade(this._whisperModel, language);
        return html`
            <div class="form-group">
                <div class="whisper-label-row">
                    <label class="form-label">Whisper Model</label>
                    ${this.whisperDownloading ? html`<div class="whisper-spinner"></div>` : ''}
                </div>
                <select .value=${this._whisperModel} @change=${e => this._saveWhisperModel(e.target.value)}>
                    ${WHISPER_MODEL_OPTIONS.map(
                        option => html`<option value=${option.value} ?selected=${this._whisperModel === option.value}>${option.label}</option>`
                    )}
                </select>
                <div class="form-hint">${this.whisperDownloading ? 'Downloading model...' : 'Downloaded automatically on first use'}</div>
            </div>
            ${
                suggestedModel
                    ? html`
                          <div class="whisper-suggest">
                              Words are misheard sometimes ("terabyte" can become "you spend"). Large v3 Turbo understands Ukrainian and other
                              non-English speech noticeably better (about 1 s per phrase with a GPU, around 6 s on CPU only).
                              <div>
                                  <button class="whisper-fix-btn" @click=${() => this._saveWhisperModel(suggestedModel)}>
                                      Switch to Large v3 Turbo
                                  </button>
                              </div>
                          </div>
                      `
                    : ''
            }
            <div class="form-group">
                <label class="form-label">Vocabulary hints (optional)</label>
                <textarea
                    rows="2"
                    maxlength=${SPEECH_VOCABULARY_MAX_LENGTH}
                    placeholder="Words you expect to hear, for example: terabyte, SQL, Kubernetes"
                    .value=${this._speechVocabulary}
                    @input=${e => this._saveSpeechVocabulary(e.target.value)}
                ></textarea>
                <div class="form-hint">Helps Whisper spell names and terms correctly. Keep it short and use only words you really expect.</div>
            </div>
        `;
    }

    _getCliStatusBadge(status) {
        if (!status) {
            return { dotClass: 'warn', label: 'Checking...' };
        }
        if (!status.installed) {
            return { dotClass: 'missing', label: 'Not installed' };
        }
        if (status.authStatus === 'authenticated') {
            return { dotClass: 'ok', label: status.version ? `Ready · ${status.version}` : 'Ready' };
        }
        if (status.authStatus === 'unauthenticated') {
            return { dotClass: 'warn', label: 'Login required' };
        }
        return { dotClass: 'ok', label: status.version ? `Installed · ${status.version}` : 'Installed' };
    }

    _renderCliCardAction(provider, status) {
        if (!status) {
            return '';
        }
        const busy = this._launchingCliSetup === provider;
        if (!status.installed) {
            return html`
                <div class="cli-card-actions">
                    <button type="button" class="cli-setup-btn primary" ?disabled=${busy} @click=${() => this._launchCliSetup(provider, 'install')}>
                        ${busy ? 'Opening...' : 'Install & Sign In'}
                    </button>
                </div>
            `;
        }
        if (status.authStatus === 'unauthenticated') {
            return html`
                <div class="cli-card-actions">
                    <button type="button" class="cli-setup-btn warn" ?disabled=${busy} @click=${() => this._launchCliSetup(provider, 'login')}>
                        ${busy ? 'Opening...' : 'Sign In'}
                    </button>
                </div>
            `;
        }
        return html`
            <div class="cli-card-actions">
                <button type="button" class="cli-setup-btn subtle" ?disabled=${busy} @click=${() => this._launchCliSetup(provider, 'login')}>
                    ${busy ? 'Opening...' : 'Re-login'}
                </button>
            </div>
        `;
    }

    _renderCliStatusBar() {
        const claudeStatus = this._cliStatus?.claude || null;
        const geminiStatus = this._cliStatus?.gemini || null;
        const claudeBadge = this._getCliStatusBadge(claudeStatus);
        const geminiBadge = this._getCliStatusBadge(geminiStatus);

        return html`
            <div class="cli-status-bar">
                <div class="cli-status-header">
                    <span class="form-label">CLI Availability</span>
                    <button class="cli-refresh-btn" ?disabled=${this._checkingCliStatus} @click=${() => this._refreshCliStatus()}>
                        ${this._checkingCliStatus ? 'Checking...' : 'Refresh'}
                    </button>
                </div>
                <div class="cli-status-cards">
                    <div class="cli-status-card ${this._cliPrimaryProvider === 'claude' ? 'active-primary' : ''}">
                        <div class="cli-status-title-row">
                            <span class="cli-status-dot ${claudeBadge.dotClass}"></span>
                            <span class="cli-status-name">Claude CLI</span>
                        </div>
                        <div class="cli-status-meta" title=${claudeStatus?.resolvedPath || claudeBadge.label}>${claudeBadge.label}</div>
                        ${this._renderCliCardAction('claude', claudeStatus)}
                    </div>
                    <div class="cli-status-card ${this._cliPrimaryProvider === 'gemini' ? 'active-primary' : ''}">
                        <div class="cli-status-title-row">
                            <span class="cli-status-dot ${geminiBadge.dotClass}"></span>
                            <span class="cli-status-name">${geminiStatus?.engine === 'agy' ? 'Gemini (agy)' : 'Gemini CLI'}</span>
                        </div>
                        <div class="cli-status-meta" title=${geminiStatus?.resolvedPath || geminiBadge.label}>${geminiBadge.label}</div>
                        ${this._renderCliCardAction('gemini', geminiStatus)}
                    </div>
                </div>
                ${
                    this._cliSetupNotice
                        ? html`
                              <div class="cli-setup-notice">
                                  <span>${this._cliSetupNotice}</span>
                                  <button
                                      type="button"
                                      class="cli-setup-btn subtle"
                                      ?disabled=${this._checkingCliStatus}
                                      @click=${() => this._checkCliSetupStatus()}
                                  >
                                      Check status
                                  </button>
                              </div>
                          `
                        : ''
                }
            </div>
        `;
    }

    _renderCliModelsSection() {
        const families = this._getAgyFamilies();
        const selection = resolveAgyModelSelection(this._cliGeminiModel, families);
        const agySelectValue = this._useCustomGeminiModel
            ? 'custom'
            : selection.mode === 'auto'
              ? 'auto'
              : selection.mode === 'family'
                ? selection.family.baseId
                : 'custom';
        const isGeminiPrimary = this._cliPrimaryProvider === 'gemini';
        const isClaudePrimary = this._cliPrimaryProvider === 'claude';
        const totalLiveModels = this._agyLiveModels.length;

        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">AI Models &amp; Effort</span>
                        <span class="config-summary-description"
                            >Google: ${this._cliGeminiModel} · Claude:
                            ${this._cliClaudeModel}${this._cliClaudeEffort !== 'auto' ? ` (${this._cliClaudeEffort})` : ''}</span
                        >
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="models-toolbar">
                        <span class="models-sync-meta"
                            >${
                                totalLiveModels > 0
                                    ? `Synced live: ${totalLiveModels} Google/agy models`
                                    : `${DEFAULT_AGY_MODELS.length} Google/agy presets loaded`
                            }</span
                        >
                        <button class="cli-refresh-btn" ?disabled=${this._loadingCliModels} @click=${() => this._refreshCliModels()}>
                            ${this._loadingCliModels ? 'Refreshing...' : 'Refresh models'}
                        </button>
                    </div>

                    <div class="model-card ${isGeminiPrimary ? 'primary' : ''}">
                        <div class="model-card-header">
                            <div class="model-card-title-row">
                                <span class="model-card-title">Google AI Pro (agy)</span>
                                <span class="model-role-badge ${isGeminiPrimary ? 'primary' : ''}">${isGeminiPrimary ? 'Primary' : 'Fallback'}</span>
                            </div>
                            <span class="model-id-badge" title=${this._cliGeminiModel}>${this._cliGeminiModel}</span>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Model Family</label>
                            <select .value=${agySelectValue} @change=${e => this._selectAgyFamily(e.target.value)}>
                                ${AGY_GROUP_ORDER.map(groupName => {
                                    const groupFamilies = families.filter(f => f.group === groupName);
                                    if (groupFamilies.length === 0) return '';
                                    return html`
                                        <optgroup label=${groupName}>
                                            ${groupFamilies.map(
                                                family =>
                                                    html`<option
                                                        value=${family.baseId}
                                                        ?selected=${
                                                            !this._useCustomGeminiModel &&
                                                            selection.mode === 'family' &&
                                                            selection.family?.baseId === family.baseId
                                                        }
                                                    >
                                                        ${family.baseId === 'gemini-4-hydrogen' ? `${family.label} · Recommended` : family.label}
                                                    </option>`
                                            )}
                                        </optgroup>
                                    `;
                                })}
                                <option value="auto" ?selected=${!this._useCustomGeminiModel && selection.mode === 'auto'}>Auto (CLI default)</option>
                                <option value="custom" ?selected=${this._useCustomGeminiModel}>Custom model ID…</option>
                            </select>
                        </div>

                        ${
                            !this._useCustomGeminiModel && selection.mode === 'family' && selection.family.tiers.length > 0
                                ? html`
                                      <div class="effort-row">
                                          <span class="form-label">Reasoning Strength</span>
                                          <div class="effort-pills">
                                              ${selection.family.tiers.map(
                                                  t =>
                                                      html`<button
                                                          type="button"
                                                          class="effort-pill ${selection.tier === t.tier ? 'active' : ''}"
                                                          @click=${() => this._selectAgyTier(selection.family, t.tier)}
                                                      >
                                                          ${EFFORT_TIER_LABELS[t.tier] || t.tier}
                                                      </button>`
                                              )}
                                          </div>
                                          <div class="form-hint">Low = fastest · Medium = balanced · High/XHigh = deeper reasoning</div>
                                      </div>
                                  `
                                : !this._useCustomGeminiModel && selection.mode === 'family' && selection.family.fixedId
                                  ? html`<div class="form-hint">Fixed-tier model preset (${selection.family.fixedId}).</div>`
                                  : ''
                        }
                        ${
                            this._useCustomGeminiModel
                                ? html`
                                      <input
                                          type="text"
                                          placeholder="e.g. gemini-4-hydrogen-medium"
                                          .value=${this._cliGeminiModel}
                                          @input=${e => this._saveCliGeminiModel(e.target.value)}
                                      />
                                  `
                                : ''
                        }
                    </div>

                    <div class="model-card ${isClaudePrimary ? 'primary' : ''}">
                        <div class="model-card-header">
                            <div class="model-card-title-row">
                                <span class="model-card-title">Claude Code CLI</span>
                                <span class="model-role-badge ${isClaudePrimary ? 'primary' : ''}">${isClaudePrimary ? 'Primary' : 'Fallback'}</span>
                            </div>
                            <span class="model-id-badge" title=${this._cliClaudeModel}
                                >${this._cliClaudeModel}${this._cliClaudeEffort !== 'auto' ? ` · ${this._cliClaudeEffort}` : ''}</span
                            >
                        </div>

                        <div class="form-group">
                            <label class="form-label">Model</label>
                            <select
                                .value=${this._useCustomClaudeModel ? 'custom' : this._cliClaudeModel}
                                @change=${e => this._selectCliClaudeModel(e.target.value)}
                            >
                                ${CLAUDE_MODEL_PRESETS.map(
                                    preset =>
                                        html`<option
                                            value=${preset.value}
                                            ?selected=${!this._useCustomClaudeModel && this._cliClaudeModel === preset.value}
                                        >
                                            ${preset.label}
                                        </option>`
                                )}
                                <option value="custom" ?selected=${this._useCustomClaudeModel}>Custom Claude model…</option>
                            </select>
                            ${
                                this._useCustomClaudeModel
                                    ? html`
                                          <input
                                              type="text"
                                              placeholder="e.g. claude-sonnet-4-6"
                                              .value=${this._cliClaudeModel}
                                              @input=${e => this._saveCliClaudeModel(e.target.value)}
                                          />
                                      `
                                    : ''
                            }
                        </div>

                        <div class="effort-row">
                            <span class="form-label">Thinking Effort (--effort)</span>
                            <div class="effort-pills">
                                ${CLAUDE_EFFORT_OPTIONS.map(
                                    opt =>
                                        html`<button
                                            type="button"
                                            class="effort-pill ${this._cliClaudeEffort === opt.value ? 'active' : ''}"
                                            @click=${() => this._saveCliClaudeEffort(opt.value)}
                                        >
                                            ${opt.label}
                                        </button>`
                                )}
                            </div>
                            <div class="form-hint">Auto = CLI default · Low = fastest · Medium = balanced · High/XHigh/Max = deepest reasoning</div>
                        </div>
                    </div>
                </div>
            </details>
        `;
    }

    _renderCliMode() {
        return html`
            ${this._renderCliStatusBar()} ${this._renderCliError()} ${this._renderStartButton()} ${this._renderCliProviderSection()}
            ${this._renderCliModelsSection()} ${this._renderCliVoiceSection({ optional: true })} ${this._renderCliPathsSection()}
        `;
    }

    _renderCliError() {
        if (!this._cliError) return '';
        return html`
            <div class="cli-error-banner">
                ${this._cliError}
                <span class="link" @click=${this._openCliHelp}> Setup guide</span>
            </div>
        `;
    }

    _renderCliProviderSection() {
        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">CLI Provider</span>
                        <span class="config-summary-description">Primary subscription & auto-fallback</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="form-group">
                        <label class="form-label">Primary CLI</label>
                        <select .value=${this._cliPrimaryProvider} @change=${e => this._saveCliPrimaryProvider(e.target.value)}>
                            <option value="claude" ?selected=${this._cliPrimaryProvider === 'claude'}>Claude Code CLI (Claude Pro)</option>
                            <option value="gemini" ?selected=${this._cliPrimaryProvider === 'gemini'}>Google AI Pro (Antigravity CLI / agy)</option>
                        </select>
                    </div>

                    <label class="config-checkbox">
                        <input type="checkbox" .checked=${this._cliFallbackEnabled} @change=${e => this._saveCliFallbackEnabled(e.target.checked)} />
                        <span class="config-checkbox-text">
                            <span class="config-summary-title">Auto-fallback to secondary CLI</span>
                            <span class="config-summary-description">Switch automatically on rate limits or errors</span>
                        </span>
                    </label>

                    <label class="config-checkbox">
                        <input
                            type="checkbox"
                            .checked=${this._cliUseSubscriptionAuth}
                            @change=${e => this._saveCliUseSubscriptionAuth(e.target.checked)}
                        />
                        <span class="config-checkbox-text">
                            <span class="config-summary-title">Use subscription login (OAuth)</span>
                            <span class="config-summary-description">Ignore ANTHROPIC_API_KEY / GEMINI_API_KEY env vars</span>
                        </span>
                    </label>
                </div>
            </details>
        `;
    }

    // In mixed mode with voice on the CLI, Whisper is always on, so there is nothing to switch
    _renderCliVoiceSection({ optional }) {
        const enabled = !optional || this._cliWhisperEnabled;
        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Voice Transcription</span>
                        <span class="config-summary-description"
                            >${
                                enabled
                                    ? `Whisper (${this._getWhisperModelShortLabel()}) · ${this._getAudioModeShortLabel()} · ${this._selectedLanguage || this.selectedLanguage || 'auto'}`
                                    : 'Disabled (text & screen only)'
                            }</span
                        >
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    ${
                        optional
                            ? html`<label class="config-checkbox">
                                  <input
                                      type="checkbox"
                                      .checked=${this._cliWhisperEnabled}
                                      @change=${e => this._saveCliWhisperEnabled(e.target.checked)}
                                  />
                                  <span class="config-checkbox-text">
                                      <span class="config-summary-title">Enable local Whisper voice transcription</span>
                                      <span class="config-summary-description">Offline speech-to-text via whisper.cpp (supports Ukrainian)</span>
                                  </span>
                              </label>`
                            : ''
                    }
                    ${enabled ? this._renderCliAudioControls() : ''}
                </div>
            </details>
        `;
    }

    _renderCliPathsSection() {
        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Custom CLI Executable Paths</span>
                        <span class="config-summary-description">Optional manual overrides for claude / agy binaries</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="form-group">
                        <label class="form-label">Claude Executable Path (optional)</label>
                        <input
                            type="text"
                            placeholder="Auto-detected from PATH"
                            .value=${this._cliClaudePath}
                            @input=${e => this._saveCliClaudePath(e.target.value)}
                            @blur=${() => this._refreshCliStatus()}
                        />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Google / agy Executable Path (optional)</label>
                        <input
                            type="text"
                            placeholder="Auto-detected from PATH"
                            .value=${this._cliGeminiPath}
                            @input=${e => this._saveCliGeminiPath(e.target.value)}
                            @blur=${() => {
                                this._refreshCliStatus();
                                this._refreshCliModels();
                            }}
                        />
                    </div>
                </div>
            </details>
        `;
    }

    // ── Local AI mode ──

    _renderLocalMode() {
        return html`
            ${this._renderStartButton()}

            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Language model</span>
                        <span class="config-summary-description">Local GGUF model</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <div class="form-group">
                        <label class="form-label">Model</label>
                        <select
                            .value=${this._useCustomLocalLlmModel ? 'custom' : this._localLlmModel}
                            @change=${event => this._selectLocalLlmModel(event.target.value)}
                        >
                            ${LOCAL_LLM_PRESETS.map(preset => html`<option value=${preset.value}>${preset.label}</option>`)}
                            <option value="custom">Custom Hugging Face model or local GGUF…</option>
                        </select>
                        ${
                            this._useCustomLocalLlmModel
                                ? html`
                                      <input
                                          type="text"
                                          placeholder="owner/repository:quant or /absolute/model.gguf"
                                          .value=${this._localLlmModel}
                                          @input=${event => this._saveLocalLlmModel(event.target.value)}
                                      />
                                  `
                                : ''
                        }
                        <div class="form-hint">Sizes include the vision model. Q4 uses less memory; Q8 preserves more quality.</div>
                    </div>
                </div>
            </details>

            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Transcription</span>
                        <span class="config-summary-description">Whisper speech-to-text model</span>
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">${this._renderWhisperSelect()}</div>
            </details>
        `;
    }

    // ── Main render ──

    _renderSessionQuickSettings() {
        const activeProfile = this.selectedProfile || 'interview';
        const activeResponseLanguage = this._responseLanguage || 'auto';

        return html`
            <div class="quick-settings-card">
                <div class="quick-settings-grid">
                    <div class="form-group">
                        <label class="form-label">Preset</label>
                        <select .value=${activeProfile} @change=${e => this._saveProfile(e.target.value)}>
                            ${this._presetOptions.map(
                                option => html`<option value=${option.value} ?selected=${activeProfile === option.value}>${option.label}</option>`
                            )}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Response Language</label>
                        <select .value=${activeResponseLanguage} @change=${e => this._saveResponseLanguage(e.target.value)}>
                            ${RESPONSE_LANGUAGE_OPTIONS.map(
                                option =>
                                    html`<option value=${option.value} ?selected=${activeResponseLanguage === option.value}>${option.label}</option>`
                            )}
                        </select>
                    </div>
                </div>
                <div class="form-hint">AI replies in this language unless the task explicitly asks for another.</div>
            </div>
        `;
    }

    _formatCompactChars(chars) {
        const count = Number(chars) || 0;
        if (count >= 1000) {
            return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k chars`;
        }
        return `${count} chars`;
    }

    _renderContextFolderCard() {
        const summary = this._contextFolderSummary;
        const enabled = this._contextFolderEnabled;
        const files = Array.isArray(summary?.files) ? summary.files : [];
        const visibleFiles = files.slice(0, 6);
        const hiddenCount = Math.max(0, files.length - visibleFiles.length);
        const isRag = enabled && summary?.mode === 'rag';
        const isInline = enabled && summary?.mode === 'inline';

        let pillText = 'Empty';
        let pillClass = '';
        if (!enabled) {
            pillText = 'Off';
        } else if (isRag) {
            pillText = `${summary.loadedFileCount} files · ${this._formatCompactChars(summary.totalChars)} · Smart search`;
            pillClass = 'rag';
        } else if (isInline) {
            pillText = `${summary.loadedFileCount} ${summary.loadedFileCount === 1 ? 'file' : 'files'} · ${this._formatCompactChars(summary.totalChars)} · Full`;
            pillClass = 'active';
        } else if (summary?.totalFileCount > 0) {
            pillText = `${summary.totalFileCount} file(s) unreadable`;
        }

        return html`
            <div class="context-folder-card">
                <div class="context-folder-header">
                    <label class="context-folder-toggle">
                        <input type="checkbox" .checked=${this._contextFolderEnabled} @change=${e => this._toggleContextFolder(e.target.checked)} />
                        Context Folder
                    </label>
                    <span class="context-status-pill ${pillClass}">${this._loadingContextFolder ? 'Scanning...' : pillText}</span>
                </div>

                ${
                    summary?.folderPath
                        ? html`
                              <div class="context-folder-path-row">
                                  <span class="context-folder-path" title=${summary.folderPath}>${summary.folderPath}</span>
                                  ${summary.isDefault ? html`<span class="context-default-tag">Default folder</span>` : ''}
                              </div>
                          `
                        : ''
                }

                <div class="context-folder-actions">
                    <button type="button" class="context-action-btn" @click=${() => this._addContextFiles()}>+ Add Files</button>
                    <button type="button" class="context-action-btn" @click=${() => this._openContextFolder()}>Open Folder</button>
                    <button type="button" class="context-action-btn" @click=${() => this._chooseContextFolder()}>Choose Folder</button>
                    <button
                        type="button"
                        class="context-action-btn"
                        ?disabled=${this._loadingContextFolder}
                        @click=${() => this._refreshContextFolder(true)}
                    >
                        Refresh
                    </button>
                    ${
                        summary && !summary.isDefault
                            ? html`<button type="button" class="context-action-btn" @click=${() => this._resetDefaultContextFolder()}>
                                  Default
                              </button>`
                            : ''
                    }
                </div>

                ${
                    visibleFiles.length > 0
                        ? html`
                              <div class="context-file-chips">
                                  ${visibleFiles.map(file => {
                                      const isWarn = file.status !== 'loaded';
                                      const metaText = isWarn ? file.status : file.unitsLabel || this._formatCompactChars(file.charCount);
                                      return html`
                                          <span class="context-file-chip ${isWarn ? 'warn' : ''}" title=${file.reason || file.relativePath}>
                                              <span class="context-file-chip-name">${file.name}</span>
                                              <span class="context-file-chip-meta">${metaText}</span>
                                          </span>
                                      `;
                                  })}
                                  ${hiddenCount > 0 ? html`<span class="context-file-chip">+${hiddenCount} more</span>` : ''}
                              </div>
                          `
                        : html`<div class="form-hint">Drop PDF, PPTX, DOCX, MD, TXT — slides, docs, exam tickets.</div>`
                }
                ${this._contextFolderNotice ? html`<div class="context-folder-notice">${this._contextFolderNotice}</div>` : ''}
            </div>
        `;
    }

    render() {
        const helpIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0m9 5v.01" />
                <path d="M12 13.5a1.5 1.5 0 0 1 1-1.5a2.6 2.6 0 1 0-3-4" />
            </g>
        </svg>`;
        const closeIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12" />
        </svg>`;

        const mode = MODE_OPTIONS.find(option => option.value === this._mode) || MODE_OPTIONS[0];
        const hasCliHelp = this._mode === 'cli' || this._mode === 'mixed';

        return html`
            <div class="form-wrapper">
                <div class="title-row">
                    <div class="page-title">Cheating Daddy</div>
                    ${
                        hasCliHelp
                            ? html`<button class="help-btn" @click=${this._openCliHelp} aria-label="Open CLI setup help">${helpIcon}</button>`
                            : ''
                    }
                    ${
                        this._mode === 'local'
                            ? html`<button class="help-btn" @click=${this._openLocalHelp} aria-label="Open Local AI help">${helpIcon}</button>`
                            : ''
                    }
                </div>
                ${this._renderModeSwitch()}
                <div class="page-subtitle">${mode.description}</div>
                ${this._mode === 'mixed' ? this._renderMixedRoutes() : ''} ${this._renderSessionQuickSettings()} ${this._renderContextFolderCard()}
                ${this._mode === 'cli' ? this._renderCliMode() : ''} ${this._mode === 'byok' ? this._renderByokMode() : ''}
                ${this._mode === 'local' ? this._renderLocalMode() : ''} ${this._mode === 'mixed' ? this._renderMixedMode() : ''}
            </div>
            ${hasCliHelp && this._showCliHelp ? this._renderCliHelp(closeIcon) : ''}
            ${this._mode === 'local' && this._showLocalHelp ? this._renderLocalHelp(closeIcon) : ''}
        `;
    }

    _renderCliHelp(closeIcon) {
        return html`
            <div class="help-dialog-backdrop" @click=${this._closeCliHelp}>
                <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="cli-help-title" @click=${this._handleHelpDialogClick}>
                    <div class="help-dialog-header">
                        <div id="cli-help-title" class="help-dialog-title">CLI Subscription Setup</div>
                        <button class="help-btn" @click=${this._closeCliHelp} aria-label="Close CLI setup help">${closeIcon}</button>
                    </div>

                    <div class="help-content">
                        <div class="help-section">
                            <div class="help-section-title">1. Claude Code CLI (Claude Pro / Max)</div>
                            <div class="help-section-text">Install automatically with the button below (or via PowerShell / npm) and sign in:</div>
                            <code class="help-code">irm https://claude.ai/install.ps1 | iex</code>
                            <code class="help-code">npm install -g @anthropic-ai/claude-code && claude</code>
                            <div class="help-actions-row">
                                <button
                                    type="button"
                                    class="cli-setup-btn primary"
                                    ?disabled=${this._launchingCliSetup === 'claude'}
                                    @click=${() => this._launchCliSetup('claude', 'install')}
                                >
                                    ${this._launchingCliSetup === 'claude' ? 'Opening...' : 'Install & Sign In (Claude)'}
                                </button>
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">2. Google Antigravity CLI — agy (Google AI Pro)</div>
                            <div class="help-section-text">
                                Install automatically with the button below (or via PowerShell), then sign in with your Google AI Pro account:
                            </div>
                            <code class="help-code">irm https://antigravity.google/cli/install.ps1 | iex</code>
                            <code class="help-code">agy</code>
                            <div class="help-actions-row">
                                <button
                                    type="button"
                                    class="cli-setup-btn primary"
                                    ?disabled=${this._launchingCliSetup === 'gemini'}
                                    @click=${() => this._launchCliSetup('gemini', 'install')}
                                >
                                    ${this._launchingCliSetup === 'gemini' ? 'Opening...' : 'Install & Sign In (agy)'}
                                </button>
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">3. Live Switching & Auto-Fallback</div>
                            <div class="help-section-text">
                                During a session, click the <strong>[Claude ⇄]</strong> / <strong>[Gemini ⇄]</strong> badge in the top bar to switch
                                providers at any time. If one CLI hits a subscription quota limit, the other takes over automatically with
                                conversation context preserved.
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">4. Local Whisper Voice Transcription</div>
                            <div class="help-section-text">
                                Speech is transcribed locally with whisper.cpp (no external STT API keys required). Choose a multilingual model (e.g.
                                <strong>Base Multilingual</strong>) and select <strong>Ukrainian</strong> or <strong>Auto-detect</strong> in Settings.
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    _renderLocalHelp(closeIcon) {
        return html`
            <div class="help-dialog-backdrop" @click=${this._closeLocalHelp}>
                <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="local-help-title" @click=${this._handleHelpDialogClick}>
                    <div class="help-dialog-header">
                        <div id="local-help-title" class="help-dialog-title">Local AI setup</div>
                        <button class="help-btn" @click=${this._closeLocalHelp} aria-label="Close Local AI help">${closeIcon}</button>
                    </div>

                    <div class="help-content">
                        <div class="help-section">
                            <div class="help-section-title">Native local AI</div>
                            <div class="help-section-text">
                                Cheating Daddy runs llama.cpp and whisper.cpp directly. Everything stays on your computer — no external AI service or
                                Ollama installation is required.
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">Automatic setup</div>
                            <div class="help-section-text">
                                The correct native runners, selected Whisper model, and language model are downloaded and checksum-verified on first
                                use. They are stored in the Cheating Daddy config directory.
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">Default model</div>
                            <div class="help-models">
                                <div class="help-model">
                                    <span class="help-model-name">Qwen3.5 4B Q4_K_M</span><span>About 2.7 GB — balanced local quality and speed</span>
                                </div>
                            </div>
                        </div>

                        <div class="help-section">
                            <div class="help-section-title">Whisper</div>
                            <div class="help-section-text">
                                The selected whisper.cpp model is downloaded automatically once and kept in the config directory.
                            </div>
                        </div>

                        <hr class="help-divider" />

                        <div class="help-section">
                            <div class="help-section-title">Computer hanging or slow?</div>
                            <div class="help-section-text">
                                Running models locally uses a lot of RAM and CPU. If your computer slows down or freezes, it's likely the LLM. Switch
                                back to API mode if you want to use a hosted provider instead.
                            </div>
                        </div>

                        <button
                            class="help-cloud-btn"
                            @click=${() => {
                                this._closeLocalHelp();
                                this._saveMode('byok');
                            }}
                        >
                            Switch to API
                        </button>
                    </div>
                </section>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
