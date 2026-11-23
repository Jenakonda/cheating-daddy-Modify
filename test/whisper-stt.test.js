const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    VAD_MODES,
    WhisperSttEngine,
    resample24kTo16k,
    resamplePcmTo16k,
    calculateRms,
    createWavBuffer,
    mapSpeechLanguageToWhisper,
    isNoiseOrHallucination,
    isLowConfidenceWhisperResult,
} = require('../src/utils/whisper-stt');

function makePcmChunk(samplesCount, amplitude = 0, sampleRate = 24000) {
    const buf = Buffer.alloc(samplesCount * 2);
    for (let i = 0; i < samplesCount; i++) {
        const val = amplitude === 0 ? 0 : Math.round(amplitude * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
        buf.writeInt16LE(Math.max(-32768, Math.min(32767, val)), i * 2);
    }
    return buf;
}

const makePcmChunk24k = (samplesCount, amplitude = 0) => makePcmChunk(samplesCount, amplitude, 24000);

test('resample24kTo16k resamples 24kHz chunks accurately and preserves remainder', () => {
    const state = { remainder: Buffer.alloc(0) };

    const chunk24k = makePcmChunk24k(2400, 0.5); // 100ms at 24 kHz
    const out16k = resample24kTo16k(chunk24k, state);
    assert.equal(out16k.length, 3200); // 1600 samples * 2 bytes = 100ms at 16 kHz
    assert.equal(state.remainder.length, 0);

    // Unaligned chunks: 5 samples + 4 samples = 9 input samples -> 6 output samples total
    const state2 = { remainder: Buffer.alloc(0) };
    const part1 = resample24kTo16k(makePcmChunk24k(5, 0.2), state2);
    const part2 = resample24kTo16k(makePcmChunk24k(4, 0.2), state2);
    assert.equal((part1.length + part2.length) / 2, 6);
    assert.equal(state2.remainder.length, 0);
});

test('resamplePcmTo16k handles 16kHz passthrough, 48kHz 3:1, and 44.1kHz linear resampling', () => {
    const state16 = { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null };
    const pcm16 = makePcmChunk(1600, 0.4, 16000);
    const out16 = resamplePcmTo16k(pcm16, 16000, state16);
    assert.equal(out16.length, pcm16.length);

    const state48 = { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null };
    const pcm48 = makePcmChunk(4800, 0.4, 48000); // 100ms at 48 kHz
    const out48 = resamplePcmTo16k(pcm48, 48000, state48);
    assert.equal(out48.length, 3200); // 1600 samples * 2 bytes
    assert.equal(state48.remainder.length, 0);

    // Unaligned 48 kHz: 5 + 4 = 9 input samples -> 3 output samples total
    const state48Unaligned = { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null };
    const p1 = resamplePcmTo16k(makePcmChunk(5, 0.25, 48000), 48000, state48Unaligned);
    const p2 = resamplePcmTo16k(makePcmChunk(4, 0.25, 48000), 48000, state48Unaligned);
    assert.equal((p1.length + p2.length) / 2, 3);
    assert.equal(state48Unaligned.remainder.length, 0);

    const state44 = { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null };
    const c1 = resamplePcmTo16k(makePcmChunk(4410, 0.5, 44100), 44100, state44);
    const c2 = resamplePcmTo16k(makePcmChunk(4410, 0.5, 44100), 44100, state44);
    const totalOutSamples = (c1.length + c2.length) / 2;
    assert.ok(totalOutSamples >= 3198 && totalOutSamples <= 3202, `Expected ~3200 samples, got ${totalOutSamples}`);
});

test('createWavBuffer produces valid 16kHz 16-bit mono WAV header', () => {
    const pcm = Buffer.alloc(3200);
    const wav = createWavBuffer(pcm);

    assert.equal(wav.length, 44 + pcm.length);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), 36 + pcm.length);
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
    assert.equal(wav.readUInt32LE(16), 16);
    assert.equal(wav.readUInt16LE(20), 1); // PCM
    assert.equal(wav.readUInt16LE(22), 1); // Mono
    assert.equal(wav.readUInt32LE(24), 16000); // Sample rate
    assert.equal(wav.readUInt32LE(28), 32000); // Byte rate
    assert.equal(wav.readUInt16LE(32), 2); // Block align
    assert.equal(wav.readUInt16LE(34), 16); // Bits per sample
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), pcm.length);
});

