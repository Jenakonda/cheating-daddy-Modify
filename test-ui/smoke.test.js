const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { startApp, waitFor } = require('./harness');

const APP = "document.querySelector('cheating-daddy-app')";

const SCREENS = [
    { view: 'main', element: 'main-view', expect: 'Start Session' },
    { view: 'ai-customize', element: 'ai-customize-view', expect: 'My presets' },
    { view: 'history', element: 'history-view', expect: 'History' },
    { view: 'customize', element: 'customize-view', expect: 'Data and storage' },
    { view: 'help', element: 'help-view', expect: 'Original project' },
];

const REQUIRED_API = [
    'startCapture',
    'stopCapture',
    'sendTextMessage',
    'handleShortcut',
    'initializeCli',
    'initializeLocal',
    'initializeGemini',
    'storage',
    'presets',
    'theme',
    'sanitizeHtml',
    'checkForUpdates',
];

test('the app starts in a fresh profile and every screen renders without errors', { timeout: 180000 }, async () => {
    const app = await startApp();
    try {
        // A new profile starts with onboarding
        await waitFor(() => app.evaluate(`${APP} && ${APP}.currentView`).then(view => view === 'onboarding'), { label: 'onboarding' });

        await app.evaluate("cheatingDaddy.storage.updateConfig('onboarded', true)");

        const api = await app.evaluate('Object.keys(window.cheatingDaddy)');
        for (const name of REQUIRED_API) {
            assert.ok(api.includes(name), `window.cheatingDaddy.${name} is missing`);
        }
        assert.equal(await app.evaluate('typeof window.captureManualScreenshot'), 'function');

        for (const screen of SCREENS) {
            await app.evaluate(`${APP}.navigate('${screen.view}')`);
            const text = await waitFor(
                async () => {
                    const content = await app.evaluate(
                        `(() => { const el = ${APP}.shadowRoot.querySelector('${screen.element}'); return el && el.shadowRoot ? el.shadowRoot.textContent : null; })()`
                    );
                    return content && content.includes(screen.expect) ? content : null;
                },
                { label: `${screen.view} screen showing "${screen.expect}"`, timeoutMs: 30000 }
            );
            assert.ok(text.length > 20);
        }

        assert.deepEqual(app.consoleErrors, [], `unexpected console errors:\n${app.consoleErrors.join('\n')}`);
    } finally {
        await app.stop();
    }
});

