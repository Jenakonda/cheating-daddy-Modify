import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

const LOCAL_LLM_PRESETS = [
    { value: 'unsloth/Qwen3.5-0.8B-GGUF:Q4_K_M', label: 'Qwen 3.5 0.8B Q4 — 0.74 GB · Fastest' },
    { value: 'unsloth/Qwen3.5-0.8B-GGUF:Q8_0', label: 'Qwen 3.5 0.8B Q8 — 1.02 GB' },
    { value: 'unsloth/Qwen3.5-2B-GGUF:Q4_K_M', label: 'Qwen 3.5 2B Q4 — 1.95 GB' },
    { value: 'unsloth/Qwen3.5-2B-GGUF:Q8_0', label: 'Qwen 3.5 2B Q8 — 2.68 GB' },
    { value: 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M', label: 'Qwen 3.5 4B Q4 — 3.42 GB · Recommended' },
    { value: 'unsloth/Qwen3.5-4B-GGUF:Q8_0', label: 'Qwen 3.5 4B Q8 — 5.16 GB' },
    { value: 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M', label: 'Qwen 3.5 9B Q4 — 6.60 GB' },
    { value: 'unsloth/Qwen3.5-9B-GGUF:Q8_0', label: 'Qwen 3.5 9B Q8 — 10.45 GB' },
    { value: 'unsloth/Qwen3.5-27B-GGUF:Q4_K_M', label: 'Qwen 3.5 27B Q4 — 17.67 GB' },
    { value: 'unsloth/Qwen3.5-35B-A3B-GGUF:Q4_K_M', label: 'Qwen 3.5 35B-A3B Q4 — 22.92 GB · Largest' },
];

const WHISPER_MODEL_OPTIONS = [
    { value: 'small-q5_1', label: 'Small Q5 Multilingual (181 MB · ~0.3s GPU / ~1.3s CPU · Recommended)' },
    { value: 'base-q5_1', label: 'Base Q5 Multilingual (57 MB · Ultra-fast ~0.4s)' },
    { value: 'base', label: 'Base Multilingual (148 MB · Fast ~0.4s)' },
    { value: 'small', label: 'Small Multilingual (488 MB · Accurate)' },
    { value: 'large-v3-turbo-q5_0', label: 'Large v3 Turbo Q5 (574 MB · Best Ukrainian, ~1.1s GPU / ~6s CPU)' },
    { value: 'tiny', label: 'Tiny Multilingual (78 MB · Fastest)' },
    { value: 'tiny.en', label: 'Tiny English-only (75 MB)' },
    { value: 'base.en', label: 'Base English-only (142 MB)' },
    { value: 'small.en', label: 'Small English-only (466 MB)' },
];

const AUDIO_INPUT_OPTIONS = [
    { value: 'speaker_only', label: 'System Audio Only (Other speakers)' },
    { value: 'mic_only', label: 'Microphone Only (Your voice)' },
    { value: 'both', label: 'Both Microphone & System Audio' },
];

const SPEECH_LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto-detect (Multilingual · Recommended)' },
    { value: 'uk-UA', label: 'Ukrainian (uk-UA)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'pl-PL', label: 'Polish (pl-PL)' },
    { value: 'de-DE', label: 'German (de-DE)' },
    { value: 'ru-RU', label: 'Russian (ru-RU)' },
];

const PROFILE_OPTIONS = [
    { value: 'interview', label: 'Job Interview' },
    { value: 'exam', label: 'Exam Assistant' },
    { value: 'meeting', label: 'Business Meeting' },
    { value: 'sales', label: 'Sales Call' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'negotiation', label: 'Negotiation' },
];

const RESPONSE_LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto (match question)' },
    { value: 'uk', label: 'Українська (Ukrainian)' },
    { value: 'en', label: 'English' },
    { value: 'ru', label: 'Русский (Russian)' },
    { value: 'pl', label: 'Polski (Polish)' },
    { value: 'de', label: 'Deutsch (German)' },
    { value: 'es', label: 'Español (Spanish)' },
    { value: 'fr', label: 'Français (French)' },
    { value: 'it', label: 'Italiano (Italian)' },
    { value: 'pt', label: 'Português (Portuguese)' },
];

const CLAUDE_MODEL_PRESETS = [
    { value: 'sonnet', label: 'Claude Sonnet (Balanced · Recommended)' },
    { value: 'opus', label: 'Claude Opus (Most capable)' },
    { value: 'haiku', label: 'Claude Haiku (Fastest)' },
    { value: 'fable', label: 'Claude Fable (Latest preview)' },
    { value: 'default', label: 'Auto (CLI default)' },
];

const CLAUDE_EFFORT_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
    { value: 'max', label: 'Max' },
];

