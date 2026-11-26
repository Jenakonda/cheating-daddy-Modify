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
    'initializeMixed',
    'listGeminiModels',
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

test('the Gemini models for a personal API key can be chosen on Home', { timeout: 120000 }, async () => {
    // A profile saved by 0.11.0 still holds the old default Live model
    const app = await startApp({
        seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal', geminiLiveModel: 'gemini-3.1-flash-live-preview' } },
    });
    try {
        const view = `${APP}.shadowRoot.querySelector('main-view')`;
        await waitFor(() => app.evaluate(`!!(${APP} && ${view})`), { label: 'the Home screen' });
        const config = () => app.evaluate('cheatingDaddy.storage.getConfig()');
        assert.equal((await config()).geminiLiveModel, 'gemini-3.8-live', 'the old default is replaced');

        await app.evaluate(`(() => { const mv = ${view}; mv._mode = 'byok'; mv.requestUpdate(); })()`);
        const select = `${view}.shadowRoot.querySelector('[data-field="screen"] select')`;
        await waitFor(() => app.evaluate(`!!${select}`), { label: 'the model list' });
        assert.equal(await app.evaluate(`${select}.value`), 'gemini-3.8-flash');

        const choose = value => app.evaluate(`(() => { const s = ${select}; s.value = '${value}'; s.dispatchEvent(new Event('change')); })()`);
        await choose('gemini-3.5-flash-lite');
        await waitFor(async () => (await config()).geminiModel === 'gemini-3.5-flash-lite', { label: 'the choice to be saved' });

        // Any other model id can be typed in
        await choose('__custom__');
        const input = `${view}.shadowRoot.querySelector('[data-field="screen"] input')`;
        await waitFor(() => app.evaluate(`!!${input}`), { label: 'the custom field' });
        await app.evaluate(`(() => { const i = ${input}; i.value = 'gemini-9-test'; i.dispatchEvent(new Event('input')); })()`);
        await waitFor(async () => (await config()).geminiModel === 'gemini-9-test', { label: 'the custom id to be saved' });

        // Without a key the model list explains what is missing instead of calling Google
        const listing = await app.evaluate('cheatingDaddy.listGeminiModels()');
        assert.equal(listing.success, false);
        assert.deepEqual(app.consoleErrors, [], app.consoleErrors.join('\n'));
    } finally {
        await app.stop();
    }
});

