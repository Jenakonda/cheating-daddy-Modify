const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');

const CLI_INSTALL_HINTS = {
    claude: {
        label: 'Claude Code CLI',
        subscription: 'Claude Pro / Max',
        installWin: 'irm https://claude.ai/install.ps1 | iex',
        installUnix: 'curl -fsSL https://claude.ai/install.sh | bash',
        installNpm: 'npm install -g @anthropic-ai/claude-code',
        loginCommand: 'claude',
        loginHint: 'Run `claude` in terminal and sign in with your Claude Pro account.',
    },
    gemini: {
        label: 'Google Antigravity CLI (agy)',
        subscription: 'Google AI Pro / Ultra',
        installWin: 'irm https://antigravity.google/cli/install.ps1 | iex',
        installUnix: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
        installCmd: 'curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd',
        installNpm: 'irm https://antigravity.google/cli/install.ps1 | iex',
        loginCommand: 'agy',
        loginHint: 'Run `agy` in terminal and sign in with your Google AI Pro account.',
    },
};

const DANGEROUS_PATH_PATTERN = /[\0\r\n;|&`$<>]/;

function isSafeCustomPath(inputPath) {
    if (typeof inputPath !== 'string') {
        return false;
    }

    const trimmed = inputPath.trim();
    if (!trimmed || trimmed.length > 512) {
        return false;
    }

    return !DANGEROUS_PATH_PATTERN.test(trimmed);
}

function isAgyBinary(binaryPath) {
    if (typeof binaryPath !== 'string' || !binaryPath.trim()) {
        return false;
    }
    const base = path
        .basename(binaryPath.trim())
        .toLowerCase()
        .replace(/\.(exe|cmd|bat|js|mjs|cjs)$/i, '');
    return base === 'agy' || base.startsWith('agy-') || base.includes('mock-agy');
}

function getCandidateBinaryPaths(commandName) {
    const home = os.homedir();
    const isWin = process.platform === 'win32';

    if (isWin) {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

        if (commandName === 'claude') {
            return [
                path.join(home, '.local', 'bin', 'claude.exe'),
                path.join(home, '.claude', 'local', 'claude.exe'),
                path.join(localAppData, 'Programs', 'claude', 'claude.exe'),
                path.join(localAppData, 'AnthropicClaude', 'claude.exe'),
                path.join(appData, 'npm', 'claude.cmd'),
            ];
        }

        if (commandName === 'agy') {
            return [
                path.join(localAppData, 'agy', 'bin', 'agy.exe'),
                path.join(localAppData, 'agy', 'bin', 'agy.cmd'),
                path.join(home, '.local', 'bin', 'agy.exe'),
                path.join(appData, 'Antigravity', 'bin', 'agy.exe'),
                path.join(home, '.gemini', 'antigravity', 'bin', 'agy.exe'),
            ];
        }

        return [
            path.join(appData, 'npm', 'gemini.cmd'),
            path.join(home, '.local', 'bin', 'gemini.exe'),
            path.join(localAppData, 'Programs', 'gemini', 'gemini.exe'),
            path.join(appData, 'npm', 'gemini.exe'),
        ];
    }

    if (commandName === 'claude') {
        return [
            path.join(home, '.local', 'bin', 'claude'),
            path.join(home, '.claude', 'local', 'claude'),
            '/opt/homebrew/bin/claude',
            '/usr/local/bin/claude',
            path.join(home, '.npm-global', 'bin', 'claude'),
        ];
    }

    if (commandName === 'agy') {
        return [
            path.join(home, '.local', 'bin', 'agy'),
            '/opt/homebrew/bin/agy',
            '/usr/local/bin/agy',
            path.join(home, '.antigravity', 'bin', 'agy'),
        ];
    }

    return [
        '/opt/homebrew/bin/gemini',
        '/usr/local/bin/gemini',
        path.join(home, '.local', 'bin', 'gemini'),
        path.join(home, '.npm-global', 'bin', 'gemini'),
    ];
}

function selectPreferredWhereMatch(lines) {
    const existing = lines
        .map(line => line.trim())
        .filter(Boolean)
        .filter(candidate => {
            try {
                return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
            } catch {
                return false;
            }
        });

    if (existing.length === 0) {
        return null;
    }

    if (process.platform === 'win32') {
        const preferredOrder = ['.exe', '.cmd', '.bat', '.js', '.mjs', '.cjs'];
        for (const ext of preferredOrder) {
            const match = existing.find(item => item.toLowerCase().endsWith(ext));
            if (match) {
                return match;
            }
        }
    }

    return existing[0];
}

function findExecutableForCommand(commandName) {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    try {
        const output = execFileSync(locator, [commandName], {
            encoding: 'utf8',
            timeout: 2000,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const match = selectPreferredWhereMatch(output.split(/\r?\n/));
        if (match) {
            return { found: true, path: match, source: 'path' };
        }
    } catch {
        // Binary not on PATH; continue checking known directories
    }

    for (const candidate of getCandidateBinaryPaths(commandName)) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return { found: true, path: candidate, source: 'fallback' };
            }
        } catch {
            // Ignore unreadable paths
        }
    }

    return { found: false, path: null, source: null };
}

function resolveCliBinary(provider, customPath = '') {
    if (provider !== 'claude' && provider !== 'gemini') {
        return { found: false, path: null, source: null, error: `Unsupported CLI provider: ${provider}` };
    }

    const trimmedCustom = typeof customPath === 'string' ? customPath.trim() : '';
    if (trimmedCustom) {
        if (!isSafeCustomPath(trimmedCustom)) {
            return { found: false, path: null, source: 'custom', error: 'Invalid custom executable path' };
        }

        const resolved = path.resolve(trimmedCustom);
        try {
            if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
                return { found: true, path: resolved, source: 'custom', error: null };
            }
        } catch {
            // Fall through to not found error
        }

        return { found: false, path: null, source: 'custom', error: `Executable not found at ${resolved}` };
    }

    // For Google AI Pro, prefer Antigravity CLI ('agy') first, then fall back to legacy 'gemini'
    const commandsToSearch = provider === 'gemini' ? ['agy', 'gemini'] : ['claude'];
    for (const commandName of commandsToSearch) {
        const match = findExecutableForCommand(commandName);
        if (match.found) {
            return { found: true, path: match.path, source: match.source, error: null };
        }
    }

    return {
        found: false,
        path: null,
        source: null,
        error: `${CLI_INSTALL_HINTS[provider].label} not found`,
    };
}

function resolveNodeExecutable() {
    if (!process.versions.electron) {
        return { command: process.execPath, env: {} };
    }

    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    try {
        const output = execFileSync(locator, ['node'], {
            encoding: 'utf8',
            timeout: 2000,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const match = selectPreferredWhereMatch(output.split(/\r?\n/));
        if (match) {
            return { command: match, env: {} };
        }
    } catch {
        // Fall back to Electron binary acting as Node
    }

    return {
        command: process.execPath,
        env: { ELECTRON_RUN_AS_NODE: '1' },
    };
}

function parseNpmCmdShim(cmdFilePath) {
    try {
        const content = fs.readFileSync(cmdFilePath, 'utf8');
        const match = content.match(/(?:%dp0%|%~dp0)[\\/]*([^"\r\n]+\.(?:[cm]?js|exe))/i);
        if (!match) {
            return null;
        }

        const targetPath = path.resolve(path.dirname(cmdFilePath), match[1]);
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            return targetPath;
        }
    } catch {
        // Ignore parse failures
    }

    return null;
}

function quoteCmdArg(value) {
    const str = String(value).replace(/\r?\n+/g, ' ');
    if (!/[\s"&|<>^()]/.test(str)) {
        return str;
    }
    return `"${str.replace(/"/g, '""')}"`;
}