test('mapSpeechLanguageToWhisper handles Ukrainian, auto, Mandarin, and .en models', () => {
    assert.equal(mapSpeechLanguageToWhisper('uk-UA', 'base'), 'uk');
    assert.equal(mapSpeechLanguageToWhisper('uk-UA', 'tiny.en'), 'en');
    assert.equal(mapSpeechLanguageToWhisper('auto', 'small'), 'auto');
    assert.equal(mapSpeechLanguageToWhisper('cmn-CN', 'large-v3-turbo-q5_0'), 'zh');
    assert.equal(mapSpeechLanguageToWhisper('en-US', 'base'), 'en');
    assert.equal(mapSpeechLanguageToWhisper('', 'base'), 'auto');
});

test('isNoiseOrHallucination filters Whisper artifacts without dropping real words', () => {
    assert.equal(isNoiseOrHallucination(''), true);
    assert.equal(isNoiseOrHallucination('a'), true);
    assert.equal(isNoiseOrHallucination('...'), true);
    assert.equal(isNoiseOrHallucination('[BLANK_AUDIO]'), true);
    assert.equal(isNoiseOrHallucination('(silence)'), true);
    assert.equal(isNoiseOrHallucination('[Music]'), true);
    assert.equal(isNoiseOrHallucination('Дякую за перегляд!'), true);
    assert.equal(isNoiseOrHallucination('Дякую за увагу.'), true);

    assert.equal(isNoiseOrHallucination('Yes'), false);
    assert.equal(isNoiseOrHallucination('Так'), false);
    assert.equal(isNoiseOrHallucination('Розкажіть про свій досвід з React.'), false);
});

test('isLowConfidenceWhisperResult filters low-logprob and high no_speech_prob hallucinations safely', () => {
    assert.equal(
        isLowConfidenceWhisperResult({
            text: ' Тості.',
            segments: [{ avg_logprob: -3.13, no_speech_prob: 0.01 }],
        }),
        true
    );
    assert.equal(
        isLowConfidenceWhisperResult({
            text: 'What is the fourth month of the year?',
            segments: [{ avg_logprob: -0.025, no_speech_prob: 0.944 }],
        }),
        false
    );
    assert.equal(
        isLowConfidenceWhisperResult({
            text: 'Який четвертий місяць року?',
            segments: [{ avg_logprob: -1.15, no_speech_prob: 0.8 }],
        }),
        true
    );
    assert.equal(
        isLowConfidenceWhisperResult({
            text: 'Так',
            segments: [{ avg_logprob: -0.25, no_speech_prob: 0.05 }],
        }),
        false
    );
    assert.equal(
        isLowConfidenceWhisperResult({
            text: 'Який четвертий місяць року?',
            segments: [{ avg_logprob: -0.35, no_speech_prob: 0.05 }],
        }),
        false
    );
    assert.equal(isLowConfidenceWhisperResult({ text: 'Plain response without segments' }), false);
});

