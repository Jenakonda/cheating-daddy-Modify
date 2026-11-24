const test = require('node:test');
const assert = require('node:assert/strict');

const { arrayBufferToBase64, buildManualScreenshotPrompt, convertFloat32ToInt16, createPcmChunker } = require('../src/utils/capture-utils');

test('convertFloat32ToInt16 scales samples and clamps clipping', () => {
    const pcm = convertFloat32ToInt16(Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -3]));

    assert.deepEqual(Array.from(pcm), [0, 32767, -32768, 16383, -16384, 32767, -32768]);
    assert.ok(pcm instanceof Int16Array);
    assert.equal(convertFloat32ToInt16([]).length, 0);
});

test('arrayBufferToBase64 matches Buffer encoding', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 255, 128]);
    assert.equal(arrayBufferToBase64(bytes.buffer), Buffer.from(bytes).toString('base64'));
    assert.equal(arrayBufferToBase64(new ArrayBuffer(0)), '');

    const pcm = convertFloat32ToInt16(Float32Array.from([0.25, -0.25, 0.75]));
    const decodedBytes = Uint8Array.from(Buffer.from(arrayBufferToBase64(pcm.buffer), 'base64'));
    const decoded = new Int16Array(decodedBytes.buffer);
    assert.deepEqual(Array.from(decoded), Array.from(pcm));
});

test('createPcmChunker emits fixed-size chunks in order and keeps the remainder', () => {
    const chunker = createPcmChunker(4);

    assert.deepEqual(chunker.push(Float32Array.from([0.1, 0.2, 0.3])), []);
    assert.equal(chunker.pending, 3);

    const first = chunker.push(Float32Array.from([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]));
    assert.equal(first.length, 2);
    assert.equal(first[0].length, 4);
    assert.equal(chunker.pending, 2);

    const expectedFirst = convertFloat32ToInt16([0.1, 0.2, 0.3, 0.4]);
    assert.deepEqual(Array.from(first[0]), Array.from(expectedFirst));
    const expectedSecond = convertFloat32ToInt16([0.5, 0.6, 0.7, 0.8]);
    assert.deepEqual(Array.from(first[1]), Array.from(expectedSecond));

    const second = chunker.push(Float32Array.from([0.1, 0.2]));
    assert.equal(second.length, 1);
    assert.deepEqual(Array.from(second[0]), Array.from(convertFloat32ToInt16([0.9, 1.0, 0.1, 0.2])));
    assert.equal(chunker.pending, 0);

    chunker.push([0.5]);
    chunker.reset();
    assert.equal(chunker.pending, 0);
});

test('createPcmChunker never uses an invalid chunk size', () => {
    for (const bad of [0, -5, NaN, undefined]) {
        const chunker = createPcmChunker(bad);
        assert.equal(chunker.push([0.1, 0.2]).length, 2, `size ${bad} falls back to one sample per chunk`);
    }
    assert.equal(createPcmChunker(2.9).push([0.1, 0.2, 0.3]).length, 1);
});

test('buildManualScreenshotPrompt follows the response language', () => {
    assert.match(buildManualScreenshotPrompt('auto'), /same language as the question/);
    assert.match(buildManualScreenshotPrompt(''), /same language as the question/);
    assert.match(buildManualScreenshotPrompt(undefined), /same language as the question/);
    assert.match(buildManualScreenshotPrompt('uk'), /answer in Ukrainian/);
    assert.match(buildManualScreenshotPrompt('uk-UA'), /answer in Ukrainian/);
    assert.match(buildManualScreenshotPrompt('PL'), /answer in Polish/);
    assert.match(buildManualScreenshotPrompt('xx'), /answer in xx/);
    assert.match(buildManualScreenshotPrompt('en'), /multiple-choice question/);
});
