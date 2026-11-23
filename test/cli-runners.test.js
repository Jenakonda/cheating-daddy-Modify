const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    AgyCliRunner,
    ClaudeCliRunner,
    GeminiCliRunner,
    buildCliEnv,
    classifyCliError,
    isAgyBinary,
    normalizeAgyModel,
    normalizeClaudeEffort,
    parseAgyModelsOutput,
    parseAgyStreamLine,
    parseClaudeStreamLine,
    parseGeminiStreamLine,
    parseNpmCmdShim,
    quoteCmdArg,
    resolveCliBinary,
    resolveSpawnSpec,
} = require('../src/utils/cli-runners');
const { createCliSessionManager } = require('../src/utils/cliai');
const { getSystemPrompt, profilePrompts } = require('../src/utils/prompts');

function createMockScripts(tmpDir) {
    const mockClaudePath = path.join(tmpDir, 'mock-claude.js');
    const mockGeminiPath = path.join(tmpDir, 'mock-gemini.js');
    const mockAgyPath = path.join(tmpDir, 'mock-agy.js');

    fs.writeFileSync(
        mockClaudePath,
        `
const readline = require('readline');

const effortArgIndex = process.argv.indexOf('--effort');
const cliEffortArg = effortArgIndex !== -1 && process.argv[effortArgIndex + 1] ? process.argv[effortArgIndex + 1] : null;

let turnCount = 0;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-sess-1' }) + '\\n');

rl.on('line', line => {
    if (!line.trim()) return;
    let msg;
    try {
        msg = JSON.parse(line);
    } catch {
        return;
    }

    turnCount += 1;
    const blocks = Array.isArray(msg.message?.content) ? msg.message.content : [];
    const textParts = blocks.filter(b => b.type === 'text').map(b => b.text).join(' ');
    const imgBlock = blocks.find(b => b.type === 'image');

    if (textParts.includes('TRIGGER_RATE_LIMIT')) {
        const currentPart = textParts.includes('[Current message]:')
            ? textParts.split('[Current message]:').pop()
            : textParts;
        if (currentPart.includes('TRIGGER_RATE_LIMIT')) {
            process.stdout.write(JSON.stringify({
                type: 'result',
                subtype: 'error',
                is_error: true,
                errors: ['429 Rate limit reached for Claude Pro subscription']
            }) + '\\n');
            return;
        }
    }

    const effortPart = cliEffortArg ? \`,effort=\${cliEffortArg}\` : '';
    const prefix = \`Claude(pid=\${process.pid},turn=\${turnCount}\${effortPart}): \`;
    const suffix = \`\${textParts}\${imgBlock ? '+IMG(' + imgBlock.source.data.length + ')' : ''}\`;

    process.stdout.write(JSON.stringify({
        type: 'stream_event',
        session_id: 'claude-sess-1',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: prefix } }
    }) + '\\n');
    process.stdout.write(JSON.stringify({
        type: 'stream_event',
        session_id: 'claude-sess-1',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: suffix } }
    }) + '\\n');
    process.stdout.write(JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'claude-sess-1',
        result: prefix + suffix
    }) + '\\n');
});
`,
        'utf8'
    );

    fs.writeFileSync(
        mockGeminiPath,
        `
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let resumeId = '';
let promptArg = '';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--resume' && args[i + 1]) resumeId = args[i + 1];
    if (args[i] === '-p' && args[i + 1]) promptArg = args[i + 1];
}

let stdinText = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { stdinText += chunk; });
process.stdin.on('end', () => {
    if (stdinText.includes('TRIGGER_GEMINI_AUTH_ERROR')) {
        process.stdout.write(JSON.stringify({ type: 'error', message: 'Login required: please authenticate' }) + '\\n');
        process.exit(1);
        return;
    }

    const sysMdPath = process.env.GEMINI_SYSTEM_MD;
    const hasSysMd = Boolean(sysMdPath && fs.existsSync(sysMdPath));
    let imageExistsDuringRun = false;
    if (promptArg.startsWith('@')) {
        const imgPath = path.join(process.cwd(), promptArg.slice(1));
        imageExistsDuringRun = fs.existsSync(imgPath);
    }

    process.stdout.write(JSON.stringify({ type: 'init', session_id: 'gem-sess-42', model: 'gemini-2.5-flash' }) + '\\n');
    process.stdout.write(JSON.stringify({
        type: 'message',
        role: 'assistant',
        delta: true,
        content: \`Gemini(sys=\${hasSysMd},resume=\${resumeId || 'none'},img=\${imageExistsDuringRun}): \`
    }) + '\\n');
    process.stdout.write(JSON.stringify({
        type: 'message',
        role: 'assistant',
        delta: true,
        content: stdinText.trim()
    }) + '\\n');
    process.stdout.write(JSON.stringify({ type: 'result', status: 'success' }) + '\\n');
});
`,
        'utf8'
    );

    fs.writeFileSync(
        mockAgyPath,
        `
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const effortArgIndex = process.argv.indexOf('--effort');
const cliEffortArg = effortArgIndex !== -1 && process.argv[effortArgIndex + 1] ? process.argv[effortArgIndex + 1] : null;

let turnCount = 0;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const hasAgentsMd = fs.existsSync(path.join(process.cwd(), 'AGENTS.md'));

process.stdout.write(JSON.stringify({
    event: 'init',
    conversation_id: 'agy-conv-99',
    init: { cwd: process.cwd(), model: 'gemini-3.8-flash-low' }
}) + '\\n');

rl.on('line', line => {
    if (!line.trim()) return;
    let msg;
    try {
        msg = JSON.parse(line);
    } catch {
        return;
    }

    if (msg.event !== 'user') {
        process.stderr.write(\`warning: ignoring unsupported stream input message event "\${msg.event}"\\n\`);
        return;
    }

    turnCount += 1;
    const content = String(msg.message?.content || '');
    const matchImg = content.match(/inspect the screenshot at ([^\\s]+\\.jpg)/i);
    const imgExists = Boolean(matchImg && fs.existsSync(matchImg[1]));

    const prefix = \`Agy(pid=\${process.pid},turn=\${turnCount},agents=\${hasAgentsMd},img=\${imgExists}): \`;
    process.stdout.write(JSON.stringify({
        event: 'step_update',
        step_update: {
            conversation_id: 'agy-conv-99',
            step_index: turnCount * 2 - 1,
            state: 'ACTIVE',
            step_type: 'agent_response',
            text_delta: prefix
        }
    }) + '\\n');
    process.stdout.write(JSON.stringify({
        event: 'step_update',
        step_update: {
            conversation_id: 'agy-conv-99',
            step_index: turnCount * 2 - 1,
            state: 'DONE',
            step_type: 'agent_response',
            text_delta: content
        }
    }) + '\\n');
    process.stdout.write(JSON.stringify({
        event: 'result',
        result: {
            conversation_id: 'agy-conv-99',
            status: 'SUCCESS',
            response: prefix + content
        }
    }) + '\\n');
});
`,
        'utf8'
    );

    return { mockClaudePath, mockGeminiPath, mockAgyPath };
}

