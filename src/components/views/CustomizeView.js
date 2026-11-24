import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

export class CustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .usage-row {
                display: flex;
                align-items: center;
                gap: var(--space-md);
                padding: 8px 0;
                border-top: 1px solid var(--border);
            }

            .usage-text {
                flex: 1;
                min-width: 0;
            }

            .usage-name {
                color: var(--text-primary);
                font-size: var(--font-size-sm);
            }

            .usage-clear {
                width: 96px;
                padding: 5px 10px;
                text-align: center;
                font-size: var(--font-size-xs);
                cursor: pointer;
            }

            .usage-clear.confirm {
                border-color: var(--danger);
                color: var(--danger);
            }

            .usage-clear:disabled {
                opacity: 0.4;
                cursor: default;
            }

            .danger-surface {
                border-color: var(--danger);
            }

            .warning-callout {
                position: relative;
                margin-top: 4px;
                padding: 8px 12px;
                border: 1px solid var(--danger);
                border-radius: var(--radius-md);
                color: var(--danger);
                font-size: var(--font-size-xs);
                line-height: 1.4;
                background: rgba(248, 113, 113, 0.08);
            }

            .toggle-row {
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                padding: var(--space-sm);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                background: var(--bg-elevated);
            }

            .toggle-input {
                width: 14px;
                height: 14px;
                accent-color: var(--accent);
                cursor: pointer;
            }

            .toggle-label {
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                cursor: pointer;
                user-select: none;
            }

            .slider-wrap {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: var(--space-xs);
            }

            .slider-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
            }

            .slider-value {
                font-family: var(--font-mono);
                font-size: var(--font-size-xs);
                color: var(--text-secondary);
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 2px 8px;
            }

            .slider-input {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 4px;
                border-radius: 2px;
                background: var(--border-strong);
                outline: none;
                cursor: pointer;
            }

            .slider-input::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: var(--text-primary);
                border: none;
            }

            .slider-input::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--text-primary);
                border: none;
            }

            .keybind-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-sm) 0;
                border-bottom: 1px solid var(--border);
            }

            .keybind-row:last-of-type {
                border-bottom: none;
            }

            .keybind-name {
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
            }

            .keybind-input {
                width: 140px;
                text-align: center;
                font-family: var(--font-mono);
                font-size: var(--font-size-xs);
            }

            .danger-button {
                border: 1px solid var(--danger);
                color: var(--danger);
                background: transparent;
                border-radius: var(--radius-sm);
                padding: 9px 12px;
                font-size: var(--font-size-sm);
                cursor: pointer;
                transition: background var(--transition);
            }

            .danger-button:hover {
                background: rgba(248, 113, 113, 0.12);
            }

            .danger-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .status {
                margin-top: var(--space-sm);
                padding: var(--space-sm);
                border-radius: var(--radius-sm);
                border: 1px solid var(--border);
                font-size: var(--font-size-xs);
            }

            .status.success {
                border-color: var(--success);
                color: var(--success);
            }

            .status.error {
                border-color: var(--danger);
                color: var(--danger);
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        googleSearchEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        theme: { type: String },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
        isClearing: { type: Boolean },
        isRestoring: { type: Boolean },
        clearStatusMessage: { type: String },
        clearStatusType: { type: String },
        _usage: { state: true },
        _retentionDays: { state: true },
        _confirmClearId: { state: true },
        _dataNotice: { state: true },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => {};
        this.onLanguageChange = () => {};
        this.onImageQualityChange = () => {};
        this.onLayoutModeChange = () => {};
        this.googleSearchEnabled = true;
        this.isClearing = false;
        this.isRestoring = false;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.backgroundTransparency = 0.8;
        this.fontSize = 20;
        this.audioMode = 'speaker_only';
        this.customPrompt = '';
        this.theme = 'dark';
        this._usage = [];
        this._retentionDays = 0;
        this._confirmClearId = null;
        this._dataNotice = '';
        this._loadFromStorage();
        this._loadUsage();
    }

    getThemes() {
        return cheatingDaddy.theme.getAll();
    }

    async _loadFromStorage() {
        try {
            const [prefs, keybinds] = await Promise.all([cheatingDaddy.storage.getPreferences(), cheatingDaddy.storage.getKeybinds()]);
            this.googleSearchEnabled = prefs.googleSearchEnabled ?? true;
            this.backgroundTransparency = prefs.backgroundTransparency ?? 0.8;
            this.fontSize = prefs.fontSize ?? 20;
            this.audioMode = prefs.audioMode ?? 'speaker_only';
            this.customPrompt = prefs.customPrompt ?? '';
            this.theme = prefs.theme ?? 'dark';
            this._retentionDays = Number(prefs.historyRetentionDays) || 0;
            if (keybinds) {
                this.keybinds = { ...this.getDefaultKeybinds(), ...keybinds };
            }
            this.updateBackgroundAppearance();
            this.updateFontSize();
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    getProfiles() {
        return [
            { value: 'interview', name: 'Job Interview' },
            { value: 'sales', name: 'Sales Call' },
            { value: 'meeting', name: 'Business Meeting' },
            { value: 'presentation', name: 'Presentation' },
            { value: 'negotiation', name: 'Negotiation' },
            { value: 'exam', name: 'Exam Assistant' },
        ];
    }

    getLanguages() {
        return [
            { value: 'auto', name: 'Auto-detect (Multilingual)' },
            { value: 'uk-UA', name: 'Ukrainian (Ukraine)' },
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (US)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
    }

    getDefaultKeybinds() {
        const isMac = cheatingDaddy.isMacOS || navigator.platform.includes('Mac');
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
        };
    }

    getKeybindActions() {
        return [
            { key: 'moveUp', name: 'Move Window Up', description: 'Move the app window up' },
            { key: 'moveDown', name: 'Move Window Down', description: 'Move the app window down' },
            { key: 'moveLeft', name: 'Move Window Left', description: 'Move the app window left' },
            { key: 'moveRight', name: 'Move Window Right', description: 'Move the app window right' },
            { key: 'toggleVisibility', name: 'Toggle Visibility', description: 'Show or hide the app window' },
            { key: 'toggleClickThrough', name: 'Toggle Click-through', description: 'Enable or disable click-through mode' },
            { key: 'nextStep', name: 'Analyze Screen', description: 'Capture screenshot and analyze screen (or start session from Home)' },
            { key: 'previousResponse', name: 'Previous Response', description: 'Move to previous AI response' },
            { key: 'nextResponse', name: 'Next Response', description: 'Move to next AI response' },
            { key: 'scrollUp', name: 'Scroll Response Up', description: 'Scroll response content upward' },
            { key: 'scrollDown', name: 'Scroll Response Down', description: 'Scroll response content downward' },
        ];
    }

    async saveKeybinds() {
        await cheatingDaddy.storage.setKeybinds(this.keybinds);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleProfileSelect(e) {
        this.selectedProfile = e.target.value;
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = e.target.value;
        this.onLanguageChange(this.selectedLanguage);
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(this.selectedImageQuality);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        this.onLayoutModeChange(this.layoutMode);
    }

    async handleCustomPromptInput(e) {
        this.customPrompt = e.target.value;
        await cheatingDaddy.storage.updatePreference('customPrompt', this.customPrompt);
    }

    async handleAudioModeSelect(e) {
        this.audioMode = e.target.value;
        await cheatingDaddy.storage.updatePreference('audioMode', this.audioMode);
        this.requestUpdate();
    }

    async handleThemeChange(e) {
        this.theme = e.target.value;
        await cheatingDaddy.theme.save(this.theme);
        this.updateBackgroundAppearance();
        this.requestUpdate();
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        await cheatingDaddy.storage.updatePreference('googleSearchEnabled', this.googleSearchEnabled);
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }
        this.requestUpdate();
    }

    async handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        await cheatingDaddy.storage.updatePreference('backgroundTransparency', this.backgroundTransparency);
        this.updateBackgroundAppearance();
        this.requestUpdate();
    }

    updateBackgroundAppearance() {
        const colors = cheatingDaddy.theme.get(this.theme);
        cheatingDaddy.theme.applyBackgrounds(colors.background, this.backgroundTransparency);
    }

    async handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        await cheatingDaddy.storage.updatePreference('fontSize', this.fontSize);
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        document.documentElement.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        let mainKey = e.key;

        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'PageUp':
                mainKey = 'PageUp';
                break;
            case 'PageDown':
                mainKey = 'PageDown';
                break;
            case 'BracketLeft':
                mainKey = '[';
                break;
            case 'BracketRight':
                mainKey = ']';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            default: {
                const keyMatch = /^Key([A-Z])$/.exec(e.code || '');
                const digitMatch = /^Digit([0-9])$/.exec(e.code || '');
                if (keyMatch) mainKey = keyMatch[1];
                else if (digitMatch) mainKey = digitMatch[1];
                else if (e.key.length === 1) mainKey = e.key.toUpperCase();
                break;
            }
        }

        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;

        const action = e.target.dataset.action;
        const keybind = [...modifiers, mainKey].join('+');
        this.handleKeybindChange(action, keybind);
        e.target.value = keybind;
        e.target.blur();
    }

    async resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        await cheatingDaddy.storage.setKeybinds(null);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
        this.requestUpdate();
    }

    async restoreAllSettings() {
        if (this.isRestoring) return;
        this.isRestoring = true;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.requestUpdate();
        try {
            // Restore all preferences to defaults
            const defaults = {
                customPrompt: '',
                selectedProfile: 'interview',
                selectedLanguage: 'en-US',
                selectedScreenshotInterval: '5',
                selectedImageQuality: 'medium',
                audioMode: 'speaker_only',
                fontSize: 20,
                backgroundTransparency: 0.8,
                googleSearchEnabled: false,
                theme: 'dark',
            };
            for (const [key, value] of Object.entries(defaults)) {
                await cheatingDaddy.storage.updatePreference(key, value);
            }

            // Restore keybinds
            this.keybinds = this.getDefaultKeybinds();
            await cheatingDaddy.storage.setKeybinds(null);
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('update-keybinds', this.keybinds);
            }

            // Apply to local state
            this.selectedProfile = defaults.selectedProfile;
            this.selectedLanguage = defaults.selectedLanguage;
            this.selectedImageQuality = defaults.selectedImageQuality;
            this.audioMode = defaults.audioMode;
            this.fontSize = defaults.fontSize;
            this.backgroundTransparency = defaults.backgroundTransparency;
            this.googleSearchEnabled = defaults.googleSearchEnabled;
            this.customPrompt = defaults.customPrompt;
            this.theme = defaults.theme;

            // Notify parent callbacks
            this.onProfileChange(defaults.selectedProfile);
            this.onLanguageChange(defaults.selectedLanguage);
            this.onImageQualityChange(defaults.selectedImageQuality);

            // Apply visual changes
            this.updateBackgroundAppearance();
            this.updateFontSize();
            await cheatingDaddy.theme.save(defaults.theme);

            this.clearStatusMessage = 'All settings restored to defaults';
            this.clearStatusType = 'success';
        } catch (error) {
            console.error('Error restoring settings:', error);
            this.clearStatusMessage = `Error restoring settings: ${error.message}`;
            this.clearStatusType = 'error';
        } finally {
            this.isRestoring = false;
            this.requestUpdate();
        }
    }

    async _loadUsage() {
        try {
            const result = await cheatingDaddy.data.getUsage();
            if (result?.success) {
                this._usage = result.data;
            }
        } catch (error) {
            console.warn('Could not read data usage:', error);
        }
    }

    async _changeRetention(value) {
        this._retentionDays = Number(value) || 0;
        await cheatingDaddy.storage.updatePreference('historyRetentionDays', this._retentionDays);
        if (this._retentionDays > 0) {
            const result = await cheatingDaddy.data.pruneHistory();
            this._dataNotice = result?.removed > 0 ? `Removed ${result.removed} old session(s)` : 'Retention saved';
        } else {
            this._dataNotice = 'History will be kept until you delete it';
        }
        await this._loadUsage();
    }

    async _clearCategory(id) {
        if (this._confirmClearId !== id) {
            this._confirmClearId = id;
            this._dataNotice = '';
            return;
        }
        this._confirmClearId = null;
        const result = await cheatingDaddy.data.clearCategory(id);
        this._dataNotice = result?.success ? 'Cleared' : result?.error || 'Could not clear this data';
        await this._loadUsage();
    }

    renderStorageSection() {
        const retentionOptions = [
            { value: 0, label: 'Keep until I delete it' },
            { value: 7, label: 'Delete after 7 days' },
            { value: 30, label: 'Delete after 30 days' },
            { value: 90, label: 'Delete after 90 days' },
        ];
        return html`
            <section class="surface">
                <div class="surface-title">Data and storage</div>
                <div class="surface-subtitle">Everything is stored on this computer only. Settings and credentials are never touched here.</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Keep session history</label>
                        <select class="control" .value=${String(this._retentionDays)} @change=${e => this._changeRetention(e.target.value)}>
                            ${retentionOptions.map(
                                option =>
                                    html`<option value=${option.value} ?selected=${Number(option.value) === this._retentionDays}>
                                        ${option.label}
                                    </option>`
                            )}
                        </select>
                    </div>
                    ${this._usage.map(
                        item => html`
                            <div class="usage-row">
                                <div class="usage-text">
                                    <div class="usage-name">${item.label}</div>
                                    <div class="form-help">${item.description}</div>
                                </div>
                                <span class="chip">${item.size}</span>
                                ${
                                    item.clearable
                                        ? html`<button
                                              class="control usage-clear ${this._confirmClearId === item.id ? 'confirm' : ''}"
                                              ?disabled=${item.bytes === 0}
                                              @click=${() => this._clearCategory(item.id)}
                                          >
                                              ${this._confirmClearId === item.id ? 'Click again' : 'Clear'}
                                          </button>`
                                        : html`<span class="usage-clear"></span>`
                                }
                            </div>
                        `
                    )}
                </div>
                ${this._dataNotice ? html`<div class="form-help" style="margin-top: var(--space-sm)">${this._dataNotice}</div>` : ''}
            </section>
        `;
    }

    async clearLocalData() {
        if (this.isClearing) return;
        this.isClearing = true;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.requestUpdate();
        try {
            await cheatingDaddy.storage.clearAll();
            this.clearStatusMessage = 'Successfully cleared all local data';
            this.clearStatusType = 'success';
            this.requestUpdate();
            setTimeout(() => {
                this.clearStatusMessage = 'Closing application...';
                this.requestUpdate();
                setTimeout(async () => {
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        await ipcRenderer.invoke('quit-application');
                    }
                }, 1000);
            }, 2000);
        } catch (error) {
            console.error('Error clearing data:', error);
            this.clearStatusMessage = `Error clearing data: ${error.message}`;
            this.clearStatusType = 'error';
        } finally {
            this.isClearing = false;
            this.requestUpdate();
        }
    }

    renderAudioSection() {
        return html`
            <section class="surface">
                <div class="surface-title">Audio Input</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Audio Mode</label>
                        <select class="control" .value=${this.audioMode} @change=${this.handleAudioModeSelect}>
                            <option value="speaker_only">Speaker Only (Interviewer)</option>
                            <option value="mic_only">Microphone Only (Me)</option>
                            <option value="both">Both Speaker and Microphone</option>
                        </select>
                    </div>
                    ${
                        this.audioMode !== 'speaker_only'
                            ? html`
                                  <div class="warning-callout">May cause unexpected behavior. Only change this if you know what you're doing.</div>
                              `
                            : ''
                    }
                    <div class="form-group">
                        <label class="form-label">Image Quality</label>
                        <select class="control" .value=${this.selectedImageQuality} @change=${this.handleImageQualitySelect}>
                            <option value="high">High Quality</option>
                            <option value="medium">Medium Quality</option>
                            <option value="low">Low Quality</option>
                        </select>
                    </div>
                </div>
            </section>
        `;
    }

    renderLanguageSection() {
        return html`
            <section class="surface">
                <div class="surface-title">Language</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Speech Language</label>
                        <select class="control" .value=${this.selectedLanguage} @change=${this.handleLanguageSelect}>
                            ${this.getLanguages().map(language => html`<option value=${language.value}>${language.name}</option>`)}
                        </select>
                    </div>
                </div>
            </section>
        `;
    }

    renderAppearanceSection() {
        return html`
            <section class="surface">
                <div class="surface-title">Appearance</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Theme</label>
                        <select class="control" .value=${this.theme} @change=${this.handleThemeChange}>
                            ${this.getThemes().map(theme => html`<option value=${theme.value}>${theme.name}</option>`)}
                        </select>
                    </div>
                    <div class="form-group slider-wrap">
                        <div class="slider-header">
                            <label class="form-label">Background Transparency</label>
                            <span class="slider-value">${Math.round(this.backgroundTransparency * 100)}%</span>
                        </div>
                        <input
                            class="slider-input"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            .value=${this.backgroundTransparency}
                            @input=${this.handleBackgroundTransparencyChange}
                        />
                    </div>
                    <div class="form-group slider-wrap">
                        <div class="slider-header">
                            <label class="form-label">Response Font Size</label>
                            <span class="slider-value">${this.fontSize}px</span>
                        </div>
                        <input
                            class="slider-input"
                            type="range"
                            min="12"
                            max="32"
                            step="1"
                            .value=${this.fontSize}
                            @input=${this.handleFontSizeChange}
                        />
                    </div>
                </div>
            </section>
        `;
    }

    renderKeyboardSection() {
        return html`
            <section class="surface">
                <div class="surface-title">Keyboard Shortcuts</div>
                ${this.getKeybindActions().map(
                    action => html`
                        <div class="keybind-row">
                            <span class="keybind-name">${action.name}</span>
                            <input
                                type="text"
                                class="control keybind-input"
                                .value=${this.keybinds[action.key]}
                                data-action=${action.key}
                                @keydown=${this.handleKeybindInput}
                                @focus=${this.handleKeybindFocus}
                                readonly
                            />
                        </div>
                    `
                )}
                <div style="margin-top: var(--space-sm);">
                    <button class="control" style="width:auto;padding:8px 10px;" @click=${this.resetKeybinds}>Reset to defaults</button>
                </div>
            </section>
        `;
    }

    renderPrivacySection() {
        return html`
            <section class="surface danger-surface">
                <div class="surface-title danger">Privacy and Data</div>
                <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
                    <button class="danger-button" @click=${this.restoreAllSettings} ?disabled=${this.isRestoring}>
                        ${this.isRestoring ? 'Restoring...' : 'Restore all settings'}
                    </button>
                    <button class="danger-button" @click=${this.clearLocalData} ?disabled=${this.isClearing}>
                        ${this.isClearing ? 'Clearing...' : 'Delete all data'}
                    </button>
                </div>
                ${
                    this.clearStatusMessage
                        ? html` <div class="status ${this.clearStatusType === 'success' ? 'success' : 'error'}">${this.clearStatusMessage}</div> `
                        : ''
                }
            </section>
        `;
    }

    render() {
        return html`
            <div class="unified-page">
                <div class="unified-wrap">
                    <div class="page-title">Settings</div>
                    ${this.renderAudioSection()} ${this.renderLanguageSection()} ${this.renderAppearanceSection()} ${this.renderKeyboardSection()}
                    ${this.renderStorageSection()} ${this.renderPrivacySection()}
                </div>
            </div>
        `;
    }
}

customElements.define('customize-view', CustomizeView);
