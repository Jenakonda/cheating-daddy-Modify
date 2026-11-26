// Starts the real app in an isolated profile and talks to it through the Chrome DevTools Protocol.
// Nothing here touches the developer's own settings: HOME/USERPROFILE and the Electron profile point to a temp folder.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');

const projectRoot = path.resolve(__dirname, '..');

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(check, { timeoutMs = 60000, intervalMs = 400, label = 'condition' } = {}) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            const value = await check();
            if (value) return value;
        } catch (error) {
            lastError = error;
        }
        await sleep(intervalMs);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

/** Writes files into the fake profile before the app starts. Paths are relative to the config folder. */
function seedConfig(profileDir, files) {
    const configDir = path.join(profileDir, 'AppData', 'Roaming', 'cheating-daddy-config');
    fs.mkdirSync(configDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(configDir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
    return configDir;
}

async function startApp({ seed = null } = {}) {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-ui-test-'));
    if (seed) seedConfig(profileDir, seed);
    // Without this folder, PowerShell started by the app writes its cache into the project directory
    fs.mkdirSync(path.join(profileDir, 'AppData', 'Local'), { recursive: true });

    const port = await getFreePort();
    const electronPath = require('electron');
    const env = { ...process.env, USERPROFILE: profileDir, HOME: profileDir };
    delete env.ELECTRON_RUN_AS_NODE;

    const logs = [];
    const child = spawn(electronPath, ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(profileDir, 'electron-data')}`], {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    child.stdout.on('data', chunk => logs.push(String(chunk)));
    child.stderr.on('data', chunk => logs.push(String(chunk)));

    const target = await waitFor(
        async () => {
            const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
            return list.find(item => item.type === 'page' && item.url.includes('index.html'));
        },
        { label: 'the app window' }
    );

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
    });

    let nextId = 0;
    const pending = new Map();
    const consoleErrors = [];
    ws.on('message', raw => {
        const message = JSON.parse(raw);
        if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
            return;
        }
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
            consoleErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
        }
        if (message.method === 'Runtime.exceptionThrown') {
            const details = message.params.exceptionDetails;
            consoleErrors.push(details.exception?.description || details.text);
        }
    });

    const send = (method, params = {}) =>
        new Promise(resolve => {
            const id = ++nextId;
            pending.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
        });
    await send('Runtime.enable');

    async function evaluate(expression) {
        const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        const result = response.result;
        if (result.exceptionDetails) {
            throw new Error(`Page error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
        }
        return result.result.value;
    }

    async function screenshot() {
        const response = await send('Page.captureScreenshot', { format: 'png' });
        return Buffer.from(response.result.data, 'base64');
    }

    async function stop() {
        try {
            ws.close();
        } catch {
            // already closed
        }
        if (child.exitCode === null) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
            } else {
                child.kill('SIGKILL');
            }
        }
        await sleep(800);
        try {
            fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 });
        } catch (error) {
            // An installed CLI can outlive the app and keep the folder locked. That is not a test failure.
            console.warn(`Could not remove the temporary profile ${profileDir}: ${error.code || error.message}`);
        }
    }

    return {
        evaluate,
        screenshot,
        stop,
        waitFor,
        consoleErrors,
        logs,
        profileDir,
        configDir: path.join(profileDir, 'AppData', 'Roaming', 'cheating-daddy-config'),
    };
}

module.exports = { startApp, waitFor, sleep };
