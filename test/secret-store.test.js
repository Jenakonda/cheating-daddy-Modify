const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PREFIX, createSecretStore, isEncrypted } = require('../src/utils/secret-store');

function createFakeSafeStorage({ available = true } = {}) {
    return {
        isEncryptionAvailable: () => available,
        encryptString: text => Buffer.from(`FAKE:${[...text].reverse().join('')}`, 'utf8'),
        decryptString: buffer => {
            const text = buffer.toString('utf8');
            if (!text.startsWith('FAKE:')) throw new Error('cannot decrypt');
            return [...text.slice(5)].reverse().join('');
        },
    };
}

test('values round-trip through encryption and are not stored in clear text', () => {
    const store = createSecretStore(createFakeSafeStorage());

    const encrypted = store.encryptValue('sk-secret-123');
    assert.ok(isEncrypted(encrypted));
    assert.ok(encrypted.startsWith(PREFIX));
    assert.ok(!encrypted.includes('sk-secret-123'));
    assert.deepEqual(store.decryptValue(encrypted), { value: 'sk-secret-123', ok: true });

    assert.equal(store.encryptValue(encrypted), encrypted, 'already encrypted values are left alone');
    assert.equal(store.encryptValue(''), '', 'empty values stay empty');
    assert.equal(store.encryptValue(42), 42);
    assert.deepEqual(store.decryptValue('plain-old-key'), { value: 'plain-old-key', ok: true });
});

test('without encryption support values stay readable and nothing breaks', () => {
    for (const safeStorage of [
        null,
        createFakeSafeStorage({ available: false }),
        {
            isEncryptionAvailable: () => {
                throw new Error('no keyring');
            },
        },
    ]) {
        const store = createSecretStore(safeStorage);
        assert.equal(store.isAvailable(), false);
        assert.equal(store.encryptValue('key'), 'key');
        assert.equal(store.needsMigration({ apiKey: 'key' }), false);
    }
});

test('undecryptable values are reported by name and read as empty', () => {
    const store = createSecretStore(createFakeSafeStorage());
    const { data, unreadable } = store.decryptObject({ apiKey: `${PREFIX}${Buffer.from('garbage').toString('base64')}`, groqApiKey: 'plain' });

    assert.deepEqual(unreadable, ['apiKey']);
    assert.equal(data.apiKey, '');
    assert.equal(data.groqApiKey, 'plain');
});

test('removed legacy fields are dropped and plain values trigger a migration', () => {
    const store = createSecretStore(createFakeSafeStorage());

    assert.equal(store.needsMigration({ apiKey: 'key', groqApiKey: '' }), true);
    assert.equal(store.needsMigration({ apiKey: '', groqApiKey: '' }), false);
    assert.equal(store.needsMigration({ apiKey: store.encryptValue('key') }), false);
    assert.equal(store.needsMigration({ apiKey: '', cloudToken: 'old' }), true, 'the unused cloud token is removed');

    const encrypted = store.encryptObject({ apiKey: 'key', cloudToken: 'old', groqApiKey: '' });
    assert.ok(!('cloudToken' in encrypted));
    assert.equal(encrypted.groqApiKey, '');
    assert.equal(store.decryptObject(encrypted).data.apiKey, 'key');
});

test('buildVerifiedMigration refuses to produce a copy it cannot read back', () => {
    const good = createSecretStore(createFakeSafeStorage());
    const migrated = good.buildVerifiedMigration({ apiKey: 'key', groqApiKey: 'groq', openaiKey: '' });
    assert.ok(isEncrypted(migrated.apiKey) && isEncrypted(migrated.groqApiKey));
    assert.deepEqual(good.decryptObject(migrated).data, { apiKey: 'key', groqApiKey: 'groq', openaiKey: '' });

    const broken = createSecretStore({
        isEncryptionAvailable: () => true,
        encryptString: text => Buffer.from(text),
        decryptString: () => 'something else',
    });
    assert.equal(broken.buildVerifiedMigration({ apiKey: 'key' }), null);
});

test('storage encrypts saved keys on disk, migrates old files and keeps working without encryption', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-secret-test-'));
    const previous = { USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME };
    process.env.USERPROFILE = home;
    process.env.HOME = home;

    const storagePath = require.resolve('../src/storage');
    delete require.cache[storagePath];

    try {
        const storage = require('../src/storage');
        const configDir = storage.getConfigDir();
        assert.ok(configDir.startsWith(home), 'the test must use its own profile');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ configVersion: 1, onboarded: true }));
        const credentialsPath = path.join(configDir, 'credentials.json');
        fs.writeFileSync(credentialsPath, JSON.stringify({ apiKey: 'plain-gemini-key', groqApiKey: 'plain-groq-key', cloudToken: 'old-token' }));

        // Without encryption nothing is migrated except the removed field
        storage.initializeStorage();
        assert.equal(storage.getCredentials().apiKey, 'plain-gemini-key');
        assert.ok(!('cloudToken' in JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))));

        // With encryption the old plain values are encrypted on start-up
        storage.setSecretStore(createFakeSafeStorage());
        storage.initializeStorage();
        const onDisk = fs.readFileSync(credentialsPath, 'utf8');
        assert.ok(!onDisk.includes('plain-gemini-key') && !onDisk.includes('plain-groq-key'));
        assert.ok(onDisk.includes(PREFIX));
        assert.equal(storage.getApiKey(), 'plain-gemini-key');
        assert.equal(storage.getGroqApiKey(), 'plain-groq-key');

        // New keys are written encrypted too and merge with the existing ones
        storage.setCredentials({ openaiKey: 'plain-openai-key' });
        const afterSave = fs.readFileSync(credentialsPath, 'utf8');
        assert.ok(!afterSave.includes('plain-openai-key'));
        assert.deepEqual(
            { apiKey: storage.getCredentials().apiKey, openaiKey: storage.getCredentials().openaiKey },
            { apiKey: 'plain-gemini-key', openaiKey: 'plain-openai-key' }
        );
        assert.equal(fs.existsSync(`${credentialsPath}.tmp`), false, 'no temporary file is left behind');

        // Running the migration again changes nothing
        assert.equal(storage.migrateCredentials().migrated, false);
    } finally {
        delete require.cache[storagePath];
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        fs.rmSync(home, { recursive: true, force: true });
    }
});
