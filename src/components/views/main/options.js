// Option lists and model helpers used by the Home screen.
// Kept free of UI code so they can be tested in Node.

export const LOCAL_LLM_PRESETS = [
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

export const WHISPER_MODEL_OPTIONS = [
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

export const SPEECH_VOCABULARY_MAX_LENGTH = 400;
export const WHISPER_UPGRADE_TARGET = 'large-v3-turbo-q5_0';

// Small models mishear uncommon words; the Large v3 Turbo model is clearly better for non-English speech.
const WHISPER_UPGRADE_FROM = new Set(['small', 'small-q5_1']);

/** Returns the model id to recommend instead of the current one, or null when there is nothing to suggest. */
export function suggestWhisperUpgrade(model, language) {
    const lang = String(language || 'auto').toLowerCase();
    if (lang.startsWith('en')) {
        return null;
    }
    return WHISPER_UPGRADE_FROM.has(model) ? WHISPER_UPGRADE_TARGET : null;
}

export const AUDIO_INPUT_OPTIONS = [
    { value: 'speaker_only', label: 'System Audio Only (Other speakers)' },
    { value: 'mic_only', label: 'Microphone Only (Your voice)' },
    { value: 'both', label: 'Both Microphone & System Audio' },
];

export const SPEECH_LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto-detect (Multilingual · Recommended)' },
    { value: 'uk-UA', label: 'Ukrainian (uk-UA)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'pl-PL', label: 'Polish (pl-PL)' },
    { value: 'de-DE', label: 'German (de-DE)' },
    { value: 'ru-RU', label: 'Russian (ru-RU)' },
];

export const PROFILE_OPTIONS = [
    { value: 'interview', label: 'Job Interview' },
    { value: 'exam', label: 'Exam Assistant' },
    { value: 'meeting', label: 'Business Meeting' },
    { value: 'sales', label: 'Sales Call' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'negotiation', label: 'Negotiation' },
];

export const RESPONSE_LANGUAGE_OPTIONS = [
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

export const CLAUDE_MODEL_PRESETS = [
    { value: 'sonnet', label: 'Claude Sonnet (Balanced · Recommended)' },
    { value: 'opus', label: 'Claude Opus (Most capable)' },
    { value: 'haiku', label: 'Claude Haiku (Fastest)' },
    { value: 'fable', label: 'Claude Fable (Latest preview)' },
    { value: 'default', label: 'Auto (CLI default)' },
];

export const CLAUDE_EFFORT_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
    { value: 'max', label: 'Max' },
];

export const EFFORT_TIER_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
export const EFFORT_TIER_LABELS = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'XHigh',
    max: 'Max',
};

export const DEFAULT_AGY_MODELS = [
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

export const AGY_GROUP_ORDER = ['Gemini 4', 'Gemini 3.8 & Orchestrators', 'Partner Models (via agy)', 'Other Live Models'];

export function classifyAgyGroup(baseId) {
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

export function buildAgyModelFamilies(rawModels = []) {
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

export function resolveAgyModelSelection(modelId, families) {
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