test('WhisperSttEngine captures pre-roll frames, transcribes speech via /inference, and respects max segment cap', async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/inference') {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
                const body = Buffer.concat(chunks);
                requests.push(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                    JSON.stringify({
                        text: 'Привіт, як справи?',
                        language: 'ukrainian',
                        detected_language: 'ukrainian',
                        segments: [{ avg_logprob: -0.25, no_speech_prob: 0.02 }],
                    })
                );
            });
            return;
        }
        res.writeHead(200);
        res.end('ok');
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const transcriptions = [];
    let spawnArgs = null;
    const engine = new WhisperSttEngine({
        preRollFrames: 3,
        minSpeechBytes: 3200,
        maxSpeechBytes: 16000, // Small cap to test forced flush
        ensureNativeBinary: async () => 'mock-whisper',
        ensureWhisperModel: async () => 'mock-model.bin',
        getAvailablePort: async () => port,
        startNativeServer: ({ arguments: args }) => {
            spawnArgs = args;
            return { exitCode: null, kill() {} };
        },
        stopNativeServer: () => {},
        waitForServer: async () => {},
    });

    try {
        await engine.start({
            whisperModel: 'large-v3-turbo-q5_0',
            language: 'uk-UA',
            vadMode: { energyThreshold: 0.02, speechFramesRequired: 2, silenceFramesRequired: 3 },
            onTranscription: async (text, source, meta) => {
                transcriptions.push({ text, source, meta });
            },
        });

        assert.equal(engine.whisperLanguage, 'uk');
        assert.ok(Array.isArray(spawnArgs));
        assert.ok(spawnArgs.includes('-t'));
        assert.equal(spawnArgs[spawnArgs.indexOf('-l') + 1], 'uk');
        assert.ok(spawnArgs.includes('-nf'));
        assert.equal(spawnArgs[spawnArgs.indexOf('-bo') + 1], '1');
        assert.equal(spawnArgs[spawnArgs.indexOf('-ac') + 1], '640');
        assert.ok(spawnArgs.includes('--suppress-nst'));
        assert.ok(spawnArgs.includes('--no-timestamps'));

        const quietChunk24k = makePcmChunk24k(2400, 0.001); // below threshold
        const loudChunk24k = makePcmChunk24k(2400, 0.5); // well above threshold
        assert.ok(calculateRms(quietChunk24k) < 0.02);
        assert.ok(calculateRms(loudChunk24k) > 0.1);

        // 3 quiet pre-roll frames, 2 loud frames (triggers speech with pre-roll), 3 quiet frames (ends speech)
        for (let i = 0; i < 3; i++) engine.processAudio(quietChunk24k, 'interviewer');
        for (let i = 0; i < 2; i++) engine.processAudio(loudChunk24k, 'interviewer');
        for (let i = 0; i < 3; i++) engine.processAudio(quietChunk24k, 'interviewer');

        await engine.transcriptionQueue;

        assert.equal(transcriptions.length, 1);
        assert.equal(transcriptions[0].text, 'Привіт, як справи?');
        assert.equal(transcriptions[0].source, 'interviewer');
        assert.equal(transcriptions[0].meta.language, 'ukrainian');
        assert.equal(transcriptions[0].meta.avgLogprob, -0.25);
        assert.equal(typeof transcriptions[0].meta.inferMs, 'number');
        assert.ok(transcriptions[0].meta.inferMs >= 0);
        assert.equal(requests.length, 1);

        // Multipart payload should contain Ukrainian language field, verbose_json, temperature_inc 0.0, no_timestamps, and WAV header
        const payloadText = requests[0].toString('latin1');
        assert.ok(payloadText.includes('RIFF'));
        assert.ok(payloadText.includes('name="response_format"\r\n\r\nverbose_json'));
        assert.ok(payloadText.includes('name="temperature_inc"\r\n\r\n0.0'));
        assert.ok(payloadText.includes('name="language"\r\n\r\nuk'));
        assert.ok(payloadText.includes('name="no_timestamps"\r\n\r\ntrue'));

        // Test 48kHz candidate audio input with maxSpeechBytes cap without silence frames
        const loudChunk48k = makePcmChunk(4800, 0.5, 48000);
        for (let i = 0; i < 6; i++) {
            engine.processAudio(loudChunk48k, 'candidate', 48000);
        }
        await engine.transcriptionQueue;

        assert.equal(transcriptions.length, 2);
        assert.equal(transcriptions[1].source, 'candidate');
    } finally {
        engine.stop();
        await new Promise(resolve => server.close(resolve));
    }
});

