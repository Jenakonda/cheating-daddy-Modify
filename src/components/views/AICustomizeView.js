import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

export class AICustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .unified-page {
                height: 100%;
            }
            .unified-wrap {
                height: 100%;
            }
            section.surface.instructions-surface {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            section.surface.context-surface {
                display: flex;
                flex-direction: column;
                gap: var(--space-sm);
            }
            .form-grid {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .form-group.vertical {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            textarea.control {
                flex: 1;
                resize: none;
                overflow-y: auto;
                min-height: 140px;
            }
            .cf-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
                flex-wrap: wrap;
            }
            .cf-toggle {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-medium);
                cursor: pointer;
            }
            .cf-toggle input {
                width: 15px;
                height: 15px;
                margin: 0;
                accent-color: var(--accent);
                cursor: pointer;
            }
            .cf-path-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
                padding: 6px 10px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--border);
                background: var(--bg-app);
                font-family: var(--font-mono);
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }
            .cf-path {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                user-select: text;
            }
            .cf-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .cf-btn {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg-elevated);
                color: var(--text-secondary);
                padding: 5px 10px;
                font-size: var(--font-size-xs);
                cursor: pointer;
                transition:
                    border-color var(--transition),
                    color var(--transition),
                    background var(--transition);
            }
            .cf-btn:hover:not(:disabled) {
                border-color: var(--accent);
                color: var(--text-primary);
                background: var(--bg-hover);
            }
            .cf-btn:disabled {
                opacity: 0.55;
                cursor: default;
            }
            .cf-file-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 180px;
                overflow-y: auto;
            }
            .cf-file-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
                padding: 6px 10px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg-elevated);
                font-size: var(--font-size-xs);
            }
            .cf-file-name {
                color: var(--text-primary);
                font-family: var(--font-mono);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                user-select: text;
            }
            .cf-file-meta {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
                color: var(--text-muted);
                font-family: var(--font-mono);
            }
            .cf-status {
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid var(--border);
                font-size: 11px;
            }
            .cf-status.loaded {
                border-color: rgba(74, 222, 128, 0.35);
                color: var(--success);
            }
            .cf-status.warn {
                border-color: rgba(212, 160, 23, 0.45);
                color: var(--warning, #d4a017);
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        _context: { state: true },
        _contextFolderEnabled: { state: true },
        _contextFolderSummary: { state: true },
        _loadingContextFolder: { state: true },
        _contextFolderNotice: { state: true },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this._context = '';
        this._contextFolderEnabled = true;
        this._contextFolderSummary = null;
        this._loadingContextFolder = false;
        this._contextFolderNotice = '';
        this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            const prefs = await cheatingDaddy.storage.getPreferences();
            this._context = prefs.customPrompt || '';
            this._contextFolderEnabled = prefs.contextFolderEnabled ?? true;
            this.requestUpdate();
            this._refreshContextFolder(false);
        } catch (error) {
            console.error('Error loading AI customize storage:', error);
        }
    }

    async _toggleContextFolder(enabled) {
        this._contextFolderEnabled = Boolean(enabled);
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
                if (force) this._contextFolderNotice = '';
            } else if (res?.error) {
                this._contextFolderNotice = res.error;
            }
        } catch (error) {
            this._contextFolderNotice = error?.message || 'Failed to load context folder';
        } finally {
            this._loadingContextFolder = false;
            this.requestUpdate();
        }
    }

    async _chooseContextFolder() {
        if (!cheatingDaddy.contextFolder?.choose) return;
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
    }

    async _openContextFolder() {
        if (!cheatingDaddy.contextFolder?.open) return;
        const res = await cheatingDaddy.contextFolder.open();
        if (!res?.success && res?.error) {
            this._contextFolderNotice = res.error;
            this.requestUpdate();
        }
    }

    async _addContextFiles() {
        if (!cheatingDaddy.contextFolder?.addFiles) return;
        const res = await cheatingDaddy.contextFolder.addFiles();
        if (res?.success && !res.canceled && res.data) {
            this._contextFolderSummary = res.data;
            const copiedCount = res.copied?.length || 0;
            const skippedCount = res.skipped?.length || 0;
            this._contextFolderNotice = skippedCount > 0 ? `Added ${copiedCount}, skipped ${skippedCount}` : `Added ${copiedCount} file(s)`;
            this.requestUpdate();
        } else if (res?.error) {
            this._contextFolderNotice = res.error;
            this.requestUpdate();
        }
    }

    async _resetDefaultContextFolder() {
        if (!cheatingDaddy.contextFolder?.resetDefault) return;
        const res = await cheatingDaddy.contextFolder.resetDefault();
        if (res?.success && res.data) {
            this._contextFolderSummary = res.data;
            this._contextFolderNotice = '';
            await cheatingDaddy.refreshPreferencesCache?.();
            this.requestUpdate();
        }
    }

    _handleProfileChange(e) {
        this.onProfileChange(e.target.value);
    }

    async _saveContext(val) {
        this._context = val;
        await cheatingDaddy.storage.updatePreference('customPrompt', val);
    }

    _getProfileName(profile) {
        const names = {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
        return names[profile] || profile;
    }

    _formatChars(count) {
        const n = Number(count) || 0;
        return n >= 1000 ? `${(n / 1000).toFixed(1)}k chars` : `${n} chars`;
    }

    _renderContextFolderSection() {
        const summary = this._contextFolderSummary;
        const files = Array.isArray(summary?.files) ? summary.files : [];
        const statusSummary = !this._contextFolderEnabled
            ? 'Disabled'
            : summary?.mode === 'rag'
              ? `${summary.loadedFileCount} files · ${this._formatChars(summary.totalChars)} · Smart search`
              : summary?.mode === 'inline'
                ? `${summary.loadedFileCount} files · ${this._formatChars(summary.totalChars)} · Full context`
                : 'Empty folder';

        return html`
            <section class="surface context-surface">
                <div class="cf-header">
                    <div>
                        <div class="surface-title">Context Folder</div>
                        <div class="form-help">Presentations, PDFs, Word docs, guides, exam tickets</div>
                    </div>
                    <div class="cf-header">
                        <span class="pill">${this._loadingContextFolder ? 'Scanning...' : statusSummary}</span>
                        <label class="cf-toggle">
                            <input
                                type="checkbox"
                                .checked=${this._contextFolderEnabled}
                                @change=${e => this._toggleContextFolder(e.target.checked)}
                            />
                            Enable
                        </label>
                    </div>
                </div>

                ${
                    summary?.folderPath
                        ? html`
                              <div class="cf-path-row">
                                  <span class="cf-path" title=${summary.folderPath}>${summary.folderPath}</span>
                                  ${summary.isDefault ? html`<span class="chip">Default</span>` : ''}
                              </div>
                          `
                        : ''
                }

                <div class="cf-actions">
                    <button type="button" class="cf-btn" @click=${() => this._addContextFiles()}>+ Add Files</button>
                    <button type="button" class="cf-btn" @click=${() => this._openContextFolder()}>Open Folder</button>
                    <button type="button" class="cf-btn" @click=${() => this._chooseContextFolder()}>Choose Folder</button>
                    <button type="button" class="cf-btn" ?disabled=${this._loadingContextFolder} @click=${() => this._refreshContextFolder(true)}>
                        Refresh
                    </button>
                    ${
                        summary && !summary.isDefault
                            ? html`<button type="button" class="cf-btn" @click=${() => this._resetDefaultContextFolder()}>Default</button>`
                            : ''
                    }
                </div>

                ${
                    files.length > 0
                        ? html`
                              <div class="cf-file-list">
                                  ${files.map(file => {
                                      const isLoaded = file.status === 'loaded';
                                      return html`
                                          <div class="cf-file-row" title=${file.reason || file.relativePath}>
                                              <span class="cf-file-name">${file.relativePath}</span>
                                              <span class="cf-file-meta">
                                                  ${file.unitsLabel ? html`<span>${file.unitsLabel}</span>` : ''}
                                                  <span>${this._formatChars(file.charCount)}</span>
                                                  <span class="cf-status ${isLoaded ? 'loaded' : 'warn'}">${file.status}</span>
                                              </span>
                                          </div>
                                      `;
                                  })}
                              </div>
                          `
                        : html`<div class="form-help">Supported: PDF, PPTX, DOCX, XLSX, ODP, ODT, RTF, MD, TXT, HTML, CSV, JSON, code files.</div>`
                }
                ${this._contextFolderNotice ? html`<div class="form-help">${this._contextFolderNotice}</div>` : ''}
            </section>
        `;
    }

    render() {
        const profiles = [
            { value: 'interview', label: 'Job Interview' },
            { value: 'sales', label: 'Sales Call' },
            { value: 'meeting', label: 'Business Meeting' },
            { value: 'presentation', label: 'Presentation' },
            { value: 'negotiation', label: 'Negotiation' },
            { value: 'exam', label: 'Exam Assistant' },
        ];

        return html`
            <div class="unified-page">
                <div class="unified-wrap">
                    <div>
                        <div class="page-title">AI Context</div>
                    </div>

                    ${this._renderContextFolderSection()}

                    <section class="surface instructions-surface">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Profile</label>
                                <select class="control" .value=${this.selectedProfile} @change=${this._handleProfileChange}>
                                    ${profiles.map(profile => html`<option value=${profile.value}>${profile.label}</option>`)}
                                </select>
                            </div>
                            <div class="form-group vertical">
                                <label class="form-label">Custom Instructions</label>
                                <textarea
                                    class="control"
                                    placeholder="Resume details, role requirements, constraints..."
                                    .value=${this._context}
                                    @input=${e => this._saveContext(e.target.value)}
                                ></textarea>
                                <div class="form-help">Sent as context at session start. Keep it short.</div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;
    }
}

customElements.define('ai-customize-view', AICustomizeView);
