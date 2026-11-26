const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('the answer text size is always a number within the slider range', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-font-'));
    const originalHomedir = os.homedir;
    os.homedir = () => home;
    try {
        const storage = require('../src/storage');
        storage.initializeStorage();
        const size = () => storage.getPreferences().fontSize;
        assert.equal(size(), 15);

        // A profile saved by an older version holds a word instead of a size
        storage.setPreferences({ fontSize: 'medium' });
        assert.equal(size(), 15);

        for (const [saved, expected] of [
            [22, 22],
            ['18', 18],
            [4, 12],
            [99, 32],
            [null, 15],
        ]) {
            storage.updatePreference('fontSize', saved);
            assert.equal(size(), expected, `saved ${saved}`);
        }
    } finally {
        os.homedir = originalHomedir;
        fs.rmSync(home, { recursive: true, force: true });
    }
});