test('WhisperSttEngine drops excess segments when queue reaches maxPendingSegments', async () => {
    let releaseFirstRequest;
    const firstRequestGate = new Promise(resolve => {
        releaseFirstRequest = resolve;
    });
    let inferenceCalls = 0;

    const engine = new WhisperSttEngine({
        minSpeechBytes: 3200,
        maxPendingSegments: 1,
        ensureNativeBinary: async () => 'mock-whisper',
        ensureWhisperModel: async () => 'mock-model.bin',
        getAvailablePort: async () => 19999,
        startNativeServer: () => ({ exitCode: null, kill() {} }),
        stopNativeServer: () => {},
        waitForServer: async () => {},
        fetchImpl: async () => {
            inferenceCalls += 1;
            if (inferenceCalls === 1) {
                await firstRequestGate;
            }
            return {
                ok: true,
                json: async () => ({
                    text: 'Прийнято',
                    language: 'ukrainian',
                    segments: [{ avg_logprob: -0.2, no_speech_prob: 0.01 }],
                }),
            };
        },
    });

    const delivered = [];
    try {
        await engine.start({
            whisperModel: 'small-q5_1',
            language: 'uk-UA',
            onTranscription: async text => delivered.push(text),
        });

        const segment = Buffer.alloc(6400);
        engine._enqueueSegment(segment, 'interviewer');
        engine._enqueueSegment(segment, 'interviewer');
        engine._enqueueSegment(segment, 'interviewer');

        assert.equal(engine.pendingSegments, 1);

        releaseFirstRequest();
        await engine.transcriptionQueue;

        assert.equal(inferenceCalls, 1);
        assert.deepEqual(delivered, ['Прийнято']);
        assert.equal(engine.pendingSegments, 0);
    } finally {
        releaseFirstRequest?.();
        engine.stop();
    }
});

test('WhisperSttEngine retries with -ng (CPU mode) if Vulkan GPU server startup fails', async () => {
    const startCalls = [];
    let waitAttempts = 0;

    const engine = new WhisperSttEngine({
        ensureNativeBinary: async () => 'mock-whisper',
        ensureWhisperModel: async () => 'mock-model.bin',
        getAvailablePort: async () => 19998,
        startNativeServer: ({ arguments: args }) => {
            startCalls.push(args);
            return { exitCode: null, kill() {} };
        },
        stopNativeServer: () => {},
        waitForServer: async () => {
            waitAttempts += 1;
            if (waitAttempts === 1) {
                throw new Error('Vulkan device init failed');
            }
        },
    });

    try {
        await engine.start({
            whisperModel: 'small-q5_1',
            language: 'uk-UA',
        });

        assert.equal(engine.isActive, true);
        assert.equal(startCalls.length, 2);
        assert.equal(startCalls[0].includes('-ng'), false);
        assert.equal(startCalls[1].includes('-ng'), true);
    } finally {
        engine.stop();
    }
});

test('scripts/start-hidden helpers detect IDE environments and strip ELECTRON_RUN_AS_NODE', () => {
    const { isIdeEnvironment, buildElectronLaunchOptions } = require('../scripts/start-hidden');

    assert.equal(isIdeEnvironment({}), false);
    assert.equal(isIdeEnvironment({ VSCODE_PID: '1234' }), true);
    assert.equal(isIdeEnvironment({ TERM_PROGRAM: 'vscode' }), true);
    assert.equal(isIdeEnvironment({ KEEP_CONSOLE: '1' }), true);

    const opts = buildElectronLaunchOptions('C:\\workspace\\app', {
        PATH: 'C:\\Windows',
        ELECTRON_RUN_AS_NODE: '1',
    });
    assert.equal(opts.cwd, 'C:\\workspace\\app');
    assert.equal(opts.detached, true);
    assert.equal(opts.stdio, 'ignore');
    assert.equal(opts.windowsHide, true);
    assert.equal(opts.env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(opts.env.PATH, 'C:\\Windows');
});
