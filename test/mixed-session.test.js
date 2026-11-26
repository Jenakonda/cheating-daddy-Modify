// Drives the real IPC handlers of gemini.js with Electron, the Google SDK and the CLI session replaced by stand-ins.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-mixed-'));
os.homedir = () => home;

const handlers = new Map();
const sent = [];
const connections = [];
const httpRequests = [];
const httpConfigs = [];
const cliCalls = [];
const exhaustedKeys = new Set();
// When set, connecting behaves like the real SDK without a network: error, close, and a promise that never settles
let offline = false;

const cli = Object.fromEntries(
    ['processCliAudio', 'sendCliImage', 'sendCliText', 'addExternalTurn', 'closeCliSession'].map(name => [
        name,
        (...args) => {
            cliCalls.push([name, ...args]);
            return { success: true };
        },
    ])
);
cli.initializeCliSession = async options => {
    cliCalls.push(['initializeCliSession', options]);
    return true;
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') {
        return {
            BrowserWindow: { getAllWindows: () => [{ webContents: { send: (...args) => sent.push(args) } }] },
            ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        };
    }
    if (request === './cliai') return cli;
    if (request === '@google/genai') {
        return {
            GoogleGenAI: class {
                constructor({ apiKey }) {
                    this.live = {
                        connect: async ({ callbacks, config }) => {
                            if (offline) {
                                callbacks.onerror({ message: 'getaddrinfo ENOTFOUND generativelanguage.googleapis.com' });
                                callbacks.onclose({ reason: '' });
                                return new Promise(() => {});
                            }
                            const session = { apiKey, callbacks, config, inputs: [], sendRealtimeInput: async input => session.inputs.push(input) };
                            session.close = async () => callbacks.onclose({ reason: '' });
                            connections.push(session);
                            callbacks.onopen();
                            return session;
                        },
                    };
                    this.models = {
                        generateContentStream: async ({ model, config }) => {
                            httpRequests.push([apiKey, model]);
                            httpConfigs.push(config);
                            if (exhaustedKeys.has(apiKey)) throw Object.assign(new Error('quota'), { status: 429 });
                            return (async function* () {
                                yield { text: `answer with ${apiKey}` };
                            })();
                        },
                    };
                }
            },
        };
    }
    return originalLoad.call(this, request, ...rest);
};

const storage = require('../src/storage');
storage.initializeStorage();
storage.setApiKey('main-key');
storage.setBackupKeys('gemini', ['spare-key']);

const { setupGeminiIpcHandlers } = require('../src/utils/gemini');
const sessionRef = { current: null };
setupGeminiIpcHandlers(sessionRef);

const invoke = (channel, ...args) => handlers.get(channel)({}, ...args);
const image = Buffer.alloc(2000).toString('base64');
const audio = { data: Buffer.alloc(200).toString('base64'), mimeType: 'audio/pcm;rate=24000', sampleRate: 24000 };
const called = name => cliCalls.filter(call => call[0] === name);
const reset = () => {
    cliCalls.length = 0;
    httpRequests.length = 0;
    sent.length = 0;
};

test.after(() => {
    Module._load = originalLoad;
    fs.rmSync(home, { recursive: true, force: true });
});

test('voice goes to Gemini Live while the screen and typed questions go to the CLI', async () => {
    reset();
    storage.updatePreference('mixedRoutes', { voice: 'byok', screen: 'cli', text: 'cli' });
    assert.deepEqual(await invoke('initialize-mixed', { profile: 'exam', language: 'uk-UA' }), { success: true });

    const [, options] = called('initializeCliSession')[0];
    assert.equal(options.whisperEnabled, false, 'the CLI must not transcribe speech that goes to the API');
    assert.equal(options.startsSession, false);

    await invoke('send-audio-content', audio);
    await invoke('send-mic-audio-content', audio);
    assert.equal(connections.at(-1).inputs.length, 2);
    assert.equal(called('processCliAudio').length, 0);

    await invoke('send-image-content', { data: image, prompt: 'what is this' });
    await invoke('send-text-message', 'hello');
    assert.equal(called('sendCliImage').length, 1);
    assert.equal(called('sendCliText').length, 1);
    assert.equal(httpRequests.length, 0);

    // What Live answered is passed on to the CLI
    const live = connections.at(-1);
    live.callbacks.onmessage({ serverContent: { inputTranscription: { text: 'a question' }, outputTranscription: { text: 'an answer' } } });
    live.callbacks.onmessage({ serverContent: { turnComplete: true } });
    assert.deepEqual(called('addExternalTurn')[0].slice(1), ['a question', 'an answer']);
    const shown = sent.find(args => args[0] === 'new-response');
    assert.match(shown[2], /^live-/, 'every answer carries a stream id');

    await invoke('close-session');
    assert.equal(called('closeCliSession').length, 1);
    assert.equal(sessionRef.current, null);
});

