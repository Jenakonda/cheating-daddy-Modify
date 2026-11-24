const test = require('node:test');
const assert = require('node:assert/strict');

const {
    BUILT_IN_PRESETS,
    MAX_CUSTOM_PRESETS,
    MAX_INSTRUCTIONS_LENGTH,
    MAX_NAME_LENGTH,
    buildPresetPromptParts,
    createCustomPresetId,
    getPresetLabel,
    isCustomPresetId,
    listPresets,
    resolvePresetId,
    sanitizeCustomPresets,
} = require('../src/utils/presets');
const { getSystemPrompt, profilePrompts } = require('../src/utils/prompts');

test('every built-in preset has prompt parts', () => {
    for (const preset of BUILT_IN_PRESETS) {
        assert.ok(profilePrompts[preset.value], `missing prompt for ${preset.value}`);
    }
});

test('sanitizeCustomPresets keeps valid entries and bounds untrusted input', () => {
    const cleaned = sanitizeCustomPresets([
        { id: 'custom:db', name: '  Database exam  ', basePreset: 'exam', instructions: 'Use SQL.' },
        { id: 'custom:db', name: 'Duplicate id', basePreset: 'exam', instructions: '' },
        { id: 'interview', name: 'Built-in id is not allowed', basePreset: 'exam', instructions: '' },
        { id: 'custom:empty', name: '   ', basePreset: 'exam', instructions: '' },
        { id: 'custom:bad-base', name: 'Bad base', basePreset: 'unknown', instructions: 42 },
        { id: 'custom:long', name: 'x'.repeat(MAX_NAME_LENGTH + 20), basePreset: 'sales', instructions: 'y'.repeat(MAX_INSTRUCTIONS_LENGTH + 50) },
        null,
        'text',
    ]);

    assert.deepEqual(
        cleaned.map(preset => preset.id),
        ['custom:db', 'custom:bad-base', 'custom:long']
    );
    assert.equal(cleaned[0].name, 'Database exam');
    assert.equal(cleaned[1].basePreset, 'interview');
    assert.equal(cleaned[1].instructions, '42');
    assert.equal(cleaned[2].name.length, MAX_NAME_LENGTH);
    assert.equal(cleaned[2].instructions.length, MAX_INSTRUCTIONS_LENGTH);

    assert.deepEqual(sanitizeCustomPresets('nope'), []);
    assert.deepEqual(sanitizeCustomPresets(undefined), []);
});

test('sanitizeCustomPresets limits the number of presets', () => {
    const many = Array.from({ length: MAX_CUSTOM_PRESETS + 5 }, (_, index) => ({
        id: `custom:p${index}`,
        name: `Preset ${index}`,
        basePreset: 'exam',
    }));
    assert.equal(sanitizeCustomPresets(many).length, MAX_CUSTOM_PRESETS);
});

test('createCustomPresetId makes unique readable ids', () => {
    assert.equal(createCustomPresetId('Database exam'), 'custom:database-exam');
    assert.equal(createCustomPresetId('Database exam', ['custom:database-exam']), 'custom:database-exam-2');
    assert.equal(createCustomPresetId('Database exam', ['custom:database-exam', 'custom:database-exam-2']), 'custom:database-exam-3');
    assert.equal(createCustomPresetId('Іспит з баз даних').startsWith('custom:'), true);
    assert.equal(createCustomPresetId('!!!'), 'custom:preset');
    assert.equal(isCustomPresetId('custom:x'), true);
    assert.equal(isCustomPresetId('custom:'), false);
    assert.equal(isCustomPresetId('exam'), false);
});

test('listPresets, getPresetLabel and resolvePresetId merge built-in and custom presets', () => {
    const custom = [{ id: 'custom:db', name: 'Database exam', basePreset: 'exam', instructions: '' }];
    const list = listPresets(custom);

    assert.equal(list.length, BUILT_IN_PRESETS.length + 1);
    assert.deepEqual(list[list.length - 1], { value: 'custom:db', label: 'Database exam', custom: true });
    assert.equal(getPresetLabel('exam', custom), 'Exam Assistant');
    assert.equal(getPresetLabel('custom:db', custom), 'Database exam');
    assert.equal(getPresetLabel('custom:gone', custom), null);
    assert.equal(resolvePresetId('custom:db', custom), 'custom:db');
    assert.equal(resolvePresetId('custom:gone', custom), 'interview');
});

test('custom presets extend the base prompt and fall back safely', () => {
    const custom = [{ id: 'custom:db', name: 'Database exam', basePreset: 'exam', instructions: 'Always answer with a SQL query.' }];

    const parts = buildPresetPromptParts('custom:db', custom, profilePrompts);
    assert.ok(parts.intro.startsWith(profilePrompts.exam.intro));
    assert.ok(parts.intro.includes('Always answer with a SQL query.'));
    assert.equal(parts.formatRequirements, profilePrompts.exam.formatRequirements);

    assert.equal(buildPresetPromptParts('custom:gone', custom, profilePrompts), profilePrompts.interview);
    assert.equal(buildPresetPromptParts('sales', custom, profilePrompts), profilePrompts.sales);
    assert.equal(buildPresetPromptParts('does-not-exist', [], profilePrompts), profilePrompts.interview);

    const noInstructions = [{ id: 'custom:plain', name: 'Plain', basePreset: 'sales', instructions: '   ' }];
    assert.equal(buildPresetPromptParts('custom:plain', noInstructions, profilePrompts), profilePrompts.sales);
});

test('getSystemPrompt uses explicitly passed custom presets', () => {
    const custom = [{ id: 'custom:db', name: 'Database exam', basePreset: 'exam', instructions: 'Always answer with a SQL query.' }];
    const prompt = getSystemPrompt('custom:db', '', false, 'auto', null, custom);

    assert.ok(prompt.includes('CUSTOM PRESET "Database exam"'));
    assert.ok(prompt.includes('Always answer with a SQL query.'));
    assert.ok(!getSystemPrompt('exam', '', false, 'auto', null, custom).includes('CUSTOM PRESET'));
});

test('every preset tells the model how to handle misheard speech and to state its assumption', () => {
    const custom = [{ id: 'custom:db', name: 'Database exam', basePreset: 'exam', instructions: 'Be brief.' }];
    const ids = [...BUILT_IN_PRESETS.map(preset => preset.value), 'custom:db'];

    for (const id of ids) {
        const prompt = getSystemPrompt(id, '', false, 'uk', null, custom);
        assert.ok(prompt.includes('Garbled wording'), `${id} is missing the garbled wording rule`);
        assert.ok(prompt.includes('Assumed question'), `${id} is missing the assumed question rule`);
        assert.ok(prompt.includes('only when you had to reinterpret'), `${id} must keep clear questions free of the extra line`);
    }
});
