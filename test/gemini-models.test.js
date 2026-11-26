const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gemini = require('../src/utils/gemini-models');
const { createLineSplitter } = require('../src/utils/sse');

test('sanitizeModelId accepts model ids and rejects everything else', () => {
    const { sanitizeModelId } = gemini;
    assert.equal(sanitizeModelId(' models/gemini-3.8-flash ', 'x'), 'gemini-3.8-flash');
    assert.equal(sanitizeModelId('gemini-4-neon', 'x'), 'gemini-4-neon');
    for (const bad of ['', '   ', null, 42, 'a/b', 'gemini?key=1', '../x', 'a'.repeat(101)]) {
        assert.equal(sanitizeModelId(bad, 'fallback'), 'fallback', `${bad} must be rejected`);
    }
});

test('the Live setup only sends proactivity to Gemini 2.5 models', () => {
    const current = gemini.buildLiveSessionOptions('gemini-3.8-live', { systemPrompt: 'Hi', tools: [{ googleSearch: {} }] });
    assert.equal(current.apiVersion, 'v1beta');
    assert.ok(!('proactivity' in current.config));
    assert.ok(!('speechConfig' in current.config));
    assert.deepEqual(current.config.tools, [{ googleSearch: {} }]);
    assert.equal(current.config.systemInstruction.parts[0].text, 'Hi');
    assert.deepEqual(current.config.sessionResumption, {});

    const resumed = gemini.buildLiveSessionOptions('gemini-3.8-live', { systemPrompt: 'Hi', resumeHandle: 'abc' });
    assert.deepEqual(resumed.config.sessionResumption, { handle: 'abc' });
    const plain = gemini.buildLiveSessionOptions('gemini-3.8-live', { systemPrompt: 'Hi', resumption: false, resumeHandle: 'abc' });
    assert.ok(!('sessionResumption' in plain.config));

    const old = gemini.buildLiveSessionOptions('gemini-2.5-flash-native-audio-preview-12-2025', { systemPrompt: 'Hi' });
    assert.equal(old.apiVersion, 'v1alpha');
    assert.deepEqual(old.config.proactivity, { proactiveAudio: true });
});

test('API errors become readable messages that name the model', () => {
    const retired = new Error(
        'got status: 404 Not Found. {"error":{"message":"This model models/gemini-2.5-flash is no longer available to new users.","code":404}}'
    );
    assert.match(gemini.describeGeminiError(retired, 'gemini-2.5-flash'), /"gemini-2\.5-flash" is not available.*Choose another/);
    assert.match(gemini.describeGeminiError('API key not valid. Please pass a valid API key.', 'm'), /API key is not valid/);
    assert.match(gemini.describeGeminiError({ status: 429, message: 'quota' }, 'm'), /rate limit/);
    assert.equal(gemini.describeGeminiError(new Error('socket hang up'), 'm'), 'Gemini error: socket hang up');

    assert.ok(gemini.isPermanentGeminiError('models/x is not found for API version v1beta'));
    assert.ok(gemini.isPermanentGeminiError('Request contains an invalid argument.'));
    assert.ok(!gemini.isPermanentGeminiError('Deadline expired'));
    assert.ok(!gemini.isPermanentGeminiError(''));
});

test('listGeminiModels sends the key in a header, follows pages and groups the models', async () => {
    const calls = [];
    const pages = [
        {
            models: [
                { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.8-live', supportedGenerationMethods: ['bidiGenerateContent'] },
                { name: 'models/gemini-3.5-transcribe-live', supportedGenerationMethods: ['bidiGenerateContent'] },
            ],
            nextPageToken: 'next',
        },
        {
            models: [
                { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            ],
        },
    ];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => pages[calls.length - 1] };
    };

    const result = await gemini.listGeminiModels('secret-key', fetchImpl);
    assert.deepEqual(result, { generate: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], live: ['gemini-3.8-live'] });
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => !call.url.includes('secret-key')));
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'secret-key');
    assert.ok(calls[1].url.includes('pageToken=next'));

    await assert.rejects(
        gemini.listGeminiModels('bad', async () => ({ ok: false, status: 400, text: async () => 'API key not valid' })),
        /API key not valid/
    );
});

test('the line splitter keeps a line that a network chunk cut in half', () => {
    const push = createLineSplitter();
    assert.deepEqual(push('data: {"a":'), []);
    assert.deepEqual(push('1}\r\n\r\ndata: [DO'), ['data: {"a":1}']);
    assert.deepEqual(push('NE]\n\n'), ['data: [DONE]']);
});

test('the old default Live model is replaced once and a later choice is kept', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-gemini-'));
    const originalHomedir = os.homedir;
    os.homedir = () => home;
    try {
        const storage = require('../src/storage');
        storage.initializeStorage();
        assert.equal(storage.getConfig().geminiLiveModel, 'gemini-3.8-live');
        assert.equal(storage.getConfig().geminiModel, 'gemini-3.8-flash');

        // A profile saved by an older version has no version marker
        const dir = fs.readdirSync(home, { recursive: true }).find(name => String(name).endsWith('config.json'));
        const configPath = path.join(home, String(dir));
        fs.writeFileSync(configPath, JSON.stringify({ configVersion: 1, geminiLiveModel: 'gemini-3.1-flash-live-preview' }));
        storage.initializeStorage();
        assert.equal(storage.getConfig().geminiLiveModel, 'gemini-3.8-live');

        storage.updateConfig('geminiLiveModel', 'gemini-3.1-flash-live-preview');
        storage.initializeStorage();
        assert.equal(storage.getConfig().geminiLiveModel, 'gemini-3.1-flash-live-preview');
    } finally {
        os.homedir = originalHomedir;
        fs.rmSync(home, { recursive: true, force: true });
    }
});