test('the mode switch offers a mixed mode and backup keys are saved encrypted', { timeout: 120000 }, async () => {
    const app = await startApp({ seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' } } });
    try {
        const view = `${APP}.shadowRoot.querySelector('main-view')`;
        const find = selector => `${view}.shadowRoot.querySelector('${selector}')`;
        await waitFor(() => app.evaluate(`!!(${APP} && ${view} && ${find('[data-mode="mixed"]')})`), { label: 'the mode switch' });
        const prefs = () => app.evaluate('cheatingDaddy.storage.getPreferences()');

        await app.evaluate(`${find('[data-mode="mixed"]')}.click()`);
        await waitFor(async () => (await prefs()).providerMode === 'mixed', { label: 'the mode to be saved' });
        await waitFor(() => app.evaluate(`!!${find('[data-route="screen"] select')}`), { label: 'the routes' });
        const values = await app.evaluate(`[...${view}.shadowRoot.querySelectorAll('[data-route] select')].map(select => select.value)`);
        assert.deepEqual(values, ['byok', 'cli', 'cli']);

        await app.evaluate(
            `(() => { const s = ${find('[data-route="screen"] select')}; s.value = 'byok'; s.dispatchEvent(new Event('change')); })()`
        );
        await waitFor(async () => (await prefs()).mixedRoutes.screen === 'byok', { label: 'the route to be saved' });

        // Add two backup keys, type into them and remove the first
        const rows = `${view}.shadowRoot.querySelectorAll('[data-backups="gemini"] .key-row')`;
        const add = find('[data-backups="gemini"] .key-add');
        await app.evaluate(`${add}.click()`);
        await waitFor(() => app.evaluate(`${rows}.length === 1`), { label: 'the first key field' });
        await app.evaluate(`${add}.click()`);
        await waitFor(() => app.evaluate(`${rows}.length === 2`), { label: 'the second key field' });
        await app.evaluate(
            `[...${rows}].forEach((row, i) => { const input = row.querySelector('input'); input.value = 'backup-secret-' + (i + 1); input.dispatchEvent(new Event('input')); })`
        );
        await waitFor(() => app.evaluate(`cheatingDaddy.storage.getBackupKeys('gemini').then(keys => keys.length === 2)`), {
            label: 'both keys to be saved',
        });
        assert.ok(!fs.readFileSync(path.join(app.configDir, 'credentials.json'), 'utf8').includes('backup-secret'));

        await app.evaluate(`${rows}[0].querySelector('.key-remove').click()`);
        await waitFor(() => app.evaluate(`cheatingDaddy.storage.getBackupKeys('gemini').then(keys => keys.join() === 'backup-secret-2')`), {
            label: 'the first key to be removed',
        });
        assert.equal(await app.evaluate(`${rows}[0].querySelector('input').value`), 'backup-secret-2');

        // Every mode renders
        for (const mode of ['cli', 'byok', 'local', 'mixed']) {
            await app.evaluate(`${find(`[data-mode="${mode}"]`)}.click()`);
            await waitFor(() => app.evaluate(`${find('.mode-tab.active')}.dataset.mode === '${mode}' && !!${find('.start-button')}`), {
                label: `the ${mode} mode`,
            });
        }

        // Two answers arriving at once stay apart
        const responses = await app.evaluate(`(() => {
            const a = ${APP};
            a.responses = [];
            a.addNewResponse('voice 1', 'live-1');
            a.addNewResponse('screen 1', 'cli-1');
            a.updateCurrentResponse('voice 2', 'live-1');
            a.updateCurrentResponse('screen 2', 'cli-1');
            return a.responses;
        })()`);
        assert.deepEqual(responses, ['voice 2', 'screen 2']);
        assert.deepEqual(app.consoleErrors, [], app.consoleErrors.join('\n'));
    } finally {
        await app.stop();
    }
});

test('a saved answer text size applies at start and Settings shows it in pixels', { timeout: 120000 }, async () => {
    // 'medium' is what older versions saved; the second profile has a size the user picked
    for (const [saved, expected] of [
        ['medium', 15],
        [24, 24],
    ]) {
        const app = await startApp({
            seed: { 'config.json': { configVersion: 1, onboarded: true, layout: 'normal' }, 'preferences.json': { fontSize: saved } },
        });
        try {
            const applied = () => app.evaluate(`document.documentElement.style.getPropertyValue('--response-font-size')`);
            await waitFor(async () => (await applied()) === `${expected}px`, { label: 'the saved size to apply on the Home screen' });

            await app.evaluate(`${APP}.navigate('customize')`);
            const labels = `[...${APP}.shadowRoot.querySelector('customize-view').shadowRoot.querySelectorAll('.slider-value')].map(el => el.textContent.trim())`;
            await waitFor(() => app.evaluate(`!!${APP}.shadowRoot.querySelector('customize-view') && ${labels}.includes('${expected}px')`), {
                label: 'the size in Settings',
            });

            await app.evaluate(`${APP}.navigate('assistant')`);
            await waitFor(
                () =>
                    app.evaluate(`(() => {
                        const view = ${APP}.shadowRoot.querySelector('assistant-view');
                        const box = view && view.shadowRoot.querySelector('.response-container');
                        return !!box && getComputedStyle(box).fontSize === '${expected}px';
                    })()`),
                { label: 'the answer text to use the size' }
            );
        } finally {
            await app.stop();
        }
    }
});