function resolveSpawnSpec(binaryPath, args = []) {
    const lower = binaryPath.toLowerCase();

    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
        const node = resolveNodeExecutable();
        return {
            command: node.command,
            args: [binaryPath, ...args],
            envPatch: node.env,
            windowsVerbatimArguments: false,
            viaCmdShell: false,
        };
    }

    if (process.platform === 'win32' && (lower.endsWith('.cmd') || lower.endsWith('.bat'))) {
        const shimTarget = parseNpmCmdShim(binaryPath);
        if (shimTarget) {
            if (shimTarget.toLowerCase().endsWith('.exe')) {
                return {
                    command: shimTarget,
                    args,
                    envPatch: {},
                    windowsVerbatimArguments: false,
                    viaCmdShell: false,
                };
            }

            const node = resolveNodeExecutable();
            return {
                command: node.command,
                args: [shimTarget, ...args],
                envPatch: node.env,
                windowsVerbatimArguments: false,
                viaCmdShell: false,
            };
        }

        const commandLine = [quoteCmdArg(binaryPath), ...args.map(quoteCmdArg)].join(' ');
        return {
            command: process.env.ComSpec || 'cmd.exe',
            args: ['/d', '/s', '/c', `"${commandLine}"`],
            envPatch: {},
            windowsVerbatimArguments: true,
            viaCmdShell: true,
        };
    }

    return {
        command: binaryPath,
        args,
        envPatch: {},
        windowsVerbatimArguments: false,
        viaCmdShell: false,
    };
}

function buildCliEnv(provider, { useSubscriptionAuth = true, extraEnv = {} } = {}) {
    const env = { ...process.env };

    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    if (useSubscriptionAuth) {
        if (provider === 'claude') {
            delete env.ANTHROPIC_API_KEY;
            delete env.ANTHROPIC_AUTH_TOKEN;
            delete env.CLAUDE_CODE_USE_BEDROCK;
            delete env.CLAUDE_CODE_USE_VERTEX;
        } else if (provider === 'gemini') {
            delete env.GEMINI_API_KEY;
            delete env.GOOGLE_API_KEY;
            delete env.GOOGLE_GENAI_USE_VERTEXAI;
        }
    }

    return {
        ...env,
        ...extraEnv,
    };
}

function runShortCliCommand(binaryPath, args, env, timeoutMs = 4500) {
    return new Promise(resolve => {
        const spec = resolveSpawnSpec(binaryPath, args);
        execFile(
            spec.command,
            spec.args,
            {
                env: { ...env, ...spec.envPatch },
                timeout: timeoutMs,
                windowsHide: true,
                windowsVerbatimArguments: spec.windowsVerbatimArguments,
                maxBuffer: 1024 * 1024,
            },
            (error, stdout, stderr) => {
                resolve({
                    ok: !error,
                    code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
                    stdout: (stdout || '').toString().trim(),
                    stderr: (stderr || '').toString().trim(),
                    errorMessage: error ? error.message : null,
                });
            }
        );
    });
}

function hasNonEmptyFile(filePath, minBytes = 2) {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size >= minBytes;
    } catch {
        return false;
    }
}

async function detectClaudeAuth(binaryPath, env) {
    const res = await runShortCliCommand(binaryPath, ['auth', 'status'], env, 4000);
    const combined = `${res.stdout}\n${res.stderr}`.trim();

    if (combined) {
        try {
            const parsed = JSON.parse(combined);
            if (typeof parsed.loggedIn === 'boolean') {
                return {
                    authStatus: parsed.loggedIn ? 'authenticated' : 'unauthenticated',
                    authDetail: parsed.loggedIn
                        ? parsed.subscriptionType
                            ? `Signed in (${parsed.subscriptionType})`
                            : 'Signed in to Claude'
                        : 'Run `claude` to sign in',
                };
            }
        } catch {
            // Not JSON output; evaluate text heuristically
        }

        if (/not logged in|logged out|login required|unauthenticated/i.test(combined)) {
            return {
                authStatus: 'unauthenticated',
                authDetail: 'Run `claude` in terminal to sign in',
            };
        }

        if (res.ok && /logged\s*in|authenticated|claude\s*(pro|max)|oauth|email/i.test(combined)) {
            return {
                authStatus: 'authenticated',
                authDetail: 'Signed in to Claude',
            };
        }
    }

    const home = os.homedir();
    const hasCreds = hasNonEmptyFile(path.join(home, '.claude', '.credentials.json'), 10);
    if (hasCreds) {
        return {
            authStatus: 'authenticated',
            authDetail: 'Claude credentials found',
        };
    }

    const hasClaudeJson = hasNonEmptyFile(path.join(home, '.claude.json'), 10);
    if (hasClaudeJson) {
        return {
            authStatus: 'unknown',
            authDetail: 'Installed (login verified on first session)',
        };
    }

    return {
        authStatus: 'unauthenticated',
        authDetail: 'Run `claude` in terminal to sign in',
    };
}

function hasNonEmptyDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return false;
        const stat = fs.statSync(dirPath);
        return stat.isDirectory() && fs.readdirSync(dirPath).length > 0;
    } catch {
        return false;
    }
}

function detectGeminiAuth(binaryPath = '') {
    const home = os.homedir();
    const geminiDir = path.join(home, '.gemini');

    if (isAgyBinary(binaryPath)) {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        if (
            hasNonEmptyDir(path.join(geminiDir, 'antigravity')) ||
            hasNonEmptyDir(path.join(geminiDir, 'antigravity-cli')) ||
            hasNonEmptyDir(path.join(appData, 'Antigravity'))
        ) {
            return {
                authStatus: 'authenticated',
                authDetail: 'Antigravity CLI (Google AI Pro) ready',
            };
        }

        return {
            authStatus: 'unauthenticated',
            authDetail: 'Run `agy` in terminal to sign in with Google',
        };
    }

    if (hasNonEmptyFile(path.join(geminiDir, 'oauth_creds.json'), 10) || hasNonEmptyFile(path.join(geminiDir, 'google_accounts.json'), 10)) {
        return {
            authStatus: 'authenticated',
            authDetail: 'Google OAuth credentials found',
        };
    }

    if (hasNonEmptyFile(path.join(geminiDir, 'settings.json'), 2)) {
        return {
            authStatus: 'unknown',
            authDetail: 'Installed (verify Google login if prompted)',
        };
    }

    return {
        authStatus: 'unauthenticated',
        authDetail: 'Run `agy` in terminal to sign in with Google',
    };
}