// The exact shape the SDK reports for an overloaded model: JSON inside a JSON string
const overloaded = () =>
    new Error(
        `got status: 503 Service Unavailable. ${JSON.stringify({
            error: {
                message: JSON.stringify({
                    error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' },
                }),
                code: 503,
                status: 'Service Unavailable',
            },
        })}`
    );

async function* chunks(...texts) {
    for (const text of texts) yield { text };
}

// Runs streamGeminiAnswer against a scripted list of results, one per request
async function runScript(selected, script) {
    const requested = [];
    const shown = [];
    let waits = 0;
    const run = gemini.streamGeminiAnswer({
        selected,
        generate: async model => {
            requested.push(model);
            const step = script[requested.length - 1];
            if (step instanceof Error) throw step;
            return step;
        },
        onText: (text, isFirst) => shown.push([text, isFirst]),
        wait: async () => waits++,
    });
    const [result] = await Promise.allSettled([run]);
    return { result, requested, shown, waits };
}

test('an overloaded model gets one more try before a backup answers', async () => {
    assert.ok(gemini.isBusyGeminiError(overloaded()));
    assert.match(gemini.describeGeminiError(overloaded(), 'gemini-3.8-flash'), /"gemini-3\.8-flash" is overloaded/);

    const second = await runScript('gemini-3.8-flash', [overloaded(), chunks('Hel', 'lo')]);
    assert.deepEqual(second.result.value, { text: 'Hello', model: 'gemini-3.8-flash' });
    assert.equal(second.waits, 1);
    assert.deepEqual(second.shown, [
        ['Hel', true],
        ['Hello', false],
    ]);

    const backup = await runScript('gemini-3.8-flash', [overloaded(), overloaded(), chunks('ok')]);
    assert.deepEqual(backup.requested, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.6-flash']);
    assert.equal(backup.result.value.model, 'gemini-3.6-flash');
});

test('when every model fails the error of the chosen model is reported', async () => {
    const first = overloaded();
    const retired = Object.assign(new Error('not found'), { status: 404 });
    const run = await runScript('my-model', [first, overloaded(), retired, overloaded(), overloaded()]);
    assert.deepEqual(run.requested, ['my-model', 'my-model', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
    assert.equal(run.waits, 1);
    assert.equal(run.result.reason.status, undefined);
    assert.match(run.result.reason.message, /503/);
});

test('rate limits skip to a backup, other errors and half-shown answers are not retried', async () => {
    const limited = await runScript('gemini-3.8-flash', [Object.assign(new Error('quota'), { status: 429 }), chunks('ok')]);
    assert.deepEqual(limited.requested, ['gemini-3.8-flash', 'gemini-3.6-flash']);
    assert.equal(limited.waits, 0);

    const badKey = await runScript('gemini-3.8-flash', [new Error('got status: 400 Bad Request. API key not valid')]);
    assert.equal(badKey.requested.length, 1);
    assert.equal(badKey.result.status, 'rejected');

    async function* breaksMidway() {
        yield { text: 'Half' };
        throw overloaded();
    }
    const partial = await runScript('gemini-3.8-flash', [breaksMidway()]);
    assert.equal(partial.requested.length, 1);
    assert.equal(partial.result.status, 'rejected');
});

test('opening a Live connection fails instead of hanging, and a late connection is closed', async () => {
    const never = () => new Promise(() => {});
    const calls = [];
    const callbacks = { onopen: () => calls.push('open'), onerror: () => calls.push('error'), onclose: () => calls.push('close') };

    await assert.rejects(
        gemini.openLiveSession(cbs => {
            cbs.onerror({ message: 'getaddrinfo ENOTFOUND host' });
            cbs.onclose({ reason: '' });
            return never();
        }, callbacks),
        /Could not connect to Gemini: getaddrinfo ENOTFOUND/
    );
    await assert.rejects(
        gemini.openLiveSession(cbs => {
            cbs.onclose({ reason: 'API key not valid' });
            return never();
        }, callbacks),
        /API key not valid/
    );
    assert.deepEqual(calls, [], 'a connection that never opened is not reported to the app');

    let finish;
    let closed = false;
    let late;
    await assert.rejects(
        gemini.openLiveSession(
            cbs => {
                late = cbs;
                return new Promise(resolve => (finish = resolve));
            },
            callbacks,
            20
        ),
        /no answer in time/
    );
    late.onopen();
    finish({ close: () => (closed = true) });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(closed);
    assert.deepEqual(calls, []);

    // A connection that opened reports its own errors and closing
    const session = await gemini.openLiveSession(async cbs => {
        cbs.onopen();
        setImmediate(() => {
            cbs.onerror({ message: 'x' });
            cbs.onclose({ reason: '' });
        });
        return 'session';
    }, callbacks);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(session, 'session');
    assert.deepEqual(calls, ['open', 'error', 'close']);

    assert.match(gemini.describeGeminiError(new Error('Could not connect to Gemini: no answer in time'), 'm'), /internet connection/);
});
