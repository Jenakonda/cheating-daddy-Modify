const test = require('node:test');
const assert = require('node:assert/strict');

const { isSafeExternalUrl } = require('../src/utils/external-url');

test('isSafeExternalUrl accepts only http and https links', () => {
    assert.equal(isSafeExternalUrl('https://github.com/Jenakonda/cheating-daddy-Modify/releases/latest'), true);
    assert.equal(isSafeExternalUrl('http://example.com/path?q=1'), true);

    assert.equal(isSafeExternalUrl('file:///C:/Windows/System32/calc.exe'), false);
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
    assert.equal(isSafeExternalUrl('ms-msdt:/id PCWDiagnostic'), false);
    assert.equal(isSafeExternalUrl('vscode://file/C:/secret'), false);
    assert.equal(isSafeExternalUrl('not a url'), false);
    assert.equal(isSafeExternalUrl(''), false);
    assert.equal(isSafeExternalUrl(null), false);
    assert.equal(isSafeExternalUrl({ href: 'https://example.com' }), false);
    assert.equal(isSafeExternalUrl(`https://example.com/${'a'.repeat(3000)}`), false);
});