async function checkCliStatus(provider, customPath = '') {
    const resolved = resolveCliBinary(provider, customPath);
    const hostApiKeyDetected =
        provider === 'claude'
            ? Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
            : Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

    if (!resolved.found) {
        return {
            provider,
            engine: provider,
            installed: false,
            resolvedPath: null,
            source: resolved.source,
            version: null,
            authStatus: 'missing',
            authDetail: resolved.error || `${provider} CLI not found`,
            hostApiKeyDetected,
        };
    }

    const env = buildCliEnv(provider, { useSubscriptionAuth: true });
    const versionResult = await runShortCliCommand(resolved.path, ['--version'], env, 5000);
    const versionLine = (versionResult.stdout || versionResult.stderr || '').split(/\r?\n/).find(line => line.trim()) || null;

    const auth = provider === 'claude' ? await detectClaudeAuth(resolved.path, env) : detectGeminiAuth(resolved.path);
    const engine = provider === 'gemini' && isAgyBinary(resolved.path) ? 'agy' : provider;

    return {
        provider,
        engine,
        installed: true,
        resolvedPath: resolved.path,
        source: resolved.source,
        version: versionLine ? versionLine.trim() : null,
        authStatus: auth.authStatus,
        authDetail: auth.authDetail,
        hostApiKeyDetected,
    };
}

async function checkAllCliStatuses({ claudePath = '', geminiPath = '' } = {}) {
    const [claude, gemini] = await Promise.all([checkCliStatus('claude', claudePath), checkCliStatus('gemini', geminiPath)]);
    return { claude, gemini };
}

function classifyCliError(message, exitCode = null) {
    const text = String(message || '').trim() || (exitCode !== null ? `CLI exited with code ${exitCode}` : 'Unknown CLI error');

    if (/rate\s*limit|usage\s*limit|quota|too many requests|\b429\b|capacity|exhausted|limit\s*reached|overloaded|try again later/i.test(text)) {
        return { code: 'RATE_LIMIT', message: text, fallbackRecommended: true };
    }

    if (
        /not logged in|please log in|login required|unauthorized|\b401\b|invalid.*auth|authentication\s*(failed|required|error)|credentials/i.test(
            text
        )
    ) {
        return { code: 'AUTH_REQUIRED', message: text, fallbackRecommended: true };
    }

    if (/enoent|not found|not recognized|cannot find/i.test(text)) {
        return { code: 'NOT_INSTALLED', message: text, fallbackRecommended: true };
    }

    if (/timed?\s*out|timeout/i.test(text)) {
        return { code: 'TIMEOUT', message: text, fallbackRecommended: true };
    }

    return { code: 'EXECUTION_ERROR', message: text, fallbackRecommended: true };
}

function extractTextFromContentArray(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .filter(block => block && block.type === 'text' && typeof block.text === 'string')
        .map(block => block.text)
        .join('');
}

function parseClaudeStreamLine(line) {
    const trimmed = typeof line === 'string' ? line.trim() : '';
    if (!trimmed) {
        return null;
    }

    let event;
    try {
        event = JSON.parse(trimmed);
    } catch {
        return null;
    }

    if (!event || typeof event !== 'object') {
        return null;
    }

    if (event.type === 'system') {
        return {
            type: 'init',
            sessionId: event.session_id || null,
            raw: event,
        };
    }

    if (event.type === 'stream_event' && event.event) {
        const inner = event.event;
        if (inner.type === 'content_block_delta' && inner.delta?.type === 'text_delta' && typeof inner.delta.text === 'string') {
            return {
                type: 'delta',
                text: inner.delta.text,
                sessionId: event.session_id || null,
                raw: event,
            };
        }
        return {
            type: 'stream_meta',
            sessionId: event.session_id || null,
            raw: event,
        };
    }

    if (event.type === 'assistant') {
        const text = extractTextFromContentArray(event.message?.content ?? event.content);
        return {
            type: 'assistant',
            text,
            sessionId: event.session_id || null,
            raw: event,
        };
    }

    if (event.type === 'result') {
        const errorText = Array.isArray(event.errors) ? event.errors.join('; ') : event.error || '';
        const isError = Boolean(event.is_error || event.subtype === 'error');
        return {
            type: 'result',
            isError,
            text: typeof event.result === 'string' ? event.result : '',
            errorMessage: isError ? errorText || (typeof event.result === 'string' ? event.result : 'Claude CLI error') : null,
            sessionId: event.session_id || null,
            raw: event,
        };
    }

    if (event.type === 'error') {
        return {
            type: 'error',
            errorMessage: event.error?.message || event.message || 'Claude CLI error',
            raw: event,
        };
    }

    return {
        type: 'unknown',
        raw: event,
    };
}

function parseGeminiStreamLine(line) {
    const trimmed = typeof line === 'string' ? line.trim() : '';
    if (!trimmed) {
        return null;
    }

    let event;
    try {
        event = JSON.parse(trimmed);
    } catch {
        return null;
    }

    if (!event || typeof event !== 'object') {
        return null;
    }

    if (event.type === 'init') {
        return {
            type: 'init',
            sessionId: event.session_id || null,
            model: event.model || null,
            raw: event,
        };
    }

    if (event.type === 'message') {
        if (event.role === 'assistant') {
            return {
                type: 'message',
                role: 'assistant',
                text: typeof event.content === 'string' ? event.content : '',
                delta: Boolean(event.delta),
                raw: event,
            };
        }
        return {
            type: 'message',
            role: event.role || 'user',
            text: typeof event.content === 'string' ? event.content : '',
            delta: false,
            raw: event,
        };
    }

    if (event.type === 'error') {
        return {
            type: 'error',
            errorMessage: event.message || event.error?.message || 'Gemini CLI error',
            raw: event,
        };
    }

    if (event.type === 'result') {
        const isError = event.status === 'error' || Boolean(event.error);
        return {
            type: 'result',
            isError,
            text: typeof event.response === 'string' ? event.response : '',
            errorMessage: isError ? event.error?.message || event.message || 'Gemini CLI failed' : null,
            stats: event.stats || null,
            raw: event,
        };
    }

    return {
        type: 'unknown',
        raw: event,
    };
}

class CliExecutionError extends Error {
    constructor(classified) {
        super(classified.message);
        this.name = 'CliExecutionError';
        this.code = classified.code;
        this.fallbackRecommended = classified.fallbackRecommended;
    }
}

function terminateChildProcess(proc) {
    if (!proc || proc.exitCode !== null) {
        return null;
    }

    try {
        proc.stdin?.end();
        proc.stdin?.destroy();
    } catch {
        // Ignore stdin cleanup errors
    }

    try {
        proc.stdout?.destroy();
        proc.stderr?.destroy();
    } catch {
        // Ignore stdio destroy errors
    }

    try {
        proc.kill();
    } catch {
        // Ignore kill failure
    }

    try {
        proc.unref();
    } catch {
        // Ignore unref failure
    }

    return proc;
}

