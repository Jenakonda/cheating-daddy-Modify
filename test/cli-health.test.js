const test = require('node:test');
const assert = require('node:assert/strict');

const { createHealthTracker, describeHealth, formatAgo, stateFromCode } = require('../src/utils/cli-health');

test('stateFromCode maps CLI error codes to health states', () => {
    assert.equal(stateFromCode('RATE_LIMIT'), 'limited');
    assert.equal(stateFromCode('AUTH_REQUIRED'), 'auth');
    assert.equal(stateFromCode('NOT_INSTALLED'), 'missing');
    assert.equal(stateFromCode('TIMEOUT'), 'error');
    assert.equal(stateFromCode(undefined), 'error');
});

test('tracker records successes and failures per provider', () => {
    let clock = 1_000_000;
    const tracker = createHealthTracker({ now: () => clock });

    assert.equal(tracker.snapshot().claude.state, 'unknown');

    tracker.recordSuccess('claude');
    tracker.recordSuccess('claude');
    assert.equal(tracker.snapshot().claude.state, 'ok');
    assert.equal(tracker.snapshot().claude.turns, 2);

    clock += 5_000;
    tracker.recordFailure('claude', { code: 'RATE_LIMIT', message: '429 Rate limit reached' });
    const snapshot = tracker.snapshot();
    assert.equal(snapshot.claude.state, 'limited');
    assert.equal(snapshot.claude.failures, 1);
    assert.equal(snapshot.claude.lastError, '429 Rate limit reached');
    assert.equal(snapshot.claude.lastErrorAt, clock);
    assert.equal(snapshot.gemini.state, 'unknown');

    tracker.recordSuccess('gemini');
    assert.equal(tracker.snapshot().gemini.state, 'ok');

    tracker.recordSuccess('claude');
    assert.equal(tracker.snapshot().claude.state, 'ok', 'a later success clears the limited state');

    tracker.recordFailure('unknown-provider', { code: 'RATE_LIMIT' });
    tracker.recordSuccess('unknown-provider');

    tracker.reset();
    assert.equal(tracker.snapshot().claude.state, 'unknown');
    assert.equal(tracker.snapshot().claude.turns, 0);
});

test('snapshot is a copy that cannot change tracker state', () => {
    const tracker = createHealthTracker();
    const snapshot = tracker.snapshot();
    snapshot.claude.state = 'ok';
    assert.equal(tracker.snapshot().claude.state, 'unknown');
});

test('formatAgo and describeHealth produce short readable labels', () => {
    const now = 10_000_000;
    assert.equal(formatAgo(now - 20_000, now), 'just now');
    assert.equal(formatAgo(now - 3 * 60_000, now), '3 min ago');
    assert.equal(formatAgo(now - 2 * 3_600_000, now), '2 h ago');
    assert.equal(formatAgo(null, now), '');

    assert.deepEqual(describeHealth(null, now), { tone: 'idle', label: 'No requests yet' });
    assert.deepEqual(describeHealth({ state: 'ok', turns: 1 }, now), { tone: 'ok', label: 'Working · 1 reply' });
    assert.deepEqual(describeHealth({ state: 'ok', turns: 4 }, now), { tone: 'ok', label: 'Working · 4 replies' });
    assert.deepEqual(describeHealth({ state: 'limited', lastErrorAt: now - 120_000 }, now), { tone: 'warn', label: 'Rate limit reached 2 min ago' });
    assert.equal(describeHealth({ state: 'auth' }, now).tone, 'danger');
    assert.equal(describeHealth({ state: 'missing' }, now).label, 'CLI not installed');
    assert.equal(describeHealth({ state: 'error', lastErrorAt: now - 1000 }, now).label, 'Error just now');
});
