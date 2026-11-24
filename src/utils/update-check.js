const DEFAULT_REPO = 'Jenakonda/cheating-daddy-Modify';

function parseVersion(value) {
    const match = String(value || '')
        .trim()
        .match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Returns 1 when a > b, -1 when a < b, 0 when equal, and null when either version cannot be parsed. */
function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    if (!left || !right) {
        return null;
    }
    for (let i = 0; i < 3; i += 1) {
        if (left[i] > right[i]) return 1;
        if (left[i] < right[i]) return -1;
    }
    return 0;
}

function releasesPageUrl(repo = DEFAULT_REPO) {
    return `https://github.com/${repo}/releases/latest`;
}

/**
 * Checks the latest published GitHub release of this fork.
 * Never throws: failures are reported through the `error` field.
 */
async function checkForUpdates({ currentVersion, repo = DEFAULT_REPO, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
    const result = { updateAvailable: false, latestVersion: null, url: releasesPageUrl(repo), error: null };

    if (typeof fetchImpl !== 'function') {
        result.error = 'fetch is not available';
        return result;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cheating-daddy-update-check' },
            signal: controller.signal,
        });
        if (!response.ok) {
            result.error = `GitHub responded with ${response.status}`;
            return result;
        }

        const release = await response.json();
        if (!release || release.draft || release.prerelease) {
            return result;
        }

        result.latestVersion = String(release.tag_name || '').replace(/^v/, '') || null;
        if (typeof release.html_url === 'string' && release.html_url.startsWith(`https://github.com/${repo}/`)) {
            result.url = release.html_url;
        }
        result.updateAvailable = compareVersions(result.latestVersion, currentVersion) === 1;
        return result;
    } catch (error) {
        result.error = error?.name === 'AbortError' ? 'Update check timed out' : error?.message || 'Update check failed';
        return result;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    DEFAULT_REPO,
    parseVersion,
    compareVersions,
    releasesPageUrl,
    checkForUpdates,
};