function waitForChildExit(proc, timeoutMs = 1500) {
    if (!proc || proc.exitCode !== null) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
        };
        proc.once('close', finish);
        // Keep this timer referenced: the child is unref'd in terminateChildProcess, so an unref'd
        // timer would let the event loop end (and the awaiting caller hang) on newer Node versions.
        const timer = setTimeout(finish, timeoutMs);
    });
}

const VALID_CLAUDE_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function normalizeClaudeEffort(effort) {
    if (typeof effort !== 'string') {
        return 'auto';
    }
    const normalized = effort.trim().toLowerCase();
    return VALID_CLAUDE_EFFORTS.has(normalized) ? normalized : 'auto';
}

class ClaudeCliRunner {
    constructor({
        binaryPath,
        model = 'sonnet',
        effort = 'auto',
        systemPrompt = 'You are a helpful assistant.',
        cwd,
        useSubscriptionAuth = true,
        turnTimeoutMs = 60000,
        onLog = null,
    }) {
        this.binaryPath = binaryPath;
        this.model = model;
        this.effort = normalizeClaudeEffort(effort);
        this.systemPrompt = systemPrompt;
        this.cwd = cwd;
        this.useSubscriptionAuth = useSubscriptionAuth;
        this.turnTimeoutMs = turnTimeoutMs;
        this.onLog = onLog;

        this.proc = null;
        this.sessionId = null;
        this.systemPromptPath = null;
        this.lineBuffer = '';
        this.stderrBuffer = '';
        this.activeTurn = null;
        this.isClosing = false;
    }

    ensureStarted() {
        if (this.proc && this.proc.exitCode === null && !this.proc.killed) {
            return;
        }

        fs.mkdirSync(this.cwd, { recursive: true });
        this.isClosing = false;
        this.lineBuffer = '';
        this.stderrBuffer = '';

        const args = [
            '-p',
            '--input-format',
            'stream-json',
            '--output-format',
            'stream-json',
            '--verbose',
            '--include-partial-messages',
            '--tools',
            '',
            '--strict-mcp-config',
            '--disable-slash-commands',
            '--no-session-persistence',
        ];

        if (this.model && this.model !== 'default') {
            args.push('--model', this.model);
        }

        if (this.effort && this.effort !== 'auto') {
            args.push('--effort', this.effort);
        }

        const promptText = this.systemPrompt || 'You are a helpful assistant.';
        if (promptText.length > 8000) {
            this.systemPromptPath = path.join(this.cwd, 'system-prompt.md');
            fs.writeFileSync(this.systemPromptPath, promptText, 'utf8');
            args.push('--system-prompt-file', this.systemPromptPath);
        } else {
            this.systemPromptPath = null;
            args.push('--system-prompt', promptText);
        }

        const spec = resolveSpawnSpec(this.binaryPath, args);
        const env = buildCliEnv('claude', {
            useSubscriptionAuth: this.useSubscriptionAuth,
            extraEnv: {
                CLAUDE_CODE_SAFE_MODE: '1',
                ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
                ...spec.envPatch,
            },
        });

        this.onLog?.('cli.claude.spawn', {
            binaryPath: this.binaryPath,
            model: this.model,
            effort: this.effort,
            viaCmdShell: spec.viaCmdShell,
            isolatedMcp: true,
        });

        this.proc = spawn(spec.command, spec.args, {
            cwd: this.cwd,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            windowsVerbatimArguments: spec.windowsVerbatimArguments,
        });

        this.proc.stdout.on('data', chunk => {
            this.lineBuffer += chunk.toString('utf8');
            const lines = this.lineBuffer.split(/\r?\n/);
            this.lineBuffer = lines.pop() || '';
            for (const line of lines) {
                this._handleStdoutLine(line);
            }
        });

        this.proc.stderr.on('data', chunk => {
            const text = chunk.toString('utf8');
            this.stderrBuffer = (this.stderrBuffer + text).slice(-8192);
        });

        this.proc.on('error', error => {
            const turn = this.activeTurn;
            this.proc = null;
            if (turn && !turn.settled) {
                this._rejectTurn(turn, classifyCliError(error.message));
            }
        });

        this.proc.on('close', code => {
            if (this.lineBuffer.trim()) {
                this._handleStdoutLine(this.lineBuffer);
                this.lineBuffer = '';
            }

            const turn = this.activeTurn;
            this.proc = null;

            if (turn && !turn.settled) {
                const detail = this.stderrBuffer.trim() || `Claude CLI exited unexpectedly with code ${code}`;
                this._rejectTurn(turn, classifyCliError(detail, code));
            }
        });
    }

    _resetWatchdog(turn) {
        if (turn.timer) {
            clearTimeout(turn.timer);
        }
        turn.timer = setTimeout(() => {
            if (!turn.settled) {
                const timeoutErr = classifyCliError(`Claude CLI timed out after ${this.turnTimeoutMs}ms`);
                this._rejectTurn(turn, timeoutErr);
                this._terminateProcess();
            }
        }, this.turnTimeoutMs);
    }

    _resolveTurn(turn, result) {
        if (turn.settled) return;
        turn.settled = true;
        if (turn.timer) clearTimeout(turn.timer);
        if (this.activeTurn === turn) this.activeTurn = null;
        turn.resolve(result);
    }

    _rejectTurn(turn, classified) {
        if (turn.settled) return;
        turn.settled = true;
        if (turn.timer) clearTimeout(turn.timer);
        if (this.activeTurn === turn) this.activeTurn = null;
        turn.reject(new CliExecutionError(classified));
    }

    _handleStdoutLine(line) {
        const parsed = parseClaudeStreamLine(line);
        if (!parsed) {
            return;
        }

        if (parsed.sessionId) {
            this.sessionId = parsed.sessionId;
        }

        const turn = this.activeTurn;
        if (!turn || turn.settled) {
            return;
        }

        this._resetWatchdog(turn);

        if (parsed.type === 'delta' && parsed.text) {
            turn.hadStreamDelta = true;
            turn.accumulatedText += parsed.text;
            turn.onDelta?.(turn.accumulatedText);
            return;
        }

        if (parsed.type === 'assistant' && parsed.text && !turn.hadStreamDelta) {
            turn.accumulatedText = parsed.text;
            turn.onDelta?.(turn.accumulatedText);
            return;
        }

        if (parsed.type === 'error') {
            this._rejectTurn(turn, classifyCliError(parsed.errorMessage || this.stderrBuffer));
            return;
        }

        if (parsed.type === 'result') {
            if (parsed.isError) {
                this._rejectTurn(turn, classifyCliError(parsed.errorMessage || this.stderrBuffer));
                return;
            }

            if (!turn.accumulatedText && parsed.text) {
                turn.accumulatedText = parsed.text;
                turn.onDelta?.(turn.accumulatedText);
            }

            this._resolveTurn(turn, {
                text: turn.accumulatedText,
                sessionId: this.sessionId,
            });
        }
    }