test('buildCliEnv strips API keys in subscription mode and strips CLAUDECODE', () => {
    const prev = {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        CLAUDECODE: process.env.CLAUDECODE,
    };

    try {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
        process.env.GEMINI_API_KEY = 'AIza-test';
        process.env.GOOGLE_API_KEY = 'AIza-google';
        process.env.CLAUDECODE = '1';

        const claudeSubEnv = buildCliEnv('claude', { useSubscriptionAuth: true });
        assert.equal(claudeSubEnv.ANTHROPIC_API_KEY, undefined);
        assert.equal(claudeSubEnv.CLAUDECODE, undefined);

        const geminiSubEnv = buildCliEnv('gemini', { useSubscriptionAuth: true });
        assert.equal(geminiSubEnv.GEMINI_API_KEY, undefined);
        assert.equal(geminiSubEnv.GOOGLE_API_KEY, undefined);

        const claudeApiEnv = buildCliEnv('claude', { useSubscriptionAuth: false });
        assert.equal(claudeApiEnv.ANTHROPIC_API_KEY, 'sk-ant-test');
        assert.equal(claudeApiEnv.CLAUDECODE, undefined);
    } finally {
        for (const [k, v] of Object.entries(prev)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
});

test('stream line parsers and error classification handle expected payloads', () => {
    const delta = parseClaudeStreamLine(
        JSON.stringify({
            type: 'stream_event',
            session_id: 's1',
            event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
        })
    );
    assert.equal(delta.type, 'delta');
    assert.equal(delta.text, 'hello');

    const gemDelta = parseGeminiStreamLine(
        JSON.stringify({
            type: 'message',
            role: 'assistant',
            delta: true,
            content: 'world',
        })
    );
    assert.equal(gemDelta.type, 'message');
    assert.equal(gemDelta.delta, true);
    assert.equal(gemDelta.text, 'world');

    assert.equal(parseClaudeStreamLine('not json'), null);
    assert.equal(parseGeminiStreamLine(''), null);

    assert.equal(classifyCliError('HTTP 429 rate limit exceeded').code, 'RATE_LIMIT');
    assert.equal(classifyCliError('Not logged in, please authenticate').code, 'AUTH_REQUIRED');
    assert.equal(classifyCliError('spawn claude ENOENT').code, 'NOT_INSTALLED');
    assert.equal(classifyCliError('Claude CLI timed out after 60000ms').code, 'TIMEOUT');

    assert.equal(isAgyBinary('C:\\Users\\demo\\AppData\\Local\\agy\\bin\\agy.exe'), true);
    assert.equal(isAgyBinary('/usr/local/bin/agy'), true);
    assert.equal(isAgyBinary('C:\\Users\\demo\\AppData\\Roaming\\npm\\gemini.cmd'), false);

    assert.equal(normalizeAgyModel(''), 'gemini-4-hydrogen-low');
    assert.equal(normalizeAgyModel('gemini-2.5-flash'), 'gemini-4-hydrogen-low');
    assert.equal(normalizeAgyModel('gemini-2.5-pro'), 'gemini-4-hydrogen-medium');
    assert.equal(normalizeAgyModel('gemini-4-hydrogen-high'), 'gemini-4-hydrogen-high');

    assert.equal(normalizeClaudeEffort('LOW'), 'low');
    assert.equal(normalizeClaudeEffort('max'), 'max');
    assert.equal(normalizeClaudeEffort('xhigh'), 'xhigh');
    assert.equal(normalizeClaudeEffort('invalid'), 'auto');
    assert.equal(normalizeClaudeEffort(''), 'auto');

    const parsedModels = parseAgyModelsOutput(
        [
            'Fetching available models...',
            '',
            'gemini-4-hydrogen-low\tGemini 4 Hydrogen (Low)',
            'gemini-4-hydrogen-low\tDuplicate entry',
            'claude-opus-5-5-high\tClaude Opus 5.5 (High)',
            'not a tab line',
        ].join('\n')
    );
    assert.deepEqual(parsedModels, [
        { id: 'gemini-4-hydrogen-low', label: 'Gemini 4 Hydrogen (Low)' },
        { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)' },
    ]);

    const agyDelta = parseAgyStreamLine(
        JSON.stringify({
            event: 'step_update',
            step_update: { conversation_id: 'c1', step_type: 'agent_response', text_delta: 'PONG' },
        })
    );
    assert.equal(agyDelta.type, 'delta');
    assert.equal(agyDelta.text, 'PONG');

    const agyResult = parseAgyStreamLine(
        JSON.stringify({
            event: 'result',
            result: { conversation_id: 'c1', status: 'ERROR', error: 'quota exceeded' },
        })
    );
    assert.equal(agyResult.type, 'result');
    assert.equal(agyResult.isError, true);
    assert.equal(agyResult.errorMessage, 'quota exceeded');
});

test('parseNpmCmdShim and resolveSpawnSpec resolve Windows .cmd npm wrappers directly to node without cmd.exe', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-shim-test-'));
    try {
        const targetDir = path.join(tmpDir, 'node_modules', '@google', 'gemini-cli', 'dist');
        fs.mkdirSync(targetDir, { recursive: true });
        const targetJs = path.join(targetDir, 'index.js');
        fs.writeFileSync(targetJs, 'console.log("ok");', 'utf8');

        const cmdPath = path.join(tmpDir, 'gemini.cmd');
        fs.writeFileSync(cmdPath, '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\@google\\gemini-cli\\dist\\index.js" %*\r\n', 'utf8');

        const parsed = parseNpmCmdShim(cmdPath);
        assert.equal(parsed, targetJs);

        if (process.platform === 'win32') {
            const spec = resolveSpawnSpec(cmdPath, ['--output-format', 'stream-json']);
            assert.equal(spec.viaCmdShell, false);
            assert.equal(spec.args[0], targetJs);
            assert.deepEqual(spec.args.slice(1), ['--output-format', 'stream-json']);
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('ClaudeCliRunner keeps persistent subprocess across multi-turn text and base64 screenshot', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-claude-runner-'));
    let runner = null;
    try {
        const { mockClaudePath } = createMockScripts(tmpDir);
        const cwd = path.join(tmpDir, 'session-claude');

        runner = new ClaudeCliRunner({
            binaryPath: mockClaudePath,
            model: 'sonnet',
            systemPrompt: 'Be concise.',
            cwd,
            useSubscriptionAuth: true,
        });

        const deltas1 = [];
        const res1 = await runner.sendTurn({
            text: 'First question',
            onDelta: text => deltas1.push(text),
        });
        assert.match(res1.text, /^Claude\(pid=\d+,turn=1\): First question$/);
        assert.ok(deltas1.length >= 2);

        const pidMatch1 = res1.text.match(/pid=(\d+)/);
        const imgBase64 = Buffer.from('fake-jpeg-bytes').toString('base64');
        const res2 = await runner.sendTurn({
            text: 'Analyze screen',
            imageBase64: imgBase64,
        });
        const pidMatch2 = res2.text.match(/pid=(\d+)/);

        assert.equal(pidMatch2[1], pidMatch1[1], 'Expected persistent PID across turns');
        assert.ok(res2.text.includes('turn=2'));
        assert.ok(res2.text.includes(`+IMG(${imgBase64.length})`));
    } finally {
        await runner?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('ClaudeCliRunner passes --effort when non-auto and omits it for auto', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-claude-effort-'));
    let runnerAuto = null;
    let runnerHigh = null;
    try {
        const { mockClaudePath } = createMockScripts(tmpDir);
        const cwd = path.join(tmpDir, 'session-effort');

        runnerAuto = new ClaudeCliRunner({
            binaryPath: mockClaudePath,
            model: 'sonnet',
            effort: 'auto',
            cwd,
        });
        const autoRes = await runnerAuto.sendTurn({ text: 'ping' });
        assert.equal(autoRes.text.includes('effort='), false);

        runnerHigh = new ClaudeCliRunner({
            binaryPath: mockClaudePath,
            model: 'opus',
            effort: 'high',
            cwd,
        });
        const highRes = await runnerHigh.sendTurn({ text: 'ping' });
        assert.equal(highRes.text.includes('effort=high'), true);
    } finally {
        await runnerAuto?.closeAsync();
        await runnerHigh?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('GeminiCliRunner uses GEMINI_SYSTEM_MD, --resume on turn 2, and cleans up temp screenshot file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-gemini-runner-'));
    let runner = null;
    try {
        const { mockGeminiPath } = createMockScripts(tmpDir);
        const cwd = path.join(tmpDir, 'session-gemini');

        runner = new GeminiCliRunner({
            binaryPath: mockGeminiPath,
            model: 'gemini-2.5-flash',
            systemPrompt: 'Custom system prompt',
            cwd,
            useSubscriptionAuth: true,
        });

        const res1 = await runner.sendTurn({ text: 'Hello Gemini' });
        assert.equal(res1.sessionId, 'gem-sess-42');
        assert.equal(res1.text, 'Gemini(sys=true,resume=none,img=false): Hello Gemini');

        const imgBase64 = Buffer.from('jpeg-image-payload').toString('base64');
        const res2 = await runner.sendTurn({
            text: 'Solve problem',
            imageBase64: imgBase64,
        });
        assert.equal(res2.text, 'Gemini(sys=true,resume=gem-sess-42,img=true): Solve problem');

        const leftoverImages = fs.readdirSync(cwd).filter(name => name.startsWith('screen_') && name.endsWith('.jpg'));
        assert.deepEqual(leftoverImages, []);
    } finally {
        await runner?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('createCliSessionManager handles auto-fallback with context sync, manual switch, and clean session teardown', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-cliai-orch-'));
    let manager = null;
    try {
        const { mockClaudePath, mockGeminiPath } = createMockScripts(tmpDir);
        const events = [];
        const savedTurns = [];
        const savedScreens = [];

        manager = createCliSessionManager({
            getConfigDir: () => tmpDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: true,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: false,
                cliClaudePath: mockClaudePath,
                cliGeminiPath: mockGeminiPath,
            }),
            sendToRenderer: (channel, data) => events.push({ channel, data }),
            initializeNewSession: () => {},
            saveConversationTurn: (t, r) => savedTurns.push({ t, r }),
            saveScreenAnalysis: (p, r, m) => savedScreens.push({ p, r, m }),
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        const started = await manager.initializeCliSession({
            primaryProvider: 'claude',
            fallbackEnabled: true,
            whisperEnabled: false,
            claudePath: mockClaudePath,
            geminiPath: mockGeminiPath,
        });
        assert.equal(started, true);
        assert.equal(manager.getActiveCliProvider().provider, 'claude');

        const turn1 = await manager.sendCliText('Turn 1 hello');
        assert.equal(turn1.success, true);
        assert.equal(turn1.provider, 'claude');

        // Turn 2 triggers rate limit in Claude -> should fall back to Gemini with Turn 1 context
        const turn2 = await manager.sendCliText('TRIGGER_RATE_LIMIT explain closures');
        assert.equal(turn2.success, true);
        assert.equal(turn2.provider, 'gemini');
        assert.ok(turn2.text.includes('Turn 1 hello'), 'Fallback must carry earlier context');
        assert.ok(turn2.text.includes('TRIGGER_RATE_LIMIT explain closures'));
        assert.equal(manager.getActiveCliProvider().provider, 'gemini');

        const providerChangeEvents = events.filter(e => e.channel === 'cli-provider-changed');
        assert.ok(providerChangeEvents.some(e => e.data.provider === 'gemini' && e.data.reason === 'RATE_LIMIT'));

        // Switch manually back to Claude and analyze screen
        const sw = manager.switchCliProvider('claude');
        assert.equal(sw.success, true);
        assert.equal(manager.getActiveCliProvider().provider, 'claude');

        const screenRes = await manager.sendCliImage(Buffer.from('screen-data').toString('base64'), 'Solve MCQ');
        assert.equal(screenRes.success, true);
        assert.equal(screenRes.provider, 'claude');
        assert.ok(screenRes.text.includes('Turn 2') || screenRes.text.includes('Earlier conversation context'));
        assert.equal(savedTurns.length, 2);
        assert.equal(savedScreens.length, 1);

        await manager.closeCliSessionAsync();
        assert.equal(manager.isCliSessionActive(), false);

        const cliSessionsRoot = path.join(tmpDir, 'cli-sessions');
        const remainingDirs = fs.existsSync(cliSessionsRoot) ? fs.readdirSync(cliSessionsRoot) : [];
        assert.deepEqual(remainingDirs, []);
    } finally {
        await manager?.closeCliSessionAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('AgyCliRunner keeps persistent subprocess across multi-turn text and cleans up temp screenshot', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-agy-runner-'));
    let runner = null;
    try {
        const { mockAgyPath } = createMockScripts(tmpDir);
        const cwd = path.join(tmpDir, 'session-agy');

        runner = new AgyCliRunner({
            binaryPath: mockAgyPath,
            model: 'gemini-3.8-flash-low',
            systemPrompt: 'Keep answers short.',
            cwd,
            useSubscriptionAuth: true,
        });

        const deltas = [];
        const res1 = await runner.sendTurn({
            text: 'First question',
            onDelta: text => deltas.push(text),
        });
        assert.equal(res1.sessionId, 'agy-conv-99');
        assert.ok(deltas.length >= 2);
        assert.ok(res1.text.includes('turn=1,agents=true,img=false'));
        assert.ok(res1.text.includes('Keep answers short.'));
        assert.ok(res1.text.includes('First question'));

        const pidMatch1 = res1.text.match(/pid=(\d+)/);
        const res2 = await runner.sendTurn({
            text: 'Check screen',
            imageBase64: Buffer.from('fake-jpeg').toString('base64'),
        });
        const pidMatch2 = res2.text.match(/pid=(\d+)/);

        assert.equal(pidMatch2[1], pidMatch1[1], 'Expected persistent PID across agy turns');
        assert.ok(res2.text.includes('turn=2,agents=true,img=true'));
        assert.ok(!res2.text.includes('[Session instructions]'), 'System preamble should only be sent once per process');

        const leftoverImages = fs.readdirSync(cwd).filter(name => name.startsWith('screen_') && name.endsWith('.jpg'));
        assert.deepEqual(leftoverImages, []);
    } finally {
        await runner?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('createCliSessionManager falls back from Claude to AgyCliRunner with context sync and manual switch back', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-cliai-agy-'));
    let manager = null;
    try {
        const { mockClaudePath, mockAgyPath } = createMockScripts(tmpDir);
        const events = [];

        manager = createCliSessionManager({
            getConfigDir: () => tmpDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: true,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: false,
                cliClaudePath: mockClaudePath,
                cliGeminiPath: mockAgyPath,
            }),
            sendToRenderer: (channel, data) => events.push({ channel, data }),
            initializeNewSession: () => {},
            saveConversationTurn: () => {},
            saveScreenAnalysis: () => {},
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        const started = await manager.initializeCliSession({
            primaryProvider: 'claude',
            fallbackEnabled: true,
            whisperEnabled: false,
            claudePath: mockClaudePath,
            geminiPath: mockAgyPath,
        });
        assert.equal(started, true);

        const t1 = await manager.sendCliText('Question one');
        assert.equal(t1.provider, 'claude');

        const t2 = await manager.sendCliText('TRIGGER_RATE_LIMIT Question two');
        assert.equal(t2.success, true);
        assert.equal(t2.provider, 'gemini');
        assert.ok(t2.text.includes('Agy('), 'Should route to AgyCliRunner when agy binary is configured');
        assert.ok(t2.text.includes('Question one'), 'Fallback to agy must carry earlier context');

        const sw = manager.switchCliProvider('claude');
        assert.equal(sw.success, true);

        const t3 = await manager.sendCliText('Question three');
        assert.equal(t3.success, true);
        assert.equal(t3.provider, 'claude');
        assert.ok(t3.text.includes('Earlier conversation context'));

        await manager.closeCliSessionAsync();
        const cliSessionsRoot = path.join(tmpDir, 'cli-sessions');
        const remainingDirs = fs.existsSync(cliSessionsRoot) ? fs.readdirSync(cliSessionsRoot) : [];
        assert.deepEqual(remainingDirs, []);
    } finally {
        await manager?.closeCliSessionAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('createCliSessionManager buffers candidate speech in both+micContextOnly mode and triggers continuation on demand', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-cliai-ctx-'));
    let manager = null;
    try {
        const { mockClaudePath } = createMockScripts(tmpDir);
        const events = [];
        let capturedOnTranscription = null;
        const mockWhisperEngine = {
            start: async ({ onTranscription }) => {
                capturedOnTranscription = onTranscription;
            },
            processAudio: () => {},
            stop: () => {},
        };

        manager = createCliSessionManager({
            getConfigDir: () => tmpDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: false,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: true,
                cliClaudePath: mockClaudePath,
                audioMode: 'both',
                cliMicContextOnly: true,
            }),
            whisperEngine: mockWhisperEngine,
            sendToRenderer: (channel, data) => events.push({ channel, data }),
            initializeNewSession: () => {},
            saveConversationTurn: () => {},
            saveScreenAnalysis: () => {},
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        const started = await manager.initializeCliSession({
            primaryProvider: 'claude',
            fallbackEnabled: false,
            whisperEnabled: true,
            audioMode: 'both',
            micContextOnly: true,
            claudePath: mockClaudePath,
        });
        assert.equal(started, true);
        assert.equal(typeof capturedOnTranscription, 'function');

        // 1. Candidate speech is buffered silently (no LLM call, count -> 1)
        await capturedOnTranscription('Я працював з React три роки', 'candidate', { inferMs: 120 });
        assert.equal(
            events.some(e => e.channel === 'new-response'),
            false
        );
        const ctxEvents1 = events.filter(e => e.channel === 'cli-candidate-context');
        assert.equal(ctxEvents1[ctxEvents1.length - 1].data.count, 1);

        // 2. Interviewer speaks -> attaches candidate context and resets buffer -> 0
        await capturedOnTranscription('А яка база даних використовувалась?', 'interviewer', { inferMs: 140 });
        const responsesAfterInterviewer = events.filter(e => e.channel === 'new-response' || e.channel === 'update-response');
        const combinedInterviewerPrompt = responsesAfterInterviewer.map(e => e.data).join('\n');
        assert.ok(combinedInterviewerPrompt.includes('[Candidate just said]:'));
        assert.ok(combinedInterviewerPrompt.includes('Я працював з React три роки'));
        assert.ok(combinedInterviewerPrompt.includes('[Interviewer]: А яка база даних використовувалась?'));
        const ctxEvents2 = events.filter(e => e.channel === 'cli-candidate-context');
        assert.equal(ctxEvents2[ctxEvents2.length - 1].data.count, 0);

        // 3. Candidate gets stuck -> "Далі" (suggestCliContinuation) uses newly buffered phrase
        await capturedOnTranscription('Ми використовували PostgreSQL і...', 'candidate', { inferMs: 110 });
        const contRes1 = await manager.suggestCliContinuation();
        assert.equal(contRes1.success, true);
        assert.ok(contRes1.text.includes('[Candidate just started saying]:'));
        assert.ok(contRes1.text.includes('Ми використовували PostgreSQL і...'));

        // 4. Calling "Далі" with empty buffer still succeeds gracefully
        const contRes2 = await manager.suggestCliContinuation();
        assert.equal(contRes2.success, true);
        assert.ok(contRes2.text.includes('follow-up sentences'));

        await manager.closeCliSessionAsync();

        // 5. In mic_only mode, micContextOnly does NOT suppress direct mic turns
        events.length = 0;
        const startedMicOnly = await manager.initializeCliSession({
            primaryProvider: 'claude',
            fallbackEnabled: false,
            whisperEnabled: true,
            audioMode: 'mic_only',
            micContextOnly: true,
            claudePath: mockClaudePath,
        });
        assert.equal(startedMicOnly, true);
        await capturedOnTranscription('Який четвертий місяць року?', 'candidate', { inferMs: 90 });
        assert.equal(
            events.some(e => e.channel === 'new-response'),
            true
        );

        await manager.closeCliSessionAsync();
    } finally {
        await manager?.closeCliSessionAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('parseNpmCmdShim, resolveSpawnSpec, and quoteCmdArg handle Windows .exe shims and multiline args', () => {
    const flattened = quoteCmdArg('first line\nsecond line\r\nthird "quoted"');
    assert.equal(flattened, '"first line second line third ""quoted"""');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-exe-shim-test-'));
    try {
        const exeDir = path.join(tmpDir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin');
        fs.mkdirSync(exeDir, { recursive: true });
        const targetExe = path.join(exeDir, 'claude.exe');
        fs.writeFileSync(targetExe, 'MZ', 'utf8');

        const cmdPath = path.join(tmpDir, 'claude.cmd');
        fs.writeFileSync(cmdPath, '@ECHO off\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n', 'utf8');

        const parsed = parseNpmCmdShim(cmdPath);
        assert.equal(parsed, targetExe);

        if (process.platform === 'win32') {
            const spec = resolveSpawnSpec(cmdPath, ['--model', 'haiku', '--system-prompt', 'line1\nline2']);
            assert.equal(spec.viaCmdShell, false);
            assert.equal(spec.command, targetExe);
            assert.deepEqual(spec.args, ['--model', 'haiku', '--system-prompt', 'line1\nline2']);
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('ClaudeCliRunner enforces MCP/env isolation and places --model/--effort before --system-prompt', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-claude-isolation-'));
    let runner = null;
    try {
        const inspectMockPath = path.join(tmpDir, 'mock-claude-inspect.js');
        fs.writeFileSync(
            inspectMockPath,
            `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'iso-1' }) + '\\n');
rl.on('line', line => {
    if (!line.trim()) return;
    const report = {
        argv: process.argv.slice(2),
        safeMode: process.env.CLAUDE_CODE_SAFE_MODE,
        claudeAiMcps: process.env.ENABLE_CLAUDEAI_MCP_SERVERS,
    };
    const text = JSON.stringify(report);
    process.stdout.write(JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'iso-1',
        result: text,
    }) + '\\n');
});
`,
            'utf8'
        );

        const cwd = path.join(tmpDir, 'session-iso');
        runner = new ClaudeCliRunner({
            binaryPath: inspectMockPath,
            model: 'haiku',
            effort: 'low',
            systemPrompt: 'Line one\nLine two',
            cwd,
            useSubscriptionAuth: true,
        });

        const res = await runner.sendTurn({ text: 'check flags' });
        const report = JSON.parse(res.text);

        assert.equal(report.safeMode, '1');
        assert.equal(report.claudeAiMcps, 'false');
        assert.ok(report.argv.includes('--strict-mcp-config'));
        assert.ok(report.argv.includes('--disable-slash-commands'));

        const toolsIdx = report.argv.indexOf('--tools');
        assert.notEqual(toolsIdx, -1);
        assert.equal(report.argv[toolsIdx + 1], '');

        const modelIdx = report.argv.indexOf('--model');
        const effortIdx = report.argv.indexOf('--effort');
        const sysPromptIdx = report.argv.indexOf('--system-prompt');
        assert.notEqual(modelIdx, -1);
        assert.notEqual(effortIdx, -1);
        assert.notEqual(sysPromptIdx, -1);
        assert.ok(modelIdx < sysPromptIdx, 'Expected --model before --system-prompt');
        assert.ok(effortIdx < sysPromptIdx, 'Expected --effort before --system-prompt');
        assert.equal(report.argv[sysPromptIdx + 1], 'Line one\nLine two');
    } finally {
        await runner?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('getSystemPrompt includes STT distortion handling and multi-line list exam rules across profiles', () => {
    for (const profile of Object.keys(profilePrompts)) {
        const prompt = getSystemPrompt(profile, 'Frontend role', false);
        assert.match(prompt, /speech-to-text/i, `${profile} prompt should include STT rules`);
        assert.match(prompt, /NEVER ask the user to upload or paste a file/i, `${profile} prompt should forbid file/Doc requests`);
        assert.match(prompt, /MCP tools/i, `${profile} prompt should mention never referencing MCP tools`);
    }

    const examPrompt = getSystemPrompt('exam', '', false);
    assert.match(examPrompt, /short bullet points when the question asks for a list/i);
    assert.match(examPrompt, /brief explanation or bullet points on separate lines below it/i);
    assert.match(examPrompt, /Verify before answering/i);
    assert.match(examPrompt, /never guess/i);
    assert.match(examPrompt, /one consistent, verified final verdict/i);
    assert.match(examPrompt, /\*\*all\*\* correct options/i);
    assert.equal(/\*\*PREFERRED RESPONSE LANGUAGE:\*\*/.test(examPrompt), false);

    const ukExamPrompt = getSystemPrompt('exam', '', false, 'uk');
    assert.match(ukExamPrompt, /\*\*PREFERRED RESPONSE LANGUAGE:\*\*/);
    assert.match(ukExamPrompt, /Always respond in \*\*Ukrainian\*\*/i);

    const enExamPrompt = getSystemPrompt('exam', '', false, 'en-US');
    assert.match(enExamPrompt, /Always respond in \*\*English\*\*/i);
});

test('createCliSessionManager forwards responseLanguage to getSystemPrompt', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-cliai-lang-'));
    let manager = null;
    try {
        const { mockClaudePath } = createMockScripts(tmpDir);
        const capturedArgs = [];

        manager = createCliSessionManager({
            getConfigDir: () => tmpDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: false,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: false,
                cliClaudePath: mockClaudePath,
                selectedProfile: 'exam',
                responseLanguage: 'uk',
            }),
            getSystemPrompt: (profile, customPrompt, googleSearchEnabled, responseLanguage) => {
                capturedArgs.push({ profile, customPrompt, googleSearchEnabled, responseLanguage });
                return getSystemPrompt(profile, customPrompt, googleSearchEnabled, responseLanguage);
            },
            sendToRenderer: () => {},
            initializeNewSession: () => {},
            saveConversationTurn: () => {},
            saveScreenAnalysis: () => {},
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        const started = await manager.initializeCliSession({
            profile: 'exam',
            fallbackEnabled: false,
            whisperEnabled: false,
            claudePath: mockClaudePath,
        });
        assert.equal(started, true);
        assert.deepEqual(capturedArgs, [
            {
                profile: 'exam',
                customPrompt: '',
                googleSearchEnabled: false,
                responseLanguage: 'uk',
            },
        ]);

        await manager.closeCliSessionAsync();
    } finally {
        await manager?.closeCliSessionAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});
