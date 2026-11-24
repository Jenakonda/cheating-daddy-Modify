const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const optionsUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'components', 'views', 'main', 'options.js')).href;

test('classifyAgyGroup sorts model ids into display groups', async () => {
    const { classifyAgyGroup } = await import(optionsUrl);

    assert.equal(classifyAgyGroup('gemini-4-neon'), 'Gemini 4');
    assert.equal(classifyAgyGroup('gemini-3.8-flash'), 'Gemini 3.8 & Orchestrators');
    assert.equal(classifyAgyGroup('gemini-pro-orchestrator-neon'), 'Gemini 3.8 & Orchestrators');
    assert.equal(classifyAgyGroup('claude-opus-5-5'), 'Partner Models (via agy)');
    assert.equal(classifyAgyGroup('gpt-oss-120b'), 'Partner Models (via agy)');
    assert.equal(classifyAgyGroup('something-new'), 'Other Live Models');
});

test('buildAgyModelFamilies groups tiers, keeps fixed models and merges live models', async () => {
    const { buildAgyModelFamilies } = await import(optionsUrl);

    const families = buildAgyModelFamilies([
        { id: 'gemini-4-neon-max', label: 'Gemini 4 Neon (Max)' },
        { id: 'brand-new-model-high', label: 'Brand New (High)' },
        { id: 'brand-new-model-low', label: 'Brand New (Low)' },
        { id: '  trimmed-model  ', label: '  Trimmed  ' },
        { id: '', label: 'ignored' },
        null,
    ]);
    const byBase = Object.fromEntries(families.map(family => [family.baseId, family]));

    const neon = byBase['gemini-4-neon'];
    assert.equal(neon.label, 'Gemini 4 Neon');
    assert.deepEqual(
        neon.tiers.map(item => item.tier),
        ['low', 'medium', 'high', 'xhigh', 'max'],
        'tiers follow the effort order and include live additions'
    );

    const brandNew = byBase['brand-new-model'];
    assert.equal(brandNew.group, 'Other Live Models');
    assert.deepEqual(
        brandNew.tiers.map(item => item.tier),
        ['low', 'high']
    );

    const orchestrator = byBase['gemini-pro-orchestrator-neon'];
    assert.equal(orchestrator.fixedId, 'gemini-pro-orchestrator-neon');
    assert.deepEqual(orchestrator.tiers, []);

    assert.equal(byBase['trimmed-model'].label, 'Trimmed');
    assert.ok(!('' in byBase));

    assert.ok(buildAgyModelFamilies().length > 0, 'works without live models');
    assert.ok(buildAgyModelFamilies('not an array').length > 0, 'ignores invalid live data');
});

test('resolveAgyModelSelection finds the family and tier of a saved model id', async () => {
    const { buildAgyModelFamilies, resolveAgyModelSelection } = await import(optionsUrl);
    const families = buildAgyModelFamilies();

    assert.deepEqual(resolveAgyModelSelection('', families), { mode: 'auto', family: null, tier: null });
    assert.deepEqual(resolveAgyModelSelection('auto', families), { mode: 'auto', family: null, tier: null });

    const tiered = resolveAgyModelSelection('gemini-4-neon-high', families);
    assert.equal(tiered.mode, 'family');
    assert.equal(tiered.family.baseId, 'gemini-4-neon');
    assert.equal(tiered.tier, 'high');

    const fixed = resolveAgyModelSelection('gemini-pro-orchestrator-neon', families);
    assert.equal(fixed.mode, 'family');
    assert.equal(fixed.tier, null);

    assert.deepEqual(resolveAgyModelSelection('my-own-model', families), { mode: 'custom', family: null, tier: null });
});

test('option lists have unique values and the default presets exist', async () => {
    const options = await import(optionsUrl);

    for (const name of [
        'WHISPER_MODEL_OPTIONS',
        'AUDIO_INPUT_OPTIONS',
        'SPEECH_LANGUAGE_OPTIONS',
        'RESPONSE_LANGUAGE_OPTIONS',
        'CLAUDE_MODEL_PRESETS',
        'CLAUDE_EFFORT_OPTIONS',
    ]) {
        const values = options[name].map(option => option.value);
        assert.equal(new Set(values).size, values.length, `${name} has duplicate values`);
    }

    const { getPresetLabel } = require('../src/utils/presets');
    for (const option of options.PROFILE_OPTIONS) {
        assert.equal(getPresetLabel(option.value), option.label, `${option.value} label matches the preset list`);
    }
});

test('suggestWhisperUpgrade recommends the large model only for small models and non-English speech', async () => {
    const { suggestWhisperUpgrade, WHISPER_UPGRADE_TARGET, WHISPER_MODEL_OPTIONS } = await import(optionsUrl);

    assert.equal(suggestWhisperUpgrade('small-q5_1', 'uk-UA'), WHISPER_UPGRADE_TARGET);
    assert.equal(suggestWhisperUpgrade('small', 'auto'), WHISPER_UPGRADE_TARGET);
    assert.equal(suggestWhisperUpgrade('small-q5_1', undefined), WHISPER_UPGRADE_TARGET);
    assert.equal(suggestWhisperUpgrade('small-q5_1', 'pl-PL'), WHISPER_UPGRADE_TARGET);

    assert.equal(suggestWhisperUpgrade('small-q5_1', 'en-US'), null, 'English speech does not need the large model');
    assert.equal(suggestWhisperUpgrade('large-v3-turbo-q5_0', 'uk-UA'), null, 'already on the large model');
    assert.equal(suggestWhisperUpgrade('base-q5_1', 'uk-UA'), null, 'weak models have their own warning');
    assert.ok(
        WHISPER_MODEL_OPTIONS.some(option => option.value === WHISPER_UPGRADE_TARGET),
        'the target is a selectable model'
    );
});