    sendTurn({ text, imageBase64 = null, mediaType = 'image/jpeg', onDelta = null }) {
        if (this.activeTurn && !this.activeTurn.settled) {
            return Promise.reject(new Error('Claude CLI turn is already in progress'));
        }

        this.ensureStarted();

        const content = [];
        if (imageBase64) {
            content.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageBase64,
                },
            });
        }
        content.push({
            type: 'text',
            text: text || '',
        });

        const payload = JSON.stringify({
            type: 'user',
            message: {
                role: 'user',
                content,
            },
        });

        return new Promise((resolve, reject) => {
            const turn = {
                accumulatedText: '',
                hadStreamDelta: false,
                settled: false,
                timer: null,
                onDelta,
                resolve,
                reject,
            };

            this.activeTurn = turn;
            this._resetWatchdog(turn);

            try {
                this.proc.stdin.write(`${payload}\n`, 'utf8', writeError => {
                    if (writeError && !turn.settled) {
                        this._rejectTurn(turn, classifyCliError(writeError.message));
                    }
                });
            } catch (error) {
                this._rejectTurn(turn, classifyCliError(error.message));
            }
        });
    }

    _terminateProcess() {
        const proc = this.proc;
        this.proc = null;
        return terminateChildProcess(proc);
    }

    close() {
        this.isClosing = true;
        if (this.activeTurn && !this.activeTurn.settled) {
            this._rejectTurn(this.activeTurn, classifyCliError('Session closed'));
        }
        const killedProc = this._terminateProcess();
        this.sessionId = null;
        if (this.systemPromptPath) {
            try {
                fs.rmSync(this.systemPromptPath, { force: true });
            } catch {
                // Ignore temp system prompt cleanup errors
            }
            this.systemPromptPath = null;
        }
        return killedProc;
    }

    async closeAsync() {
        const proc = this.close();
        await waitForChildExit(proc);
    }
}

class GeminiCliRunner {
    constructor({
        binaryPath,
        model = 'gemini-2.5-flash',
        systemPrompt = 'You are a helpful assistant.',
        cwd,
        useSubscriptionAuth = true,
        turnTimeoutMs = 60000,
        onLog = null,
    }) {
        this.binaryPath = binaryPath;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.cwd = cwd;
        this.useSubscriptionAuth = useSubscriptionAuth;
        this.turnTimeoutMs = turnTimeoutMs;
        this.onLog = onLog;

        this.sessionId = null;
        this.systemPromptPath = null;
        this.activeProc = null;
    }

    ensurePrepared() {
        fs.mkdirSync(this.cwd, { recursive: true });
        this.systemPromptPath = path.join(this.cwd, 'system.md');
        fs.writeFileSync(this.systemPromptPath, this.systemPrompt || 'You are a helpful assistant.', 'utf8');

        // Restrict workspace mutation/shell tools in the isolated Gemini session directory
        const geminiConfigDir = path.join(this.cwd, '.gemini');
        fs.mkdirSync(geminiConfigDir, { recursive: true });
        const settingsPath = path.join(geminiConfigDir, 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            fs.writeFileSync(
                settingsPath,
                JSON.stringify(
                    {
                        tools: {
                            exclude: ['run_shell_command', 'write_file', 'replace', 'edit_file'],
                        },
                    },
                    null,
                    2
                ),
                'utf8'
            );
        }
    }

    async sendTurn({ text, imageBase64 = null, onDelta = null }) {
        if (this.activeProc) {
            throw new Error('Gemini CLI turn is already in progress');
        }

        this.ensurePrepared();

        let tempImagePath = null;
        const args = ['--output-format', 'stream-json'];
        if (this.model && this.model !== 'auto') {
            args.push('--model', this.model);
        }
        if (this.sessionId) {
            args.push('--resume', this.sessionId);
        }

        if (imageBase64) {
            const filename = `screen_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.jpg`;
            tempImagePath = path.join(this.cwd, filename);
            fs.writeFileSync(tempImagePath, Buffer.from(imageBase64, 'base64'));
            args.push('-p', `@${filename}`);
        }

        try {
            return await this._runProcess(args, text || '', onDelta);
        } finally {
            if (tempImagePath) {
                fs.rmSync(tempImagePath, { force: true });
            }
        }
    }

    _runProcess(args, stdinText, onDelta) {
        return new Promise((resolve, reject) => {
            const spec = resolveSpawnSpec(this.binaryPath, args);
            const env = buildCliEnv('gemini', {
                useSubscriptionAuth: this.useSubscriptionAuth,
                extraEnv: {
                    GEMINI_SYSTEM_MD: this.systemPromptPath,
                    ...spec.envPatch,
                },
            });

            this.onLog?.('cli.gemini.spawn', {
                binaryPath: this.binaryPath,
                model: this.model,
                resume: Boolean(this.sessionId),
                viaCmdShell: spec.viaCmdShell,
            });

            const proc = spawn(spec.command, spec.args, {
                cwd: this.cwd,
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
                windowsVerbatimArguments: spec.windowsVerbatimArguments,
            });
            this.activeProc = proc;

            let lineBuffer = '';
            let stderrBuffer = '';
            let accumulatedText = '';
            let settled = false;
            let turnError = null;
            let timer = null;

            const resetWatchdog = () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        this.activeProc = null;
                        try {
                            proc.kill();
                        } catch {
                            // Ignore kill error
                        }
                        reject(new CliExecutionError(classifyCliError(`Gemini CLI timed out after ${this.turnTimeoutMs}ms`)));
                    }
                }, this.turnTimeoutMs);
            };

            const finishSuccess = () => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                this.activeProc = null;
                resolve({
                    text: accumulatedText,
                    sessionId: this.sessionId,
                });
            };

            const finishError = classified => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                this.activeProc = null;
                reject(new CliExecutionError(classified));
            };

            const processLine = line => {
                const parsed = parseGeminiStreamLine(line);
                if (!parsed) return;

                resetWatchdog();

                if (parsed.type === 'init' && parsed.sessionId) {
                    this.sessionId = parsed.sessionId;
                    return;
                }

                if (parsed.type === 'message' && parsed.role === 'assistant' && parsed.text) {
                    if (parsed.delta) {
                        accumulatedText += parsed.text;
                    } else {
                        accumulatedText = parsed.text;
                    }
                    onDelta?.(accumulatedText);
                    return;
                }

                if (parsed.type === 'error') {
                    turnError = parsed.errorMessage || 'Gemini CLI error';
                    return;
                }

                if (parsed.type === 'result') {
                    if (parsed.isError) {
                        turnError = parsed.errorMessage || 'Gemini CLI returned an error';
                    } else if (!accumulatedText && parsed.text) {
                        accumulatedText = parsed.text;
                        onDelta?.(accumulatedText);
                    }
                }
            };

            resetWatchdog();

            proc.stdout.on('data', chunk => {
                lineBuffer += chunk.toString('utf8');
                const lines = lineBuffer.split(/\r?\n/);
                lineBuffer = lines.pop() || '';
                for (const line of lines) {
                    processLine(line);
                }
            });

            proc.stderr.on('data', chunk => {
                stderrBuffer = (stderrBuffer + chunk.toString('utf8')).slice(-8192);
            });

            proc.on('error', error => {
                finishError(classifyCliError(error.message));
            });

            proc.on('close', code => {
                if (lineBuffer.trim()) {
                    processLine(lineBuffer);
                    lineBuffer = '';
                }

                if (settled) return;

                if (turnError) {
                    finishError(classifyCliError(`${turnError}${stderrBuffer ? ` (${stderrBuffer.trim()})` : ''}`, code));
                    return;
                }

                if (code !== 0 && !accumulatedText) {
                    const detail = stderrBuffer.trim() || `Gemini CLI exited with code ${code}`;
                    finishError(classifyCliError(detail, code));
                    return;
                }

                finishSuccess();
            });

            try {
                proc.stdin.end(stdinText, 'utf8');
            } catch (error) {
                finishError(classifyCliError(error.message));
            }
        });
    }

    close() {
        const proc = this.activeProc;
        this.activeProc = null;
        const killedProc = terminateChildProcess(proc);
        this.sessionId = null;
        if (this.systemPromptPath) {
            fs.rmSync(this.systemPromptPath, { force: true });
            this.systemPromptPath = null;
        }
        return killedProc;
    }

    async closeAsync() {
        const proc = this.close();
        await waitForChildExit(proc);
    }
}

