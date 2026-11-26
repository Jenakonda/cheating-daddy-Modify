const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { sanitizeKeys, isKeyError, createKeyRing } = require('../src/utils/api-keys');
const { normalizeMixedRoutes, resolveProvider, getMixedRequirements } = require('../src/utils/routing');

const httpError = (status, message = 'error') => Object.assign(new Error(message), { status });

test('sanitizeKeys drops blanks, duplicates and anything that is not a key string', () => {
    assert.deepEqual(sanitizeKeys([' a-1 ', '', 'a-1', 'b\n2', 7, null, 'x'.repeat(301)]), ['a-1', 'b2']);
    assert.deepEqual(sanitizeKeys('not a list'), []);
    assert.equal(sanitizeKeys(Array.from({ length: 250 }, (_, index) => `key-${index}`)).length, 250, 'the number of keys is not limited');
});

test('isKeyError is true only when another key could help', () => {
    for (const error of [
        httpError(429),
        httpError(401),
        httpError(403),
        new Error('got status: 400 Bad Request. API key not valid. Please pass a valid API key.'),
        'You exceeded your current quota, please check your plan',
        'Resource has been exhausted (e.g. check quota).',
    ]) {
        assert.ok(isKeyError(error), `${error.message || error} should switch keys`);
    }
    for (const error of [httpError(503, 'high demand'), httpError(404, 'model not found'), new Error('socket hang up'), '', null]) {
        assert.ok(!isKeyError(error), `${error?.message ?? error} should not switch keys`);
    }
});

test('the key ring moves to the next key and remembers the one that worked', async () => {
    const ring = createKeyRing();
    const keys = ['first', 'second', 'third'];
    const asked = [];
    const switched = [];
    const attempt = async key => {
        asked.push(key);
        if (key === 'first') throw httpError(429);
        return `answer from ${key}`;
    };

    assert.equal(await ring.run('gemini', keys, attempt, index => switched.push(index)), 'answer from second');
    assert.deepEqual(asked, ['first', 'second']);
    assert.deepEqual(switched, [1]);

    // The next request starts with the key that worked; other providers are unaffected
    asked.length = 0;
    await ring.run('gemini', keys, attempt);
    assert.deepEqual(asked, ['second']);
    assert.deepEqual(ring.order('groq', keys), keys);
    assert.deepEqual(ring.order('gemini', keys), ['second', 'third', 'first']);
    assert.deepEqual(ring.order('gemini', ['other']), ['other'], 'a removed key is forgotten');
});

test('the key ring reports the first error when every key fails and does not hide other errors', async () => {
    const ring = createKeyRing();
    let calls = 0;
    await assert.rejects(
        ring.run('gemini', ['a', 'b'], async key => {
            calls += 1;
            throw httpError(429, `limit on ${key}`);
        }),
        /limit on a/
    );
    assert.equal(calls, 2);

    await assert.rejects(
        ring.run('gemini', ['a', 'b'], async () => {
            calls += 1;
            throw httpError(503, 'busy');
        }),
        /busy/
    );
    assert.equal(calls, 3, 'a busy service is not asked with every key');
    await assert.rejects(
        ring.run('gemini', [], async () => 'never'),
        /No API key configured/
    );
});

test('mixed routes fall back to safe defaults and tell what a session needs', () => {
    assert.deepEqual(normalizeMixedRoutes(undefined), { voice: 'byok', screen: 'cli', text: 'cli' });
    assert.deepEqual(normalizeMixedRoutes({ voice: 'cli', screen: 'local', text: 'byok', extra: 1 }), {
        voice: 'cli',
        screen: 'cli',
        text: 'byok',
    });

    assert.equal(resolveProvider('mixed', { screen: 'byok' }, 'screen'), 'byok');
    assert.equal(resolveProvider('cli', { screen: 'byok' }, 'screen'), 'cli', 'routes apply to mixed mode only');

    assert.deepEqual(getMixedRequirements({ voice: 'byok', screen: 'cli', text: 'cli' }), { cli: true, live: true, apiKey: true });
    assert.deepEqual(getMixedRequirements({ voice: 'cli', screen: 'byok', text: 'byok' }), { cli: true, live: false, apiKey: true });
    assert.deepEqual(getMixedRequirements({ voice: 'cli', screen: 'cli', text: 'cli' }), { cli: true, live: false, apiKey: false });
});

test('backup keys and routes are saved, cleaned and listed after the main key', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-keys-'));
    const originalHomedir = os.homedir;
    os.homedir = () => home;
    try {
        const storage = require('../src/storage');
        storage.initializeStorage();
        assert.deepEqual(storage.getProviderKeys('gemini'), []);

        storage.setApiKey('main');
        storage.setBackupKeys('gemini', ['spare-1', ' ', 'main', 'spare-2']);
        assert.deepEqual(storage.getProviderKeys('gemini'), ['main', 'spare-1', 'spare-2']);
        assert.deepEqual(storage.getBackupKeys('groq'), []);
        assert.equal(storage.setBackupKeys('other', ['x']), false);

        storage.setApiKey('');
        assert.deepEqual(storage.getProviderKeys('gemini'), ['spare-1', 'main', 'spare-2'], 'backups work without a main key');

        storage.updatePreference('mixedRoutes', { voice: 'nonsense', screen: 'byok' });
        assert.deepEqual(storage.getPreferences().mixedRoutes, { voice: 'byok', screen: 'byok', text: 'cli' });
    } finally {
        os.homedir = originalHomedir;
        fs.rmSync(home, { recursive: true, force: true });
    }
});
