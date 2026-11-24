const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { clearDataCategory, formatBytes, getDataUsage, pruneOldSessions } = require('../src/utils/data-usage');

function makeConfigDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-data-test-'));
    fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'models', 'whisper'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'context'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'history', '1000.json'), '{"a":1}');
    fs.writeFileSync(path.join(dir, 'models', 'whisper', 'model.bin'), Buffer.alloc(2048));
    fs.writeFileSync(path.join(dir, 'context', 'notes.md'), 'my notes');
    fs.writeFileSync(path.join(dir, 'preferences.json'), '{"keep":true}');
    fs.writeFileSync(path.join(dir, 'credentials.json'), '{"apiKey":"secret"}');
    return dir;
}

test('getDataUsage measures each folder recursively', () => {
    const dir = makeConfigDir();
    try {
        const usage = Object.fromEntries(getDataUsage(dir).map(item => [item.id, item]));
        assert.equal(usage.history.bytes, 7);
        assert.equal(usage.history.files, 1);
        assert.equal(usage.models.bytes, 2048);
        assert.equal(usage.models.files, 1);
        assert.equal(usage.logs.bytes, 0);
        assert.equal(usage.context.clearable, false);
        assert.equal(usage.history.clearable, true);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('clearDataCategory empties only clearable folders and keeps settings', () => {
    const dir = makeConfigDir();
    try {
        const cleared = clearDataCategory(dir, 'models');
        assert.equal(cleared.success, true);
        assert.equal(fs.existsSync(path.join(dir, 'models')), true);
        assert.deepEqual(fs.readdirSync(path.join(dir, 'models')), []);

        assert.equal(clearDataCategory(dir, 'context').success, false);
        assert.equal(fs.existsSync(path.join(dir, 'context', 'notes.md')), true);

        assert.equal(clearDataCategory(dir, '../preferences.json').success, false);
        assert.equal(clearDataCategory(dir, 'unknown').success, false);
        assert.equal(fs.existsSync(path.join(dir, 'preferences.json')), true);
        assert.equal(fs.existsSync(path.join(dir, 'credentials.json')), true);

        const logs = clearDataCategory(dir, 'logs');
        assert.equal(logs.success, true, 'a missing folder is created instead of failing');
        assert.equal(fs.existsSync(path.join(dir, 'logs')), true);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('pruneOldSessions removes only sessions older than the retention period', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-prune-test-'));
    try {
        const now = Date.UTC(2026, 10, 24);
        const day = 24 * 60 * 60 * 1000;
        fs.writeFileSync(path.join(dir, `${now - 40 * day}.json`), '{}');
        fs.writeFileSync(path.join(dir, `${now - 10 * day}.json`), '{}');
        fs.writeFileSync(path.join(dir, `${now - 1 * day}.json`), '{}');
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a session');

        assert.equal(pruneOldSessions(dir, 0, now), 0);
        assert.equal(pruneOldSessions(dir, -5, now), 0);
        assert.equal(pruneOldSessions(dir, 'abc', now), 0);
        assert.equal(fs.readdirSync(dir).length, 4);

        assert.equal(pruneOldSessions(dir, 30, now), 1);
        assert.equal(pruneOldSessions(dir, 7, now), 1);
        assert.deepEqual(fs.readdirSync(dir).sort(), [`${now - 1 * day}.json`, 'notes.txt'].sort());

        assert.equal(pruneOldSessions(path.join(dir, 'missing'), 7, now), 0);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('formatBytes prints compact sizes', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(2048), '2.0 KB');
    assert.equal(formatBytes(15 * 1024 * 1024), '15 MB');
    assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), '1.5 GB');
});