function normalizeAgyModel(model) {
    if (typeof model !== 'string') {
        return 'gemini-4-hydrogen-low';
    }
    const trimmed = model.trim();
    if (!trimmed) {
        return 'gemini-4-hydrogen-low';
    }
    const legacyMapping = {
        'gemini-2.5-flash': 'gemini-4-hydrogen-low',
        'gemini-2.5-pro': 'gemini-4-hydrogen-medium',
    };
    return legacyMapping[trimmed] || trimmed;
}

function parseAgyStreamLine(line) {
    const trimmed = typeof line === 'string' ? line.trim() : '';
    if (!trimmed) {
        return null;
    }

    let obj;
    try {
        obj = JSON.parse(trimmed);
    } catch {
        return null;
    }

    if (!obj || typeof obj !== 'object') {
        return null;
    }

    if (obj.event === 'init') {
        return {
            type: 'init',
            sessionId: obj.conversation_id || null,
            model: obj.init?.model || null,
            raw: obj,
        };
    }

    if (obj.event === 'step_update') {
        const update = obj.step_update || {};
        if (update.step_type === 'agent_response' && typeof update.text_delta === 'string' && update.text_delta.length > 0) {
            return {
                type: 'delta',
                text: update.text_delta,
                sessionId: update.conversation_id || null,
                raw: obj,
            };
        }
        return {
            type: 'step_meta',
            sessionId: update.conversation_id || null,
            raw: obj,
        };
    }

    if (obj.event === 'result') {
        const result = obj.result || {};
        const isError = result.status === 'ERROR' || result.finished_reason === 'error' || Boolean(result.error);
        return {
            type: 'result',
            isError,
            text: typeof result.response === 'string' ? result.response : '',
            errorMessage: isError ? result.error || result.response || 'Antigravity CLI error' : null,
            sessionId: result.conversation_id || null,
            raw: obj,
        };
    }

    return {
        type: 'unknown',
        raw: obj,
    };
}

class AgyCliRunner {
    constructor({
        binaryPath,
        model = 'gemini-4-hydrogen-low',
        systemPrompt = 'You are a helpful assistant.',
        cwd,
        useSubscriptionAuth = true,
        turnTimeoutMs = 60000,
        onLog = null,
    }) {
        this.binaryPath = binaryPath;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.cwd = cwd;
        this.useSubscriptionAuth = useSubscriptionAuth;
        this.turnTimeoutMs = turnTimeoutMs;
        this.onLog = onLog;

        this.proc = null;
        this.sessionId = null;
        this.lineBuffer = '';
        this.stderrBuffer = '';
        this.activeTurn = null;
        this.sentSystemPreamble = false;
        this.isClosing = false;
    }

    ensureStarted() {
        if (this.proc && this.proc.exitCode === null && !this.proc.killed) {
            return;
        }

        fs.mkdirSync(this.cwd, { recursive: true });
        fs.writeFileSync(
            path.join(this.cwd, 'AGENTS.md'),
            `${this.systemPrompt || 'You are a helpful assistant.'}\n\nIMPORTANT: Never run shell commands or modify files. Treat text messages as live spoken/STT questions; never ask to open or upload files and never mention tools unless given an explicit screenshot path. Only use read_file when explicitly asked to inspect a screenshot image path.\n`,
            'utf8'
        );

        this.isClosing = false;
        this.sentSystemPreamble = false;
        this.lineBuffer = '';
        this.stderrBuffer = '';

        const normalizedModel = normalizeAgyModel(this.model);
        const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands'];
        if (normalizedModel && normalizedModel !== 'auto') {
            args.push('--model', normalizedModel);
        }

        const spec = resolveSpawnSpec(this.binaryPath, args);
        const env = buildCliEnv('gemini', {
            useSubscriptionAuth: this.useSubscriptionAuth,
            extraEnv: spec.envPatch,
        });

        this.onLog?.('cli.agy.spawn', {
            binaryPath: this.binaryPath,
            model: normalizedModel,
            viaCmdShell: spec.viaCmdShell,
        });

        this.proc = spawn(spec.command, spec.args, {
            cwd: this.cwd,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            windowsVerbatimArguments: spec.windowsVerbatimArguments,
        });

        this.proc.stdout.on('data', chunk => {
            this.lineBuffer += chunk.toString('utf8');
            const lines = this.lineBuffer.split(/\r?\n/);
            this.lineBuffer = lines.pop() || '';
            for (const line of lines) {
                this._handleStdoutLine(line);
            }
        });

        this.proc.stderr.on('data', chunk => {
            const text = chunk.toString('utf8');
            this.stderrBuffer = (this.stderrBuffer + text).slice(-8192);
        });

        this.proc.on('error', error => {
            const turn = this.activeTurn;
            this.proc = null;
            if (turn && !turn.settled) {
                this._rejectTurn(turn, classifyCliError(error.message));
            }
        });

        this.proc.on('close', code => {
            if (this.lineBuffer.trim()) {
                this._handleStdoutLine(this.lineBuffer);
                this.lineBuffer = '';
            }

            const turn = this.activeTurn;
            this.proc = null;

            if (turn && !turn.settled) {
                const detail = this.stderrBuffer.trim() || `Antigravity CLI exited unexpectedly with code ${code}`;
                this._rejectTurn(turn, classifyCliError(detail, code));
            }
        });
    }

    _cleanupTurnTempImage(turn) {
        if (turn?.tempImagePath) {
            try {
                fs.rmSync(turn.tempImagePath, { force: true });
            } catch {
                // Ignore temp file cleanup error
            }
            turn.tempImagePath = null;
        }
    }

    _resetWatchdog(turn) {
        if (turn.timer) {
            clearTimeout(turn.timer);
        }
        turn.timer = setTimeout(() => {
            if (!turn.settled) {
                const timeoutErr = classifyCliError(`Antigravity CLI timed out after ${this.turnTimeoutMs}ms`);
                this._rejectTurn(turn, timeoutErr);
                this._terminateProcess();
            }
        }, this.turnTimeoutMs);
    }