test('untrusted HTML and unsafe links are blocked', { timeout: 120000 }, async () => {
    const app = await startApp({ seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' } } });
    try {
        await waitFor(() => app.evaluate(`!!(${APP} && window.cheatingDaddy && ${APP}.currentView)`), { label: 'the main screen' });

        // The sanitizer removes scripts, handlers and script links but keeps formatting
        const cleaned = await app.evaluate(
            `cheatingDaddy.sanitizeHtml('<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><a href="javascript:window.__xss=3">a</a><b>bold</b>')`
        );
        assert.ok(!/onerror|<script|javascript:/i.test(cleaned), `sanitizer left unsafe markup: ${cleaned}`);
        assert.ok(cleaned.includes('<b>bold</b>'));

        // The CSP stops inline handlers even if markup slips through
        const ran = await app.evaluate(`(async () => {
            window.__xss = null;
            const div = document.createElement('div');
            div.innerHTML = '<img src=x onerror="window.__xss=1">';
            document.body.appendChild(div);
            await new Promise(resolve => setTimeout(resolve, 600));
            div.remove();
            return window.__xss;
        })()`);
        assert.equal(ran, null, 'an inline event handler ran');

        // Only web links can be opened through IPC
        const refused = await app.evaluate(`require('electron').ipcRenderer.invoke('open-external', 'file:///C:/Windows/notepad.exe')`);
        assert.equal(refused.success, false);
    } finally {
        await app.stop();
    }
});

test('presets and data usage work against a real profile', { timeout: 120000 }, async () => {
    const app = await startApp({ seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' } } });
    try {
        await waitFor(() => app.evaluate(`!!(window.cheatingDaddy && window.cheatingDaddy.presets)`), { label: 'the renderer API' });

        const before = await app.evaluate('cheatingDaddy.presets.list().then(list => list.length)');
        await app.evaluate(
            `cheatingDaddy.presets.saveCustom([{ id: 'custom:smoke', name: 'Smoke test', basePreset: 'exam', instructions: 'Be brief.' }, { id: 'interview', name: 'Not allowed' }])`
        );
        const after = await app.evaluate('cheatingDaddy.presets.list().then(list => list.map(item => item.label))');
        assert.equal(after.length, before + 1, 'invalid presets must be dropped');
        assert.ok(after.includes('Smoke test'));

        const usage = await app.evaluate('cheatingDaddy.data.getUsage()');
        assert.equal(usage.success, true);
        assert.deepEqual(
            usage.data.map(item => item.id),
            ['history', 'models', 'binaries', 'logs', 'cli-sessions', 'context']
        );
    } finally {
        await app.stop();
    }
});

test('saved API keys are encrypted on disk with the operating system and still readable by the app', { timeout: 120000 }, async () => {
    const app = await startApp({
        seed: {
            'config.json': { configVersion: 1, onboarded: true, layout: 'normal' },
            'credentials.json': { apiKey: 'plain-gemini-key-123', groqApiKey: 'plain-groq-key-456', cloudToken: 'old-token' },
        },
    });
    try {
        await waitFor(() => app.evaluate(`!!(window.cheatingDaddy && window.cheatingDaddy.storage)`), { label: 'the renderer API' });

        // The app reads the real values back
        assert.equal(await app.evaluate('cheatingDaddy.storage.getApiKey()'), 'plain-gemini-key-123');
        const credentials = await app.evaluate('cheatingDaddy.storage.getCredentials()');
        assert.equal(credentials.groqApiKey, 'plain-groq-key-456');
        assert.ok(!('cloudToken' in credentials));

        // On disk they are encrypted
        const onDisk = fs.readFileSync(path.join(app.configDir, 'credentials.json'), 'utf8');
        assert.ok(!onDisk.includes('plain-gemini-key-123'), 'the Gemini key is stored in clear text');
        assert.ok(!onDisk.includes('plain-groq-key-456'), 'the Groq key is stored in clear text');
        assert.ok(!onDisk.includes('old-token'));
        assert.ok(onDisk.includes('enc:v1:'));

        // A key saved from the UI is encrypted as well
        await app.evaluate(`cheatingDaddy.storage.setApiKey('another-key-789')`);
        const afterSave = fs.readFileSync(path.join(app.configDir, 'credentials.json'), 'utf8');
        assert.ok(!afterSave.includes('another-key-789'));
        assert.equal(await app.evaluate('cheatingDaddy.storage.getApiKey()'), 'another-key-789');
        assert.equal((await app.evaluate('cheatingDaddy.storage.getCredentials()')).groqApiKey, 'plain-groq-key-456');
    } finally {
        await app.stop();
    }
});

test('Home suggests a better speech model and offers vocabulary hints', { timeout: 120000 }, async () => {
    const app = await startApp({ seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' } } });
    try {
        const homeText = () =>
            app.evaluate(
                `(() => { const el = ${APP} && ${APP}.shadowRoot.querySelector('main-view'); return el && el.shadowRoot ? el.shadowRoot.textContent : ''; })()`
            );
        await waitFor(async () => (await homeText()).includes('Start Session'), { label: 'the Home screen' });

        // The default small model with automatic language gets a suggestion and the vocabulary field
        await app.evaluate(`(() => { const mv = ${APP}.shadowRoot.querySelector('main-view'); mv._mode = 'cli'; mv.requestUpdate(); })()`);
        await waitFor(async () => (await homeText()).includes('Switch to Large v3 Turbo'), { label: 'the model suggestion' });
        assert.ok((await homeText()).includes('Vocabulary hints'));

        // Switching the model removes the suggestion
        await app.evaluate(`${APP}.shadowRoot.querySelector('main-view')._saveWhisperModel('large-v3-turbo-q5_0')`);
        await waitFor(async () => !(await homeText()).includes('Switch to Large v3 Turbo'), { label: 'the suggestion to disappear' });

        // Vocabulary hints are saved, cleaned and limited
        await app.evaluate(`${APP}.shadowRoot.querySelector('main-view')._saveSpeechVocabulary('terabyte,\\nSQL')`);
        const saved = await app.evaluate('cheatingDaddy.storage.getPreferences().then(prefs => prefs.speechVocabulary)');
        assert.equal(saved, 'terabyte, SQL');
        await app.evaluate(`cheatingDaddy.storage.updatePreference('speechVocabulary', '${'x'.repeat(900)}')`);
        assert.equal((await app.evaluate('cheatingDaddy.storage.getPreferences().then(prefs => prefs.speechVocabulary)')).length, 400);
    } finally {
        await app.stop();
    }
});

test('a transcript line can be edited in the message box before it is sent', { timeout: 120000 }, async () => {
    const app = await startApp({ seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' } } });
    try {
        await waitFor(() => app.evaluate(`!!(${APP} && ${APP}.shadowRoot.querySelector('main-view'))`), { label: 'the Home screen' });

        await app.evaluate(`(() => {
            const a = ${APP};
            a._transcript = [{ id: '1', source: 'speaker', text: 'Скільки мегабайт ви витрабайте?', ts: Date.now() }];
            a.navigate('assistant');
        })()`);
        await waitFor(() => app.evaluate(`!!${APP}.shadowRoot.querySelector('assistant-view')`), { label: 'the session screen' });
        await app.evaluate(`${APP}.shadowRoot.querySelector('assistant-view')._showTranscript = true`);

        const clicked = await waitFor(
            () =>
                app.evaluate(`(() => {
                    const view = ${APP}.shadowRoot.querySelector('assistant-view');
                    const edit = [...view.shadowRoot.querySelectorAll('.transcript-ask')].find(button => button.textContent.trim() === 'Edit');
                    if (!edit) return false;
                    edit.click();
                    return true;
                })()`),
            { label: 'the Edit button' }
        );
        assert.equal(clicked, true);

        const value = await app.evaluate(`${APP}.shadowRoot.querySelector('assistant-view').shadowRoot.querySelector('#textInput').value`);
        assert.equal(value, 'Скільки мегабайт ви витрабайте?');

        const focused = await app.evaluate(
            `${APP}.shadowRoot.querySelector('assistant-view').shadowRoot.activeElement && ${APP}.shadowRoot.querySelector('assistant-view').shadowRoot.activeElement.id`
        );
        assert.equal(focused, 'textInput');
    } finally {
        await app.stop();
    }
});