const EFFORT_TIER_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT_TIER_LABELS = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'XHigh',
    max: 'Max',
};

const DEFAULT_AGY_MODELS = [
    { id: 'gemini-4-hydrogen-low', label: 'Gemini 4 Hydrogen (Low)' },
    { id: 'gemini-4-hydrogen-medium', label: 'Gemini 4 Hydrogen (Medium)' },
    { id: 'gemini-4-hydrogen-high', label: 'Gemini 4 Hydrogen (High)' },
    { id: 'gemini-4-hydrogen-xhigh', label: 'Gemini 4 Hydrogen (XHigh)' },
    { id: 'gemini-4-neon-low', label: 'Gemini 4 Neon (Low)' },
    { id: 'gemini-4-neon-medium', label: 'Gemini 4 Neon (Medium)' },
    { id: 'gemini-4-neon-high', label: 'Gemini 4 Neon (High)' },
    { id: 'gemini-4-neon-xhigh', label: 'Gemini 4 Neon (XHigh)' },
    { id: 'gemini-4-argon-low', label: 'Gemini 4 Argon (Low)' },
    { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)' },
    { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon (High)' },
    { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
    { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
    { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
    { id: 'gemini-pro-orchestrator-neon', label: 'Orchestrator (Neon)' },
    { id: 'gemini-pro-orchestrator-g1-pro', label: 'Orchestrator (Argon)' },
    { id: 'claude-sonnet-5-5-low', label: 'Claude Sonnet 5.5 (Low)' },
    { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 (Medium)' },
    { id: 'claude-sonnet-5-5-high', label: 'Claude Sonnet 5.5 (High)' },
    { id: 'claude-opus-5-5-low', label: 'Claude Opus 5.5 (Low)' },
    { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 (Medium)' },
    { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)' },
    { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)' },
];

const AGY_GROUP_ORDER = ['Gemini 4', 'Gemini 3.8 & Orchestrators', 'Partner Models (via agy)', 'Other Live Models'];

function classifyAgyGroup(baseId) {
    if (baseId.startsWith('gemini-4-')) {
        return 'Gemini 4';
    }
    if (baseId.startsWith('gemini-3.8-') || baseId.includes('orchestrator')) {
        return 'Gemini 3.8 & Orchestrators';
    }
    if (baseId.startsWith('claude-') || baseId.startsWith('gpt-')) {
        return 'Partner Models (via agy)';
    }
    return 'Other Live Models';
}

function buildAgyModelFamilies(rawModels = []) {
    const merged = new Map();
    for (const item of DEFAULT_AGY_MODELS) {
        merged.set(item.id, item.label);
    }
    if (Array.isArray(rawModels)) {
        for (const item of rawModels) {
            if (item && typeof item.id === 'string' && item.id.trim()) {
                merged.set(item.id.trim(), (item.label || item.id).trim());
            }
        }
    }

    const families = new Map();
    for (const [id, rawLabel] of merged.entries()) {
        const tierMatch = id.match(/^(.*)-(low|medium|high|xhigh|max)$/i);
        const cleanLabel = rawLabel.replace(/\s*\((?:Low|Medium|High|XHigh|Max)\)\s*$/i, '').trim() || id;
        if (tierMatch) {
            const baseId = tierMatch[1];
            const tier = tierMatch[2].toLowerCase();
            if (!families.has(baseId)) {
                families.set(baseId, {
                    baseId,
                    label: cleanLabel,
                    group: classifyAgyGroup(baseId),
                    tiers: [],
                    fixedId: null,
                });
            }
            families.get(baseId).tiers.push({ tier, id });
        } else if (!families.has(id)) {
            families.set(id, {
                baseId: id,
                label: cleanLabel,
                group: classifyAgyGroup(id),
                tiers: [],
                fixedId: id,
            });
        }
    }

    const result = Array.from(families.values());
    for (const family of result) {
        family.tiers.sort((a, b) => {
            const ia = EFFORT_TIER_ORDER.indexOf(a.tier);
            const ib = EFFORT_TIER_ORDER.indexOf(b.tier);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
    }
    return result;
}

function resolveAgyModelSelection(modelId, families) {
    if (!modelId || modelId === 'auto') {
        return { mode: 'auto', family: null, tier: null };
    }

    for (const family of families) {
        if (family.fixedId === modelId) {
            return { mode: 'family', family, tier: null };
        }
        const matchedTier = family.tiers.find(t => t.id === modelId);
        if (matchedTier) {
            return { mode: 'family', family, tier: matchedTier.tier };
        }
    }

    return { mode: 'custom', family: null, tier: null };
}

export class MainView extends LitElement {
    static styles = css`
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

        /* ── Cloud promo card ── */

        .cloud-promo {
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 14px 16px;
            border-radius: var(--radius-md);
            border: 1px solid var(--accent);
            background: var(--accent-soft);
            cursor: pointer;
            transition:
                border-color 0.2s,
                background 0.2s;
        }

        .cloud-promo:hover {
            border-color: var(--accent-hover);
        }

        .cloud-promo-glow {
            display: none;
        }

        .cloud-promo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .cloud-promo-title {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
        }

        .cloud-promo-arrow {
            color: var(--accent);
            font-size: 16px;
            transition: transform 0.2s;
        }

        .cloud-promo:hover .cloud-promo-arrow {
            transform: translateX(2px);
        }

        .cloud-promo-desc {
            font-size: var(--font-size-xs);
            color: var(--text-secondary);
            line-height: var(--line-height);
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

        /* ── Divider ── */

        .divider {
            display: flex;
            align-items: center;
            gap: var(--space-md);
            margin: var(--space-sm) 0;
        }

        .divider-line {
            flex: 1;
            height: 1px;
            background: var(--border);
        }

        .divider-text {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            text-transform: lowercase;
        }

        /* ── Mode switch links ── */

        .mode-links {
            display: flex;
            justify-content: center;
            gap: var(--space-lg);
        }

        .mode-link {
            font-size: var(--font-size-sm);
            color: var(--text-secondary);
            cursor: pointer;
            background: none;
            border: none;
            padding: 0;
            transition: color var(--transition);
        }

        .mode-link:hover {
            color: var(--text-primary);
        }

        /* ── Mode option cards ── */

        .mode-cards {
            display: flex;
            gap: var(--space-sm);
        }

        .mode-card {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 12px 14px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
            background: var(--bg-elevated);
            cursor: pointer;
            transition:
                border-color 0.2s,
                background 0.2s;
        }

        .mode-card:hover {
            border-color: var(--text-muted);
            background: var(--bg-hover);
        }

        .mode-card-title {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
        }

        .mode-card-desc {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            line-height: var(--line-height);
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
        _token: { state: true },
        _geminiKey: { state: true },
        _groqKey: { state: true },
        _openaiKey: { state: true },
        _geminiLiveModel: { state: true },
        _groqModel: { state: true },
        _groqImageModel: { state: true },
        _disableGroqThinking: { state: true },
        _tokenError: { state: true },
        _keyError: { state: true },
        // Local AI state
        _localLlmModel: { state: true },
        _useCustomLocalLlmModel: { state: true },
        _whisperModel: { state: true },
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
        this._token = '';
        this._geminiKey = '';
        this._groqKey = '';
        this._openaiKey = '';
        this._geminiLiveModel = 'gemini-3.1-flash-live-preview';
        this._groqModel = 'qwen/qwen3.6-27b';
        this._groqImageModel = 'qwen/qwen3.6-27b';
        this._disableGroqThinking = true;
        this._tokenError = false;
        this._keyError = false;
        this._showLocalHelp = false;
        this._localLlmModel = 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M';
        this._useCustomLocalLlmModel = false;
        this._whisperModel = 'small-q5_1';

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
            this._token = creds.cloudToken || '';
            this._geminiKey = (await cheatingDaddy.storage.getApiKey().catch(() => '')) || '';
            this._groqKey = (await cheatingDaddy.storage.getGroqApiKey().catch(() => '')) || '';
            this._openaiKey = creds.openaiKey || '';
            this._geminiLiveModel = config.geminiLiveModel || 'gemini-3.1-flash-live-preview';
            this._groqModel = config.groqModel || 'qwen/qwen3.6-27b';
            this._groqImageModel = config.groqImageModel || 'qwen/qwen3.6-27b';
            this._disableGroqThinking = config.disableGroqThinking === true;

            // Load local AI settings
            this._localLlmModel = prefs.localLlmModel || 'unsloth/Qwen3.5-4B-GGUF:Q4_K_M';
            this._useCustomLocalLlmModel = !LOCAL_LLM_PRESETS.some(preset => preset.value === this._localLlmModel);
            this._whisperModel = prefs.whisperModel || 'small-q5_1';

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
        if (!this._pendingCliSetupRefresh || this._mode !== 'cli') {
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

    // ── Persistence ──

    async _saveMode(mode) {
        this._mode = mode;
        this._tokenError = false;
        this._keyError = false;
        this._cliError = '';
        await cheatingDaddy.storage.updatePreference('providerMode', mode);
        if (mode === 'cli') {
            this._refreshCliStatus();
        }
        this.requestUpdate();
    }

    async _saveToken(val) {
        this._token = val;
        this._tokenError = false;
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            await cheatingDaddy.storage.setCredentials({ ...creds, cloudToken: val });
        } catch (e) {}
        this.requestUpdate();
    }

    async _saveGeminiKey(val) {
        this._geminiKey = val;
        this._keyError = false;
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
        await cheatingDaddy.storage.updateConfig('geminiLiveModel', val);
        this.requestUpdate();
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

        if (this._mode === 'cli') {
            this._cliError = '';
            if (this._cliStatus && !this._cliStatus.claude?.installed && !this._cliStatus.gemini?.installed) {
                this._cliError = 'Neither Claude CLI nor Gemini CLI was found. Install at least one CLI or specify a custom path.';
                this.requestUpdate();
                return;
            }
        } else if (this._mode === 'byok') {
            if (!this._geminiKey.trim()) {
                this._keyError = true;
                this.requestUpdate();
                return;
            }
        } else if (this._mode === 'local') {
            if (!this._localLlmModel.trim()) {
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
        const isDownloading = (this._mode === 'local' || this._mode === 'cli') && this.downloadProgress.active;
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

    _renderDivider() {
        return html`
            <div class="divider">
                <div class="divider-line"></div>
                <span class="divider-text">or</span>
                <div class="divider-line"></div>
            </div>
        `;
    }

    // ── Cloud mode ──
    // Cloud UI intentionally disabled. Backend cloud wiring is still present in
    // the codebase, but the renderer no longer exposes this setup path.

    // ── BYOK mode ──

    _renderConfigChevron() {
        return html`
            <svg class="config-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
    }

    _renderByokMode() {
        return html`
            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Transcription</span>
                        <span class="config-summary-description">Gemini Live connection</span>
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

                    <div class="form-group">
                        <label class="form-label">Gemini Live Model</label>
                        <input type="text" .value=${this._geminiLiveModel} @input=${e => this._saveGeminiLiveModel(e.target.value)} />
                    </div>
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

            ${this._renderStartButton()} ${this._renderDivider()}

            <!-- Cloud promo intentionally removed from the active UI. -->

            <div class="mode-links">
                <button class="mode-link" @click=${() => this._saveMode('cli')}>Use CLI (Pro)</button>
                <button class="mode-link" @click=${() => this._saveMode('local')}>Use local AI</button>
            </div>
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
            ${this._renderCliStatusBar()}
            ${
                this._cliError
                    ? html`
                          <div class="cli-error-banner">
                              ${this._cliError}
                              <span class="link" @click=${this._openCliHelp}> Setup guide</span>
                          </div>
                      `
                    : ''
            }
            ${this._renderStartButton()}

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

            ${this._renderCliModelsSection()}

            <details class="config-section">
                <summary class="config-summary">
                    <span class="config-summary-text">
                        <span class="config-summary-title">Voice Transcription</span>
                        <span class="config-summary-description"
                            >${
                                this._cliWhisperEnabled
                                    ? `Whisper (${this._getWhisperModelShortLabel()}) · ${this._getAudioModeShortLabel()} · ${this._selectedLanguage || this.selectedLanguage || 'auto'}`
                                    : 'Disabled (text & screen only)'
                            }</span
                        >
                    </span>
                    ${this._renderConfigChevron()}
                </summary>
                <div class="config-content">
                    <label class="config-checkbox">
                        <input type="checkbox" .checked=${this._cliWhisperEnabled} @change=${e => this._saveCliWhisperEnabled(e.target.checked)} />
                        <span class="config-checkbox-text">
                            <span class="config-summary-title">Enable local Whisper voice transcription</span>
                            <span class="config-summary-description">Offline speech-to-text via whisper.cpp (supports Ukrainian)</span>
                        </span>
                    </label>
                    ${this._cliWhisperEnabled ? this._renderCliAudioControls() : ''}
                </div>
            </details>

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

            ${this._renderDivider()}

            <div class="mode-links">
                <button class="mode-link" @click=${() => this._saveMode('byok')}>Use own API keys</button>
                <button class="mode-link" @click=${() => this._saveMode('local')}>Use local AI</button>
            </div>
        `;
    }

    // ── Local AI mode ──

    _renderLocalMode() {
        return html`
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

            ${this._renderStartButton()} ${this._renderDivider()}

            <!-- Cloud promo intentionally removed from the active UI. -->

            <div class="mode-links">
                <button class="mode-link" @click=${() => this._saveMode('cli')}>Use CLI (Pro)</button>
                <button class="mode-link" @click=${() => this._saveMode('byok')}>Use own API keys</button>
            </div>
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

        const subtitleMap = {
            cli: 'Use Claude Pro & Google AI Pro CLI subscriptions',
            byok: 'Bring your own API keys',
            local: 'Run models locally on your machine',
        };

        return html`
            <div class="form-wrapper">
                ${
                    this._mode === 'cli'
                        ? html`
                              <div class="title-row">
                                  <div class="page-title">Cheating Daddy <span class="mode-suffix">CLI</span></div>
                                  <button class="help-btn" @click=${this._openCliHelp} aria-label="Open CLI setup help">${helpIcon}</button>
                              </div>
                          `
                        : this._mode === 'local'
                          ? html`
                                <div class="title-row">
                                    <div class="page-title">Cheating Daddy <span class="mode-suffix">Local AI</span></div>
                                    <button class="help-btn" @click=${this._openLocalHelp} aria-label="Open Local AI help">${helpIcon}</button>
                                </div>
                            `
                          : html` <div class="page-title">${html`Cheating Daddy <span class="mode-suffix">BYOK</span>`}</div> `
                }
                <div class="page-subtitle">${subtitleMap[this._mode] || subtitleMap.cli}</div>

                ${this._renderSessionQuickSettings()} ${this._renderContextFolderCard()}

                <!-- Cloud mode render branch intentionally disabled. -->
                ${this._mode === 'cli' ? this._renderCliMode() : ''} ${this._mode === 'byok' ? this._renderByokMode() : ''}
                ${this._mode === 'local' ? this._renderLocalMode() : ''}
            </div>
            ${this._mode === 'cli' && this._showCliHelp ? this._renderCliHelp(closeIcon) : ''}
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
                                back to BYOK mode if you want to use a hosted provider instead.
                            </div>
                        </div>

                        <button
                            class="help-cloud-btn"
                            @click=${() => {
                                this._closeLocalHelp();
                                this._saveMode('byok');
                            }}
                        >
                            Switch to BYOK
                        </button>
                    </div>
                </section>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