    _resolveTurn(turn, result) {
        if (turn.settled) return;
        turn.settled = true;
        if (turn.timer) clearTimeout(turn.timer);
        if (this.activeTurn === turn) this.activeTurn = null;
        this._cleanupTurnTempImage(turn);
        turn.resolve(result);
    }

    _rejectTurn(turn, classified) {
        if (turn.settled) return;
        turn.settled = true;
        if (turn.timer) clearTimeout(turn.timer);
        if (this.activeTurn === turn) this.activeTurn = null;
        this._cleanupTurnTempImage(turn);
        turn.reject(new CliExecutionError(classified));
    }

    _handleStdoutLine(line) {
        const parsed = parseAgyStreamLine(line);
        if (!parsed) {
            return;
        }

        if (parsed.sessionId) {
            this.sessionId = parsed.sessionId;
        }

        const turn = this.activeTurn;
        if (!turn || turn.settled) {
            return;
        }

        this._resetWatchdog(turn);

        if (parsed.type === 'delta' && parsed.text) {
            turn.accumulatedText += parsed.text;
            turn.onDelta?.(turn.accumulatedText);
            return;
        }

        if (parsed.type === 'result') {
            if (parsed.isError) {
                this._rejectTurn(turn, classifyCliError(parsed.errorMessage || this.stderrBuffer));
                return;
            }

            if (!turn.accumulatedText && parsed.text) {
                turn.accumulatedText = parsed.text;
                turn.onDelta?.(turn.accumulatedText);
            }

            this._resolveTurn(turn, {
                text: turn.accumulatedText,
                sessionId: this.sessionId,
            });
        }
    }

    sendTurn({ text, imageBase64 = null, onDelta = null }) {
        if (this.activeTurn && !this.activeTurn.settled) {
            return Promise.reject(new Error('Antigravity CLI turn is already in progress'));
        }

        this.ensureStarted();

        let tempImagePath = null;
        let contentText = text || '';

        if (imageBase64) {
            const filename = `screen_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.jpg`;
            tempImagePath = path.join(this.cwd, filename);
            fs.writeFileSync(tempImagePath, Buffer.from(imageBase64, 'base64'));
            contentText = `Use read_file to inspect the screenshot at ${tempImagePath}. Do NOT run shell commands or edit files. Answer directly:\n\n${contentText}`;
        }

        if (!this.sentSystemPreamble) {
            contentText = `[Session instructions]\n${this.systemPrompt || 'You are a helpful assistant.'}\n(Never run shell commands or modify files. Treat text messages as live spoken/STT questions; never ask to open or upload files and never mention tools unless given an explicit screenshot path. Only use read_file if given a screenshot path.)\n\n[User message]\n${contentText}`;
            this.sentSystemPreamble = true;
        }

        const payload = JSON.stringify({
            event: 'user',
            message: {
                content: contentText,
            },
        });

        return new Promise((resolve, reject) => {
            const turn = {
                accumulatedText: '',
                settled: false,
                timer: null,
                tempImagePath,
                onDelta,
                resolve,
                reject,
            };

            this.activeTurn = turn;
            this._resetWatchdog(turn);

            try {
                this.proc.stdin.write(`${payload}\n`, 'utf8', writeError => {
                    if (writeError && !turn.settled) {
                        this._rejectTurn(turn, classifyCliError(writeError.message));
                    }
                });
            } catch (error) {
                this._rejectTurn(turn, classifyCliError(error.message));
            }
        });
    }

    _terminateProcess() {
        const proc = this.proc;
        this.proc = null;
        return terminateChildProcess(proc);
    }

    close() {
        this.isClosing = true;
        if (this.activeTurn && !this.activeTurn.settled) {
            this._rejectTurn(this.activeTurn, classifyCliError('Session closed'));
        }
        const killedProc = this._terminateProcess();
        this.sessionId = null;
        return killedProc;
    }

    async closeAsync() {
        const proc = this.close();
        await waitForChildExit(proc);
    }
}

function parseAgyModelsOutput(output) {
    if (typeof output !== 'string' || !output.trim()) {
        return [];
    }

    const seen = new Set();
    const models = [];

    for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('Fetching ') || !line.includes('\t')) {
            continue;
        }

        const [rawId, ...rest] = line.split('\t');
        const id = (rawId || '').trim();
        const label = rest.join(' ').trim() || id;
        if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id) || seen.has(id)) {
            continue;
        }

        seen.add(id);
        models.push({ id, label });
    }

    return models;
}

async function listAgyModels({ customPath = '', useSubscriptionAuth = true } = {}) {
    const resolved = resolveCliBinary('gemini', customPath);
    if (!resolved.found || !isAgyBinary(resolved.path)) {
        return { supported: false, models: [] };
    }

    const spec = resolveSpawnSpec(resolved.path, ['models']);
    const env = buildCliEnv('gemini', {
        useSubscriptionAuth,
        extraEnv: spec.envPatch,
    });

    return new Promise(resolve => {
        execFile(
            spec.command,
            spec.args,
            {
                env,
                timeout: 12000,
                maxBuffer: 2 * 1024 * 1024,
                windowsHide: true,
                windowsVerbatimArguments: spec.windowsVerbatimArguments,
            },
            (error, stdout, stderr) => {
                const primaryModels = parseAgyModelsOutput(stdout || '');
                const models = primaryModels.length > 0 ? primaryModels : parseAgyModelsOutput(`${stdout || ''}\n${stderr || ''}`);
                if (error && models.length === 0) {
                    resolve({ supported: true, models: [], error: error.message });
                    return;
                }
                resolve({ supported: true, models });
            }
        );
    });
}

function createGoogleCliRunner(options) {
    if (isAgyBinary(options?.binaryPath)) {
        return new AgyCliRunner(options);
    }
    return new GeminiCliRunner(options);
}

