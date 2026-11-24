const fs = require('fs');
const path = require('path');

const MAX_SCAN_DEPTH = 8;

// Only these folders can be cleared from the UI. Settings, credentials and the context folder are never touched here.
const DATA_CATEGORIES = [
    { id: 'history', label: 'Session history', folder: 'history', description: 'Saved conversations and screen analyses.', clearable: true },
    {
        id: 'models',
        label: 'Downloaded models',
        folder: 'models',
        description: 'Whisper and local language models. They are downloaded again when needed.',
        clearable: true,
    },
    {
        id: 'binaries',
        label: 'Speech engines',
        folder: 'binaries',
        description: 'whisper.cpp and llama.cpp binaries. They are downloaded again when needed.',
        clearable: true,
    },
    { id: 'logs', label: 'Logs', folder: 'logs', description: 'Diagnostic logs of CLI and speech activity.', clearable: true },
    {
        id: 'cli-sessions',
        label: 'CLI session files',
        folder: 'cli-sessions',
        description: 'Temporary working files of CLI sessions.',
        clearable: true,
    },
    {
        id: 'context',
        label: 'Context folder',
        folder: 'context',
        description: 'Your reference files. Manage them from Home or AI Context.',
        clearable: false,
    },
];

function measureDirectory(dir, depth = 0) {
    const result = { bytes: 0, files: 0 };
    if (depth > MAX_SCAN_DEPTH) {
        return result;
    }

    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return result;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        try {
            if (entry.isSymbolicLink()) {
                continue;
            }
            if (entry.isDirectory()) {
                const nested = measureDirectory(fullPath, depth + 1);
                result.bytes += nested.bytes;
                result.files += nested.files;
            } else if (entry.isFile()) {
                result.bytes += fs.statSync(fullPath).size;
                result.files += 1;
            }
        } catch {
            // Skip files that disappear or cannot be read
        }
    }
    return result;
}

function getDataUsage(configDir) {
    return DATA_CATEGORIES.map(category => {
        const { bytes, files } = measureDirectory(path.join(configDir, category.folder));
        return { id: category.id, label: category.label, description: category.description, clearable: category.clearable, bytes, files };
    });
}

function isInside(parent, child) {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Deletes the contents of one clearable category and keeps the (now empty) folder. */
function clearDataCategory(configDir, categoryId) {
    const category = DATA_CATEGORIES.find(item => item.id === categoryId);
    if (!category || !category.clearable) {
        return { success: false, error: 'This data cannot be cleared here' };
    }

    const target = path.join(configDir, category.folder);
    if (!isInside(configDir, target)) {
        return { success: false, error: 'Invalid location' };
    }

    let removed = 0;
    try {
        if (fs.existsSync(target)) {
            for (const name of fs.readdirSync(target)) {
                fs.rmSync(path.join(target, name), { recursive: true, force: true });
                removed += 1;
            }
        } else {
            fs.mkdirSync(target, { recursive: true });
        }
        return { success: true, removed };
    } catch (error) {
        return { success: false, error: error.message, removed };
    }
}

/** Deletes saved sessions older than the given number of days. Zero or less keeps everything. */
function pruneOldSessions(historyDir, days, now = Date.now()) {
    const retentionDays = Number(days);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
        return 0;
    }

    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    let files;
    try {
        files = fs.readdirSync(historyDir).filter(name => name.endsWith('.json'));
    } catch {
        return 0;
    }

    for (const name of files) {
        const fullPath = path.join(historyDir, name);
        try {
            const idTimestamp = Number.parseInt(name.replace('.json', ''), 10);
            const timestamp = Number.isFinite(idTimestamp) && idTimestamp > 0 ? idTimestamp : fs.statSync(fullPath).mtimeMs;
            if (timestamp < cutoff) {
                fs.rmSync(fullPath, { force: true });
                removed += 1;
            }
        } catch {
            // Ignore files that cannot be removed
        }
    }
    return removed;
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

module.exports = {
    DATA_CATEGORIES,
    getDataUsage,
    clearDataCategory,
    pruneOldSessions,
    formatBytes,
};