test('voice can go to the CLI while the API reads the screen and answers typed questions', async () => {
    reset();
    const before = connections.length;
    storage.updatePreference('mixedRoutes', { voice: 'cli', screen: 'byok', text: 'byok' });
    assert.deepEqual(await invoke('initialize-mixed', { profile: 'exam' }), { success: true });
    assert.equal(connections.length, before, 'no Live connection is needed');
    assert.equal(called('initializeCliSession')[0][1].whisperEnabled, true);

    await invoke('send-audio-content', audio);
    assert.equal(called('processCliAudio').length, 1);

    // The first key is out of quota, so the backup key answers both requests
    exhaustedKeys.add('main-key');
    const screen = await invoke('send-image-content', { data: image, prompt: 'what is this' });
    assert.equal(screen.text, 'answer with spare-key');
    const typed = await invoke('send-text-message', 'hello');
    assert.equal(typed.success, true);
    assert.deepEqual(
        httpRequests.map(request => request[0]),
        ['main-key', 'spare-key', 'spare-key']
    );
    assert.equal(called('addExternalTurn').length, 2);
    assert.equal(called('sendCliImage').length + called('sendCliText').length, 0);
    exhaustedKeys.clear();
    await invoke('close-session');
});

test('a Live session refused for its key reconnects with the backup key, then gives up', async () => {
    reset();
    connections.length = 0;
    const started = await invoke('initialize-gemini', '', 'interview', 'en-US');
    assert.equal(started.success, true);
    const first = connections.at(-1);

    first.callbacks.onclose({ reason: 'You exceeded your current quota' });
    const deadline = Date.now() + 8000;
    while (connections.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    const second = connections.at(-1);
    assert.notEqual(second.apiKey, first.apiKey);

    second.callbacks.onclose({ reason: 'API key not valid. Please pass a valid API key.' });
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(connections.length, 2, 'each key is tried once');
    assert.ok(sent.some(args => args[0] === 'new-response' && args[1].startsWith('None of your Gemini keys worked')));
    await invoke('close-session');
});

// Waits without Date.now, which the next test replaces
async function waitForConnections(count) {
    for (let step = 0; step < 80 && connections.length < count; step++) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(connections.length, count, 'the app did not reconnect');
    // Let the reconnect finish restoring the context
    await new Promise(resolve => setTimeout(resolve, 50));
    return connections.at(-1);
}

test('a long session keeps resuming, falls back to text context and stops only when connections keep failing', async t => {
    reset();
    connections.length = 0;
    let clock = 1_000_000;
    t.mock.method(Date, 'now', () => clock);
    const dropped = 'The operation was aborted.';

    assert.equal((await invoke('initialize-gemini', '', 'interview', 'en-US')).success, true);
    let live = connections.at(-1);
    assert.deepEqual(live.config.sessionResumption, {}, 'resumption is requested from the start');
    live.callbacks.onmessage({ serverContent: { inputTranscription: { text: 'a question' }, outputTranscription: { text: 'an answer' } } });
    live.callbacks.onmessage({ serverContent: { turnComplete: true } });

    // Six scheduled disconnects, ten minutes apart: more than the three attempts allowed in a row
    for (let round = 1; round <= 6; round++) {
        live.callbacks.onopen();
        live.callbacks.onmessage({ setupComplete: {} });
        live.callbacks.onmessage({ sessionResumptionUpdate: { resumable: true, newHandle: `handle-${round}` } });
        live.callbacks.onmessage({ sessionResumptionUpdate: { resumable: false, newHandle: '' } });
        clock += 10 * 60 * 1000;
        live.callbacks.onclose({ reason: dropped });
        live = await waitForConnections(round + 1);
        assert.deepEqual(live.config.sessionResumption, { handle: `handle-${round}` });
        assert.deepEqual(live.inputs, [], 'a resumed session is not told the conversation again');
    }

    // Google refuses the handle: the next connection starts fresh and receives the conversation as text
    live.callbacks.onopen();
    live.callbacks.onclose({ reason: 'Request contains an invalid argument.' });
    live = await waitForConnections(8);
    assert.deepEqual(live.config.sessionResumption, {});
    assert.match(live.inputs[0].text, /a question[\s\S]*an answer/);

    // Three short-lived connections in a row use up the attempts (this is the third attempt) and the user is told
    live.callbacks.onopen();
    live.callbacks.onmessage({ setupComplete: {} });
    live.callbacks.onclose({ reason: dropped });
    live = await waitForConnections(9);
    live.callbacks.onopen();
    live.callbacks.onclose({ reason: dropped });
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(connections.length, 9);
    assert.ok(sent.some(args => args[0] === 'reconnect-failed'));
    await invoke('close-session');
});

test('closing the session while it is reconnecting leaves no connection behind', async () => {
    connections.length = 0;
    await invoke('initialize-gemini', '', 'interview', 'en-US');
    connections[0].callbacks.onclose({ reason: 'The operation was aborted.' });
    await invoke('close-session');
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(connections.length, 1);
    assert.equal(sessionRef.current, null);
});

test('screen analysis over the API follows the preset, the custom instructions and the context folder', async () => {
    const folder = storage.getDefaultContextDir();
    fs.mkdirSync(folder, { recursive: true });
    const notes = path.join(folder, 'notes.txt');
    fs.writeFileSync(notes, 'CONTEXT-MARKER: the release is on Friday.');
    storage.updatePreference('googleSearchEnabled', true);
    connections.length = 0;
    httpConfigs.length = 0;

    await invoke('initialize-gemini', 'CUSTOM-NOTE', 'interview', 'en-US');
    await invoke('send-image-content', { data: image, prompt: 'what is this' });
    const screenPrompt = httpConfigs.at(-1).systemInstruction;
    assert.ok(screenPrompt.includes('CUSTOM-NOTE'));
    assert.ok(screenPrompt.includes('CONTEXT-MARKER'));
    // Only the Live connection has the Google Search tool, so only its prompt talks about it
    assert.ok(!screenPrompt.includes('SEARCH TOOL USAGE'));
    const livePrompt = connections.at(-1).config.systemInstruction.parts[0].text;
    assert.ok(livePrompt.includes('SEARCH TOOL USAGE'));
    await invoke('close-session');

    // A folder too large to include is listed honestly, without promising excerpts that never come
    fs.writeFileSync(notes, 'long text '.repeat(4000));
    await invoke('initialize-gemini', '', 'interview', 'en-US');
    const largePrompt = connections.at(-1).config.systemInstruction.parts[0].text;
    assert.ok(largePrompt.includes('You cannot see the rest'));
    assert.ok(!/attach(es|ed)[^.]*automatically/i.test(largePrompt));
    await invoke('close-session');
    fs.rmSync(notes);
    storage.updatePreference('googleSearchEnabled', false);
});

test('a start without network fails with a reason and the next start works', async () => {
    reset();
    storage.updatePreference('mixedRoutes', { voice: 'byok', screen: 'cli', text: 'cli' });
    offline = true;
    const failed = await invoke('initialize-mixed', {});
    assert.equal(failed.success, false);
    assert.match(failed.error, /Check your internet connection/);
    assert.equal(called('closeCliSession').length, 1, 'the CLI part is closed again');

    offline = false;
    assert.deepEqual(await invoke('initialize-mixed', {}), { success: true });
    await invoke('close-session');
});

test('a network drop during a session ends with a message and does not block later sessions', async () => {
    reset();
    connections.length = 0;
    assert.equal((await invoke('initialize-gemini', '', 'interview', 'en-US')).success, true);

    offline = true;
    connections[0].callbacks.onclose({ reason: '' });
    const deadline = Date.now() + 15000;
    while (!sent.some(args => args[0] === 'reconnect-failed') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(
        sent.some(args => args[0] === 'reconnect-failed'),
        'the user was not told'
    );

    offline = false;
    assert.equal((await invoke('initialize-gemini', '', 'interview', 'en-US')).success, true);
    await invoke('close-session');
});

test('a mixed session that needs a key refuses to start without one', async () => {
    storage.setApiKey('');
    storage.setBackupKeys('gemini', []);
    storage.updatePreference('mixedRoutes', { voice: 'byok', screen: 'cli', text: 'cli' });
    const result = await invoke('initialize-mixed', {});
    assert.equal(result.success, false);
    assert.match(result.error, /Gemini API key/);
});
