const BUILT_IN_PRESETS = [
    { value: 'interview', label: 'Job Interview' },
    { value: 'exam', label: 'Exam Assistant' },
    { value: 'meeting', label: 'Business Meeting' },
    { value: 'sales', label: 'Sales Call' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'negotiation', label: 'Negotiation' },
];

const CUSTOM_PREFIX = 'custom:';
const MAX_CUSTOM_PRESETS = 20;
const MAX_NAME_LENGTH = 40;
const MAX_INSTRUCTIONS_LENGTH = 4000;
const DEFAULT_BASE_PRESET = 'interview';

function isBuiltInPreset(id) {
    return BUILT_IN_PRESETS.some(preset => preset.value === id);
}

function isCustomPresetId(id) {
    return typeof id === 'string' && id.startsWith(CUSTOM_PREFIX) && id.length > CUSTOM_PREFIX.length;
}

/** Cleans untrusted preset data (from preferences or the renderer) into a safe, bounded list. */
function sanitizeCustomPresets(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }

    const seen = new Set();
    const cleaned = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object' || !isCustomPresetId(item.id) || seen.has(item.id)) {
            continue;
        }
        const name = String(item.name ?? '')
            .trim()
            .slice(0, MAX_NAME_LENGTH);
        if (!name) {
            continue;
        }
        seen.add(item.id);
        cleaned.push({
            id: item.id,
            name,
            basePreset: isBuiltInPreset(item.basePreset) ? item.basePreset : DEFAULT_BASE_PRESET,
            instructions: String(item.instructions ?? '').slice(0, MAX_INSTRUCTIONS_LENGTH),
        });
        if (cleaned.length >= MAX_CUSTOM_PRESETS) {
            break;
        }
    }
    return cleaned;
}

function slugify(name) {
    return (
        String(name || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 24) || 'preset'
    );
}

function createCustomPresetId(name, existingIds = []) {
    const taken = new Set(existingIds);
    const base = `${CUSTOM_PREFIX}${slugify(name)}`;
    if (!taken.has(base)) {
        return base;
    }
    let counter = 2;
    while (taken.has(`${base}-${counter}`)) {
        counter += 1;
    }
    return `${base}-${counter}`;
}

function listPresets(customPresets = []) {
    return [
        ...BUILT_IN_PRESETS.map(preset => ({ ...preset, custom: false })),
        ...sanitizeCustomPresets(customPresets).map(preset => ({ value: preset.id, label: preset.name, custom: true })),
    ];
}

function getPresetLabel(id, customPresets = []) {
    const found = listPresets(customPresets).find(preset => preset.value === id);
    return found ? found.label : null;
}

/** Falls back to the default preset when the id is unknown (for example after a custom preset was deleted). */
function resolvePresetId(id, customPresets = []) {
    return listPresets(customPresets).some(preset => preset.value === id) ? id : DEFAULT_BASE_PRESET;
}

/** Builds the prompt sections for a built-in or custom preset. */
function buildPresetPromptParts(id, customPresets, profilePrompts) {
    const fallback = profilePrompts[DEFAULT_BASE_PRESET];
    if (!isCustomPresetId(id)) {
        return profilePrompts[id] || fallback;
    }

    const custom = sanitizeCustomPresets(customPresets).find(preset => preset.id === id);
    if (!custom) {
        return fallback;
    }

    const base = profilePrompts[custom.basePreset] || fallback;
    const instructions = custom.instructions.trim();
    if (!instructions) {
        return base;
    }

    return {
        ...base,
        intro: `${base.intro}\n\n**CUSTOM PRESET "${custom.name}" — follow these instructions, they take priority over the defaults above:**\n${instructions}`,
    };
}

module.exports = {
    BUILT_IN_PRESETS,
    CUSTOM_PREFIX,
    MAX_CUSTOM_PRESETS,
    MAX_NAME_LENGTH,
    MAX_INSTRUCTIONS_LENGTH,
    isBuiltInPreset,
    isCustomPresetId,
    sanitizeCustomPresets,
    createCustomPresetId,
    listPresets,
    getPresetLabel,
    resolvePresetId,
    buildPresetPromptParts,
};