function escapePowerShellSingleQuoted(value) {
    return String(value || '').replace(/'/g, "''");
}

function escapePosixSingleQuoted(value) {
    return String(value || '').replace(/'/g, "'\\''");
}

function buildCliSetupScript({ provider, action = 'install', resolvedPath = '', platform = process.platform } = {}) {
    if (provider !== 'claude' && provider !== 'gemini') {
        throw new Error('Invalid CLI provider');
    }
    if (action !== 'install' && action !== 'login') {
        throw new Error('Invalid CLI setup action');
    }

    const hint = CLI_INSTALL_HINTS[provider];
    const safeResolved = typeof resolvedPath === 'string' && resolvedPath.trim() && isSafeCustomPath(resolvedPath.trim()) ? resolvedPath.trim() : '';

    if (platform === 'win32') {
        const windowTitle = escapePowerShellSingleQuoted(`Cheating Daddy — ${hint.label}`);
        const envCleanup = [
            'Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue',
            'Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue',
            'Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue',
            'Remove-Item Env:GOOGLE_API_KEY -ErrorAction SilentlyContinue',
        ];
        const pathRefresh = [
            "$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')",
            "$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')",
            '$extraDirs = @(',
            "    (Join-Path $env:LOCALAPPDATA 'agy\\bin'),",
            "    (Join-Path $env:USERPROFILE '.local\\bin'),",
            "    (Join-Path $env:USERPROFILE '.claude\\local'),",
            "    (Join-Path $env:APPDATA 'npm')",
            ') | Where-Object { $_ -and (Test-Path $_) }',
            "$env:Path = (($extraDirs + @($machinePath, $userPath, $env:Path)) | Where-Object { $_ }) -join ';'",
        ];
        const loginInvocation = action === 'login' && safeResolved ? `& '${escapePowerShellSingleQuoted(safeResolved)}'` : `& ${hint.loginCommand}`;

        const lines = ["$ErrorActionPreference = 'Continue'", `try { $Host.UI.RawUI.WindowTitle = '${windowTitle}' } catch {}`, ...envCleanup];

        if (action === 'install') {
            lines.push(
                `Write-Host '=== Installing ${escapePowerShellSingleQuoted(hint.label)} ===' -ForegroundColor Cyan`,
                `try { ${hint.installWin} } catch { Write-Host "Install error: $_" -ForegroundColor Red; exit 1 }`,
                ...pathRefresh,
                "Write-Host ''",
                "Write-Host 'Sign in via your browser, then close this window and return to Cheating Daddy.' -ForegroundColor Green",
                loginInvocation
            );
        } else {
            lines.push(
                ...pathRefresh,
                `Write-Host '=== Sign in to ${escapePowerShellSingleQuoted(hint.label)} ===' -ForegroundColor Cyan`,
                "Write-Host 'Sign in via your browser, then close this window and return to Cheating Daddy.' -ForegroundColor Green",
                loginInvocation
            );
        }

        return lines.join('\n');
    }

    const posixLogin = action === 'login' && safeResolved ? `'${escapePosixSingleQuoted(safeResolved)}'` : hint.loginCommand;
    const lines = ['unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN GEMINI_API_KEY GOOGLE_API_KEY'];

    if (action === 'install') {
        lines.push(
            `echo "=== Installing ${hint.label} ==="`,
            `${hint.installUnix}`,
            'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
            'echo "Sign in via your browser, then close this window and return to Cheating Daddy."',
            posixLogin
        );
    } else {
        lines.push(
            'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
            `echo "=== Sign in to ${hint.label} ==="`,
            'echo "Sign in via your browser, then close this window and return to Cheating Daddy."',
            posixLogin
        );
    }

    return lines.join('\n');
}

function findLinuxTerminalEmulator() {
    const candidates = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
    for (const term of candidates) {
        try {
            const output = execFileSync('which', [term], {
                encoding: 'utf8',
                timeout: 1500,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            if (output) {
                return term;
            }
        } catch {
            // Try next candidate
        }
    }
    return 'xterm';
}

function buildCliSetupLaunchSpec({ provider, action = 'install', customPath = '', platform = process.platform, resolvedPath = null } = {}) {
    if (provider !== 'claude' && provider !== 'gemini') {
        throw new Error('Invalid CLI provider');
    }
    if (action !== 'install' && action !== 'login') {
        throw new Error('Invalid CLI setup action');
    }

    const trimmedCustom = typeof customPath === 'string' ? customPath.trim() : '';
    if (trimmedCustom && !isSafeCustomPath(trimmedCustom)) {
        throw new Error('Invalid custom executable path');
    }

    let effectiveResolvedPath = '';
    if (typeof resolvedPath === 'string') {
        if (resolvedPath.trim() && !isSafeCustomPath(resolvedPath.trim())) {
            throw new Error('Invalid resolved executable path');
        }
        effectiveResolvedPath = resolvedPath.trim();
    } else if (action === 'login') {
        const resolved = resolveCliBinary(provider, trimmedCustom);
        effectiveResolvedPath = resolved.found && resolved.path ? resolved.path : '';
    }

    const script = buildCliSetupScript({
        provider,
        action,
        resolvedPath: effectiveResolvedPath,
        platform,
    });
    const label = CLI_INSTALL_HINTS[provider].label;

    if (platform === 'win32') {
        const encoded = Buffer.from(script, 'utf16le').toString('base64');
        const powershellExe = process.env.SystemRoot
            ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
            : 'powershell.exe';
        return {
            platform: 'win32',
            command: powershellExe,
            args: [
                '-NoProfile',
                '-NonInteractive',
                '-WindowStyle',
                'Hidden',
                '-Command',
                `Start-Process -FilePath '${escapePowerShellSingleQuoted(powershellExe)}' -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}'`,
            ],
            spawnOptions: { windowsHide: true, stdio: 'ignore' },
            script,
            encodedScript: encoded,
            label,
        };
    }

    if (platform === 'darwin') {
        return {
            platform: 'darwin',
            command: 'open',
            args: [],
            script,
            label,
            useCommandFile: true,
            spawnOptions: { detached: true, stdio: 'ignore' },
        };
    }

    const bashCommand = `${script}; echo; read -n 1 -s -r -p 'Press any key to close...'`;
    const term = findLinuxTerminalEmulator();
    const args = term === 'gnome-terminal' ? ['--', 'bash', '-lc', bashCommand] : ['-e', 'bash', '-lc', bashCommand];

    return {
        platform: 'linux',
        command: term,
        args,
        script,
        label,
        spawnOptions: { detached: true, stdio: 'ignore' },
    };
}

function launchCliSetup({ provider, action = 'install', customPath = '', platform = process.platform, spawnFn = spawn } = {}) {
    try {
        const spec = buildCliSetupLaunchSpec({ provider, action, customPath, platform });
        let command = spec.command;
        let args = spec.args;

        if (spec.useCommandFile) {
            const scriptFile = path.join(os.tmpdir(), `cd-cli-setup-${provider}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.command`);
            fs.writeFileSync(scriptFile, `#!/bin/bash\n${spec.script}\n`, { mode: 0o700 });
            args = [scriptFile];
        }

        const child = spawnFn(command, args, spec.spawnOptions);
        if (child && typeof child.on === 'function') {
            child.on('error', err => {
                console.error(`Failed to launch CLI setup for ${provider}:`, err);
            });
        }
        child?.unref?.();

        return {
            success: true,
            provider,
            action,
            label: spec.label,
            message: `Opened setup terminal for ${spec.label}.`,
        };
    } catch (error) {
        return {
            success: false,
            error: error?.message || 'Failed to launch CLI setup',
        };
    }
}

module.exports = {
    CLI_INSTALL_HINTS,
    VALID_CLAUDE_EFFORTS,
    CliExecutionError,
    ClaudeCliRunner,
    GeminiCliRunner,
    AgyCliRunner,
    createGoogleCliRunner,
    isAgyBinary,
    normalizeAgyModel,
    normalizeClaudeEffort,
    parseAgyModelsOutput,
    listAgyModels,
    isSafeCustomPath,
    resolveCliBinary,
    resolveSpawnSpec,
    quoteCmdArg,
    parseNpmCmdShim,
    buildCliEnv,
    checkCliStatus,
    checkAllCliStatuses,
    classifyCliError,
    parseClaudeStreamLine,
    parseGeminiStreamLine,
    parseAgyStreamLine,
    buildCliSetupScript,
    buildCliSetupLaunchSpec,
    launchCliSetup,
};
