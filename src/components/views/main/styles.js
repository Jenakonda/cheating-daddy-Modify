import { css } from '../../../assets/lit-core-2.7.4.min.js';

export const mainViewStyles = css`
    * {
        font-family: var(--font);
        cursor: default;
        user-select: none;
        box-sizing: border-box;
    }

    :host {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
    }

    .form-wrapper {
        width: 100%;
        max-width: 668px;
        padding: 44px var(--space-lg) var(--space-xl);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
    }

    .page-title {
        font-size: 22px;
        font-weight: var(--font-weight-medium);
        letter-spacing: -0.01em;
        color: var(--text-primary);
        margin-bottom: 2px;
    }

    .page-title .mode-suffix {
        color: var(--text-muted);
    }

    .page-subtitle {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--space-sm);
    }

    .quick-settings-card {
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
    }

    .quick-settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-sm);
    }

    @media (max-width: 500px) {
        .quick-settings-grid {
            grid-template-columns: 1fr;
        }
    }

    /* ── Context Folder card ── */

    .context-folder-card {
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .context-folder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        flex-wrap: wrap;
    }

    .context-folder-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
    }

    .context-folder-toggle input {
        width: 15px;
        height: 15px;
        margin: 0;
        padding: 0;
        accent-color: var(--accent);
        cursor: pointer;
    }

    .context-status-pill {
        font-size: 11px;
        font-family: var(--font-mono);
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text-secondary);
    }

    .context-status-pill.active {
        border-color: rgba(74, 222, 128, 0.35);
        background: rgba(74, 222, 128, 0.1);
        color: var(--success);
    }

    .context-status-pill.rag {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
    }

    .context-folder-path-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-muted);
        background: var(--bg-app);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 5px 8px;
    }

    .context-folder-path {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        user-select: text;
    }

    .context-default-tag {
        flex-shrink: 0;
        font-size: 10px;
        color: var(--text-secondary);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 5px;
    }

    .context-folder-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .context-action-btn {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: var(--radius-sm);
        padding: 4px 9px;
        font-size: var(--font-size-xs);
        cursor: pointer;
        transition:
            border-color var(--transition),
            color var(--transition),
            background var(--transition);
    }

    .context-action-btn:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--text-primary);
        background: var(--bg-hover);
    }

    .context-action-btn:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .context-file-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    .context-file-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 100%;
        padding: 2px 7px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text-secondary);
        font-size: 11px;
        font-family: var(--font-mono);
    }

    .context-file-chip.warn {
        border-color: rgba(212, 160, 23, 0.45);
        background: rgba(212, 160, 23, 0.08);
        color: var(--warning, #d4a017);
    }

    .context-file-chip-name {
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .context-file-chip-meta {
        color: var(--text-muted);
        font-size: 10px;
        flex-shrink: 0;
    }

    .context-folder-notice {
        font-size: 11px;
        color: var(--text-secondary);
    }

    /* ── Form controls ── */

    .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .config-section {
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        overflow: hidden;
    }

    .config-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: 14px 16px;
        cursor: pointer;
        list-style: none;
    }

    .config-summary::-webkit-details-marker {
        display: none;
    }

    .config-summary-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    .config-summary-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
    }

    .config-summary-description {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        overflow-wrap: anywhere;
    }

    .config-chevron {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: var(--text-muted);
        transition: transform var(--transition);
    }

    .config-section[open] .config-chevron {
        transform: rotate(180deg);
    }

    .config-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: 16px;
        border-top: 1px solid var(--border);
    }

    .config-note {
        padding: 10px 12px;
        border: 1px solid rgba(212, 160, 23, 0.28);
        border-radius: var(--radius-sm);
        background: rgba(212, 160, 23, 0.08);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        line-height: var(--line-height);
    }

    .config-checkbox {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        cursor: pointer;
    }

    .config-checkbox input {
        width: 16px;
        height: 16px;
        margin-top: 2px;
        padding: 0;
        accent-color: var(--accent);
        cursor: pointer;
    }

    .config-checkbox-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .form-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-normal);
        color: var(--text-muted);
    }

    input,
    select,
    textarea {
        background: var(--bg-elevated);
        color: var(--text-primary);
        border: 1px solid var(--border);
        padding: 9px 12px;
        width: 100%;
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-family: var(--font);
        transition:
            border-color var(--transition),
            box-shadow var(--transition);
    }

    input:hover:not(:focus),
    select:hover:not(:focus),
    textarea:hover:not(:focus) {
        border-color: var(--border-strong);
    }

    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft);
    }

    input::placeholder,
    textarea::placeholder {
        color: var(--text-muted);
    }

    input.error {
        border-color: var(--danger, #ef4444);
    }

    select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23999' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 8px center;
        background-repeat: no-repeat;
        background-size: 14px;
        padding-right: 28px;
    }

    textarea {
        resize: vertical;
        min-height: 80px;
        line-height: var(--line-height);
    }

    .form-hint {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
    }

    .form-hint a,
    .form-hint span.link {
        color: var(--accent);
        text-decoration: none;
        cursor: pointer;
    }

    .form-hint span.link:hover {
        text-decoration: underline;
    }

    .whisper-label-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .whisper-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: whisper-spin 0.8s linear infinite;
    }

    @keyframes whisper-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* ── Start button ── */

    .start-button {
        position: relative;
        overflow: hidden;
        background: var(--btn-primary-bg, var(--text-primary));
        color: var(--btn-primary-text, var(--bg-app));
        border: none;
        padding: 12px var(--space-md);
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
    }

    .start-button canvas.btn-aurora {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
    }

    .start-button canvas.btn-dither {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        opacity: 0.1;
        mix-blend-mode: overlay;
        pointer-events: none;
        image-rendering: pixelated;
    }

    .start-button .btn-label {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
    }

    .start-button:hover:not(.disabled) {
        background: var(--btn-primary-hover, #ffffff);
    }

    .start-button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .start-button.disabled:hover {
        opacity: 0.5;
    }

    .download-progress-fill {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 2;
        width: 0;
        background: rgba(0, 0, 0, 0.14);
        transition: width 0.2s ease;
        pointer-events: none;
    }

    .download-progress-fill.indeterminate {
        width: 38%;
        animation: download-progress-slide 1.2s ease-in-out infinite;
    }

    .download-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        margin-top: var(--space-xs);
        font-size: var(--font-size-xs);
        color: var(--text-muted);
    }

    .download-cancel {
        flex: none;
        padding: 0;
        border: none;
        background: none;
        color: var(--danger, #ef4444);
        font: inherit;
        cursor: pointer;
    }

    .download-cancel:hover {
        text-decoration: underline;
    }

    @keyframes download-progress-slide {
        from {
            transform: translateX(-105%);
        }
        to {
            transform: translateX(270%);
        }
    }

    .shortcut-hint {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        opacity: 0.5;
        font-family: var(--font-mono);
    }

    /* ── Mode switch ── */

    .mode-switch {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
    }

    .mode-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 8px 4px;
        min-width: 0;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        transition:
            border-color var(--transition),
            background var(--transition);
    }

    .mode-tab:hover:not(.active) {
        background: var(--bg-hover);
    }

    .mode-tab.active {
        border-color: var(--accent);
        background: var(--accent-soft);
    }

    .mode-tab:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
    }

    .mode-tab * {
        cursor: pointer;
    }

    .mode-tab-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
    }

    .mode-tab-hint {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
    }

    /* ── Backup keys ── */

    .key-row {
        display: flex;
        gap: 6px;
    }

    .key-row input {
        flex: 1;
        min-width: 0;
    }

    /* ── Title row with help ── */

    .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-xs);
    }

    .title-row .page-title {
        margin-bottom: 0;
    }

    .help-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: var(--radius-sm);
        transition: color 0.2s;
        display: flex;
        align-items: center;
    }

    .help-btn:hover {
        color: var(--text-secondary);
    }

    .help-btn * {
        pointer-events: none;
    }

    .help-dialog-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-lg);
        background: rgba(0, 0, 0, 0.62);
    }

    .help-dialog {
        width: min(680px, 100%);
        max-height: calc(100vh - 48px);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-lg);
        overflow: hidden;
        background: var(--bg-popover, var(--bg-surface));
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        color: var(--text-primary);
    }

    .help-dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
    }

    .help-dialog-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
    }

    /* ── Help content ── */

    .help-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        overflow-y: auto;
    }

    .help-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .help-section-title {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
    }

    .help-section-text {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        line-height: var(--line-height);
    }

    .help-code {
        font-family: var(--font-mono);
        font-size: 11px;
        background: var(--bg-hover);
        padding: 6px 8px;
        border-radius: var(--radius-sm);
        color: var(--text-primary);
        display: block;
        user-select: text;
    }

    .help-actions-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 4px;
    }

    .help-link {
        color: var(--accent);
        cursor: pointer;
        text-decoration: none;
    }

    .help-link:hover {
        text-decoration: underline;
    }

    .help-models {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .help-model {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        display: flex;
        justify-content: space-between;
    }

    .help-model-name {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-primary);
    }

    .help-divider {
        border: none;
        border-top: 1px solid var(--border);
        margin: 0;
    }

    .help-cloud-btn {
        background: #e8e8e8;
        color: #111111;
        border: none;
        padding: 10px var(--space-md);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-sm);
        font-family: var(--font);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        width: 100%;
        transition: opacity 0.15s;
    }

    .help-cloud-btn:hover {
        opacity: 0.9;
    }

    .help-warn {
        font-size: var(--font-size-xs);
        color: var(--warning);
        line-height: var(--line-height);
    }

    /* ── CLI status cards ── */

    .cli-status-bar {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .cli-status-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
    }

    .cli-refresh-btn {
        background: none;
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: var(--radius-sm);
        padding: 3px 8px;
        font-size: var(--font-size-xs);
        cursor: pointer;
        transition:
            border-color var(--transition),
            color var(--transition);
    }

    .cli-refresh-btn:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--text-primary);
    }

    .cli-refresh-btn:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .cli-status-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-sm);
    }

    .cli-status-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 12px 14px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        background: var(--bg-surface);
    }

    .cli-status-card.active-primary {
        border-color: var(--accent);
    }

    .cli-status-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .cli-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        background: var(--text-muted);
    }

    .cli-status-dot.ok {
        background: var(--success, #22c55e);
    }

    .cli-status-dot.warn {
        background: var(--warning, #d4a017);
    }

    .cli-status-dot.missing {
        background: var(--danger, #ef4444);
    }

    .cli-status-name {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
    }

    .cli-status-meta {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cli-card-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
        flex-wrap: wrap;
    }

    .cli-setup-btn {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text-primary);
        cursor: pointer;
        transition:
            border-color var(--transition),
            background var(--transition),
            color var(--transition);
    }

    .cli-setup-btn:hover:not(:disabled) {
        border-color: var(--accent);
        background: var(--bg-hover);
    }

    .cli-setup-btn:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .cli-setup-btn.primary {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--text-primary);
    }

    .cli-setup-btn.primary:hover:not(:disabled) {
        border-color: var(--accent-hover);
        background: rgba(139, 156, 255, 0.26);
        color: var(--text-primary);
    }

    .cli-setup-btn.warn {
        border-color: rgba(212, 160, 23, 0.55);
        background: rgba(212, 160, 23, 0.14);
        color: #fde68a;
    }

    .cli-setup-btn.warn:hover:not(:disabled) {
        border-color: rgba(234, 179, 8, 0.8);
        background: rgba(212, 160, 23, 0.24);
        color: #fef3c7;
    }

    .cli-setup-btn.subtle {
        color: var(--text-secondary);
        background: transparent;
    }

    .cli-setup-btn.subtle:hover:not(:disabled) {
        color: var(--text-primary);
        background: var(--bg-elevated);
    }

    .cli-setup-notice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--accent);
        background: var(--accent-soft);
        color: var(--text-secondary);
        font-size: 11px;
        line-height: 1.4;
    }

    .cli-error-banner {
        padding: 10px 12px;
        border: 1px solid rgba(239, 68, 68, 0.38);
        border-radius: var(--radius-sm);
        background: rgba(239, 68, 68, 0.08);
        color: var(--danger, #ef4444);
        font-size: var(--font-size-xs);
        line-height: var(--line-height);
    }

    .cli-error-banner span.link {
        color: var(--text-primary);
        text-decoration: underline;
        cursor: pointer;
    }

    .whisper-warning {
        padding: 8px 10px;
        border: 1px solid rgba(212, 160, 23, 0.45);
        border-radius: var(--radius-sm);
        background: rgba(212, 160, 23, 0.08);
        color: var(--warning, #d4a017);
        font-size: var(--font-size-xs);
        line-height: var(--line-height);
    }

    .whisper-suggest {
        padding: 10px 12px;
        border: 1px solid var(--accent);
        border-radius: var(--radius-md);
        background: var(--accent-soft);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        line-height: var(--line-height);
    }

    .whisper-suggest .whisper-fix-btn {
        border-color: var(--accent);
        background: transparent;
    }

    .whisper-suggest .whisper-fix-btn:hover {
        background: var(--accent-soft);
    }

    .whisper-fix-btn {
        display: inline-block;
        margin-top: 6px;
        padding: 4px 10px;
        border: 1px solid rgba(212, 160, 23, 0.5);
        border-radius: var(--radius-sm);
        background: rgba(212, 160, 23, 0.14);
        color: var(--text-primary);
        font-size: 11px;
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: background var(--transition);
    }

    .whisper-fix-btn:hover {
        background: rgba(212, 160, 23, 0.25);
    }

    .models-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
    }

    .models-sync-meta {
        font-size: 11px;
        color: var(--text-muted);
    }

    .model-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        background: var(--bg-app);
    }

    .model-card.primary {
        border-color: var(--accent);
    }

    .model-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        flex-wrap: wrap;
    }

    .model-card-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .model-card-title {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    .model-role-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--text-muted);
        background: var(--bg-surface);
    }

    .model-role-badge.primary {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-soft);
    }

    .model-id-badge {
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-secondary);
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 2px 6px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .effort-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .effort-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .effort-pill {
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
            border-color var(--transition),
            background var(--transition),
            color var(--transition);
    }

    .effort-pill:hover {
        border-color: var(--border-strong);
        color: var(--text-primary);
        background: var(--bg-hover);
    }

    .effort-pill.active {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--text-primary);
    }
`;
