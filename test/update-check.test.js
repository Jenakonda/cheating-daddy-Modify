const test = require('node:test');
const assert = require('node:assert/strict');

const { compareVersions, parseVersion, checkForUpdates, releasesPageUrl, DEFAULT_REPO } = require('../src/utils/update-check');

function jsonResponse(body, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => body };
}

test('parseVersion and compareVersions understand tags and plain versions', () => {
    assert.deepEqual(parseVersion('v0.9.0'), [0, 9, 0]);
    assert.deepEqual(parseVersion('1.2.3-beta'), [1, 2, 3]);
    assert.equal(parseVersion('nope'), null);

    assert.equal(compareVersions('0.9.1', '0.9.0'), 1);
    assert.equal(compareVersions('v0.10.0', '0.9.9'), 1);
    assert.equal(compareVersions('0.9.0', 'v0.9.0'), 0);
    assert.equal(compareVersions('0.8.9', '0.9.0'), -1);
    assert.equal(compareVersions('abc', '0.9.0'), null);
});

test('checkForUpdates reports a newer release of this fork', async () => {
    let requestedUrl = '';
    const result = await checkForUpdates({
        currentVersion: '0.9.0',
        fetchImpl: async url => {
            requestedUrl = url;
            return jsonResponse({ tag_name: 'v0.10.0', html_url: `https://github.com/${DEFAULT_REPO}/releases/tag/v0.10.0` });
        },
    });

    assert.match(requestedUrl, /Jenakonda\/cheating-daddy-Modify\/releases\/latest$/);
    assert.equal(result.updateAvailable, true);
    assert.equal(result.latestVersion, '0.10.0');
    assert.equal(result.url, `https://github.com/${DEFAULT_REPO}/releases/tag/v0.10.0`);
    assert.equal(result.error, null);
});

test('checkForUpdates ignores same or older versions, drafts, prereleases and foreign links', async () => {
    const same = await checkForUpdates({ currentVersion: '0.9.0', fetchImpl: async () => jsonResponse({ tag_name: 'v0.9.0' }) });
    assert.equal(same.updateAvailable, false);

    const older = await checkForUpdates({ currentVersion: '0.9.0', fetchImpl: async () => jsonResponse({ tag_name: 'v0.8.1' }) });
    assert.equal(older.updateAvailable, false);

    const draft = await checkForUpdates({ currentVersion: '0.9.0', fetchImpl: async () => jsonResponse({ tag_name: 'v1.0.0', draft: true }) });
    assert.equal(draft.updateAvailable, false);

    const pre = await checkForUpdates({ currentVersion: '0.9.0', fetchImpl: async () => jsonResponse({ tag_name: 'v1.0.0', prerelease: true }) });
    assert.equal(pre.updateAvailable, false);

    const foreign = await checkForUpdates({
        currentVersion: '0.9.0',
        fetchImpl: async () => jsonResponse({ tag_name: 'v1.0.0', html_url: 'https://evil.example/download' }),
    });
    assert.equal(foreign.updateAvailable, true);
    assert.equal(foreign.url, releasesPageUrl());
});

test('checkForUpdates never throws and reports errors', async () => {
    const http = await checkForUpdates({ currentVersion: '0.9.0', fetchImpl: async () => jsonResponse({}, { ok: false, status: 403 }) });
    assert.equal(http.updateAvailable, false);
    assert.match(http.error, /403/);

    const network = await checkForUpdates({
        currentVersion: '0.9.0',
        fetchImpl: async () => {
            throw new Error('offline');
        },
    });
    assert.equal(network.updateAvailable, false);
    assert.equal(network.error, 'offline');

    const timeout = await checkForUpdates({
        currentVersion: '0.9.0',
        timeoutMs: 10,
        fetchImpl: (url, { signal }) =>
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            }),
    });
    assert.equal(timeout.error, 'Update check timed out');
});
