const os = require('os');
const {
    ensureNativeBinary,
    ensureWhisperModel,
    getAvailablePort,
    startNativeServer,
    stopNativeServer,
    waitForServer,
} = require('./native-ai-runtime');

const VAD_MODES = {
    NORMAL: { energyThreshold: 0.01, speechFramesRequired: 3, silenceFramesRequired: 30 },
    LOW_BITRATE: { energyThreshold: 0.008, speechFramesRequired: 4, silenceFramesRequired: 35 },
    BALANCED: { energyThreshold: 0.014, speechFramesRequired: 2, silenceFramesRequired: 8 },
    AGGRESSIVE: { energyThreshold: 0.015, speechFramesRequired: 2, silenceFramesRequired: 20 },
    VERY_AGGRESSIVE: { energyThreshold: 0.02, speechFramesRequired: 2, silenceFramesRequired: 15 },
};

const MAX_INITIAL_PROMPT_LENGTH = 400;

/** Cleans the user's vocabulary hints so they are safe to send to Whisper as an initial prompt. */
function sanitizeInitialPrompt(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_INITIAL_PROMPT_LENGTH);
}

const DEFAULT_PRE_ROLL_FRAMES = 6;
const DEFAULT_MIN_SPEECH_BYTES = 16000; // 0.5s at 16 kHz, 16-bit mono
const DEFAULT_MAX_SPEECH_BYTES = 16000 * 2 * 12; // 12s max segment (fits cleanly within -ac 640)
const DEFAULT_MAX_PENDING_SEGMENTS = 2;

const SPECIAL_LANGUAGE_CODES = {
    cmn: 'zh',
    zh: 'zh',
    iw: 'he',
    in: 'id',
    ji: 'yi',
};

function resample24kTo16k(inputBuffer, state = null) {
    if (!inputBuffer || inputBuffer.length === 0) {
        return Buffer.alloc(0);
    }

    const channelState = state || { remainder: Buffer.alloc(0) };
    const remainder = channelState.remainder && channelState.remainder.length > 0 ? channelState.remainder : Buffer.alloc(0);
    const combined = remainder.length > 0 ? Buffer.concat([remainder, inputBuffer]) : inputBuffer;
    const inputSamples = Math.floor(combined.length / 2);
    const blocks = Math.floor(inputSamples / 3);
    const outputSamples = blocks * 2;
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let b = 0; b < blocks; b++) {
        const base = b * 3;
        const s0 = combined.readInt16LE(base * 2);
        const s1 = combined.readInt16LE((base + 1) * 2);
        const s2 = combined.readInt16LE((base + 2) * 2);
        outputBuffer.writeInt16LE(s0, b * 4);
        const mid = Math.round((s1 + s2) / 2);
        outputBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, mid)), b * 4 + 2);
    }

    const consumedInputSamples = blocks * 3;
    const remainderStart = consumedInputSamples * 2;
    channelState.remainder = remainderStart < combined.length ? Buffer.from(combined.slice(remainderStart)) : Buffer.alloc(0);

    return outputBuffer;
}

function resample48kTo16k(inputBuffer, channelState) {
    const remainder = channelState.remainder && channelState.remainder.length > 0 ? channelState.remainder : Buffer.alloc(0);
    const combined = remainder.length > 0 ? Buffer.concat([remainder, inputBuffer]) : inputBuffer;
    const inputSamples = Math.floor(combined.length / 2);
    const outputSamples = Math.floor(inputSamples / 3);
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
        const base = i * 3;
        const s0 = combined.readInt16LE(base * 2);
        const s1 = combined.readInt16LE((base + 1) * 2);
        const s2 = combined.readInt16LE((base + 2) * 2);
        const avg = Math.round((s0 + s1 + s2) / 3);
        outputBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, avg)), i * 2);
    }

    const remainderStart = outputSamples * 3 * 2;
    channelState.remainder = remainderStart < combined.length ? Buffer.from(combined.slice(remainderStart)) : Buffer.alloc(0);
    return outputBuffer;
}

function resampleLinearTo16k(inputBuffer, inputSampleRate, channelState) {
    const remainder = channelState.remainder && channelState.remainder.length > 0 ? channelState.remainder : Buffer.alloc(0);
    const combined = remainder.length > 0 ? Buffer.concat([remainder, inputBuffer]) : inputBuffer;
    const inputSamples = Math.floor(combined.length / 2);
    if (inputSamples < 2) {
        channelState.remainder = Buffer.from(combined);
        return Buffer.alloc(0);
    }

    const step = inputSampleRate / 16000;
    let pos = Number.isFinite(channelState.phase) && channelState.phase >= 0 ? channelState.phase : 0;
    const out = [];

    while (pos + 1 < inputSamples) {
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const s0 = combined.readInt16LE(idx * 2);
        const s1 = combined.readInt16LE((idx + 1) * 2);
        const interpolated = Math.round(s0 + (s1 - s0) * frac);
        out.push(Math.max(-32768, Math.min(32767, interpolated)));
        pos += step;
    }

    const keepFrom = Math.min(inputSamples, Math.floor(pos));
    const remainderStart = keepFrom * 2;
    channelState.remainder = remainderStart < combined.length ? Buffer.from(combined.slice(remainderStart)) : Buffer.alloc(0);
    channelState.phase = pos - keepFrom;

    const outputBuffer = Buffer.alloc(out.length * 2);
    for (let i = 0; i < out.length; i++) {
        outputBuffer.writeInt16LE(out[i], i * 2);
    }
    return outputBuffer;
}

function resamplePcmTo16k(inputBuffer, inputSampleRate = 24000, state = null) {
    if (!inputBuffer || inputBuffer.length === 0) {
        return Buffer.alloc(0);
    }

    const rate = Number(inputSampleRate) > 0 ? Number(inputSampleRate) : 24000;
    const channelState = state || { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null };
    if (channelState.lastSampleRate && channelState.lastSampleRate !== rate) {
        channelState.remainder = Buffer.alloc(0);
        channelState.phase = 0;
    }
    channelState.lastSampleRate = rate;

    if (rate === 16000) {
        const remainder = channelState.remainder && channelState.remainder.length > 0 ? channelState.remainder : Buffer.alloc(0);
        const combined = remainder.length > 0 ? Buffer.concat([remainder, inputBuffer]) : inputBuffer;
        const evenBytes = combined.length - (combined.length % 2);
        channelState.remainder = evenBytes < combined.length ? Buffer.from(combined.slice(evenBytes)) : Buffer.alloc(0);
        return evenBytes === combined.length ? combined : combined.slice(0, evenBytes);
    }

    if (rate === 24000) {
        return resample24kTo16k(inputBuffer, channelState);
    }

    if (rate === 48000) {
        return resample48kTo16k(inputBuffer, channelState);
    }

    return resampleLinearTo16k(inputBuffer, rate, channelState);
}

function calculateRms(pcm16Buffer) {
    const samples = Math.floor(pcm16Buffer.length / 2);
    if (samples === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < samples; i++) {
        const sample = pcm16Buffer.readInt16LE(i * 2) / 32768;
        sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / samples);
}

function createWavBuffer(pcm16Buffer) {
    const header = Buffer.alloc(44);
    const byteRate = 16000 * 2;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm16Buffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm16Buffer.length, 40);

    return Buffer.concat([header, pcm16Buffer]);
}

function mapSpeechLanguageToWhisper(selectedLanguage, whisperModel = '') {
    if (typeof whisperModel === 'string' && whisperModel.trim().endsWith('.en')) {
        return 'en';
    }

    if (!selectedLanguage || typeof selectedLanguage !== 'string') {
        return 'auto';
    }

    const normalized = selectedLanguage.trim().toLowerCase();
    if (!normalized || normalized === 'auto') {
        return 'auto';
    }

    const primary = normalized.split(/[-_]/)[0];
    if (SPECIAL_LANGUAGE_CODES[primary]) {
        return SPECIAL_LANGUAGE_CODES[primary];
    }

    if (primary.length === 2 || primary === 'yue') {
        return primary;
    }

    return 'auto';
}

function isNoiseOrHallucination(text) {
    if (!text || typeof text !== 'string') {
        return true;
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
        return true;
    }

    if (/^[\s\p{P}\p{S}]+$/u.test(trimmed)) {
        return true;
    }

    // Filter common whisper.cpp silence/non-speech annotations without dropping valid short words
    if (
        /^(?:\[[^\]]*\]|\([^)]*\)|♪+|thanks for watching[.!]?|thank you for watching[.!]?|дякую за перегляд[.!]?|дякую за увагу[.!]?|підписуйтесь на канал[.!]?|субтитри.*)$/iu.test(
            trimmed
        )
    ) {
        return true;
    }

    return false;
}

function isLowConfidenceWhisperResult(result) {
    if (!result || typeof result !== 'object') {
        return false;
    }

    if (!Array.isArray(result.segments) || result.segments.length === 0) {
        return false;
    }

    const segments = result.segments;
    const logprobs = segments.map(seg => seg?.avg_logprob).filter(val => typeof val === 'number');
    const meanLogprob = logprobs.length > 0 ? logprobs.reduce((sum, val) => sum + val, 0) / logprobs.length : null;
    const allNoSpeech = segments.every(seg => typeof seg?.no_speech_prob === 'number' && seg.no_speech_prob >= 0.75);

    // High no_speech_prob alone is unreliable when avg_logprob is confident (> -1.0)
    if (allNoSpeech && (meanLogprob === null || meanLogprob <= -1.0)) {
        return true;
    }

    if (meanLogprob !== null && meanLogprob <= -1.8 && String(result.text || '').trim().length < 40) {
        return true;
    }

    return false;
}

class WhisperSttEngine {
    constructor(deps = {}) {
        this.runtime = {
            ensureNativeBinary: deps.ensureNativeBinary || ensureNativeBinary,
            ensureWhisperModel: deps.ensureWhisperModel || ensureWhisperModel,
            getAvailablePort: deps.getAvailablePort || getAvailablePort,
            startNativeServer: deps.startNativeServer || startNativeServer,
            stopNativeServer: deps.stopNativeServer || stopNativeServer,
            waitForServer: deps.waitForServer || waitForServer,
        };
        this.fetchImpl = deps.fetchImpl || global.fetch;
        this.preRollFrames = deps.preRollFrames ?? DEFAULT_PRE_ROLL_FRAMES;
        this.minSpeechBytes = deps.minSpeechBytes ?? DEFAULT_MIN_SPEECH_BYTES;
        this.maxSpeechBytes = deps.maxSpeechBytes ?? DEFAULT_MAX_SPEECH_BYTES;
        this.maxPendingSegments = deps.maxPendingSegments ?? DEFAULT_MAX_PENDING_SEGMENTS;
        this.enableWarmup = deps.enableWarmup ?? !deps.startNativeServer;

        this.whisperProcess = null;
        this.whisperBaseUrl = null;
        this.isActive = false;
        this.whisperLanguage = 'auto';
        this.initialPrompt = '';
        this.vadConfig = VAD_MODES.VERY_AGGRESSIVE;
        this.onStatus = null;
        this.onTranscription = null;
        this.onFiltered = null;
        this.channels = new Map();
        this.transcriptionQueue = Promise.resolve();
        this.pendingSegments = 0;
        this.generation = 0;
    }

    _getChannelState(source) {
        const key = source === 'candidate' ? 'candidate' : 'interviewer';
        if (!this.channels.has(key)) {
            this.channels.set(key, {
                resampleState: { remainder: Buffer.alloc(0), phase: 0, lastSampleRate: null },
                loggedSampleRate: false,
                isSpeaking: false,
                preSpeechFrames: [],
                speechBuffers: [],
                speechBytes: 0,
                speechFrameCount: 0,
                silenceFrameCount: 0,
            });
        }
        return this.channels.get(key);
    }

    async prepareFiles(whisperModel, { onProgress, onDownloadingChange, signal } = {}) {
        const binaryProgress = label => progress => {
            this.onStatus?.(this._formatDownloadStatus(label, progress));
            onProgress?.(label, progress);
        };

        onProgress?.('Checking Whisper runner', null);
        const whisperBinaryPath = await this.runtime.ensureNativeBinary('whisper', binaryProgress('Whisper runner'), signal);

        let whisperModelPath;
        onDownloadingChange?.(true);
        try {
            onProgress?.('Checking Whisper model', null);
            whisperModelPath = await this.runtime.ensureWhisperModel(whisperModel, binaryProgress('Whisper model'), signal);
        } finally {
            onDownloadingChange?.(false);
        }

        return { whisperBinaryPath, whisperModelPath };
    }

    _formatDownloadStatus(label, progress) {
        if (!progress?.expectedBytes) {
            return `Downloading ${label}...`;
        }
        const percentage = Math.floor((progress.downloadedBytes / progress.expectedBytes) * 100);
        return `Downloading ${label}... ${percentage}%`;
    }

    async start({
        whisperModel = 'small-q5_1',
        language = 'auto',
        initialPrompt = '',
        vadMode = VAD_MODES.VERY_AGGRESSIVE,
        onStatus = null,
        onProgress = null,
        onDownloadingChange = null,
        onTranscription = null,
        onFiltered = null,
        signal = null,
        preparedFiles = null,
    } = {}) {
        this.stop();

        this.onStatus = onStatus;
        this.onTranscription = onTranscription;
        this.onFiltered = onFiltered;
        this.vadConfig = vadMode || VAD_MODES.VERY_AGGRESSIVE;
        this.whisperLanguage = mapSpeechLanguageToWhisper(language, whisperModel);
        this.initialPrompt = sanitizeInitialPrompt(initialPrompt);

        const files =
            preparedFiles ||
            (await this.prepareFiles(whisperModel, {
                onProgress,
                onDownloadingChange,
                signal,
            }));

        if (signal?.aborted) {
            const abortError = new Error('Whisper initialization cancelled');
            abortError.name = 'AbortError';
            throw abortError;
        }

        this.onStatus?.('Starting Whisper...');
        onProgress?.('Starting Whisper', null);

        const port = await this.runtime.getAvailablePort();
        this.whisperBaseUrl = `http://127.0.0.1:${port}`;
        const threadCount = Math.min(8, Math.max(4, Math.floor((os.cpus()?.length || 4) / 2)));
        const buildWhisperArgs = (useGpu = true) => {
            const args = [
                '-m',
                files.whisperModelPath,
                '--host',
                '127.0.0.1',
                '--port',
                String(port),
                '-t',
                String(threadCount),
                '-l',
                this.whisperLanguage || 'auto',
                '-nf',
                '-bo',
                '1',
                '-ac',
                '640',
                '--suppress-nst',
                '--no-timestamps',
            ];
            if (!useGpu) {
                args.push('-ng');
            }
            return args;
        };

        const currentGen = this.generation;
        const launchAndWait = async useGpu => {
            this.whisperProcess = this.runtime.startNativeServer({
                executablePath: files.whisperBinaryPath,
                arguments: buildWhisperArgs(useGpu),
                name: 'Whisper',
            });

            await this.runtime.waitForServer(`${this.whisperBaseUrl}/`, this.whisperProcess, 120000);
        };

        try {
            await launchAndWait(true);
        } catch (gpuStartError) {
            if (signal?.aborted) {
                throw gpuStartError;
            }
            console.warn('[WhisperSTT] GPU/Vulkan startup failed, retrying with CPU (-ng):', gpuStartError.message);
            this.runtime.stopNativeServer(this.whisperProcess);
            this.whisperProcess = null;
            await launchAndWait(false);
        }

        if (signal?.aborted || this.generation !== currentGen) {
            this.runtime.stopNativeServer(this.whisperProcess);
            this.whisperProcess = null;
            const abortError = new Error('Whisper initialization cancelled');
            abortError.name = 'AbortError';
            throw abortError;
        }

        this.isActive = true;
        if (this.enableWarmup) {
            this._scheduleWarmup(currentGen);
        }
    }

    _scheduleWarmup(expectedGen) {
        this.transcriptionQueue = this.transcriptionQueue
            .then(async () => {
                if (!this.isActive || this.generation !== expectedGen || !this.whisperBaseUrl) {
                    return;
                }
                const startedAt = Date.now();
                await this._transcribeAudioDetailed(Buffer.alloc(16000));
                console.log(`[WhisperSTT] Warmup completed in ${Date.now() - startedAt} ms`);
            })
            .catch(error => {
                if (this.isActive && this.generation === expectedGen) {
                    console.warn('[WhisperSTT] Non-fatal warmup error:', error.message);
                }
            });
    }

    processAudio(monoChunk, source = 'interviewer', inputSampleRate = 24000) {
        if (!this.isActive || !monoChunk || monoChunk.length === 0) {
            return;
        }

        const channel = this._getChannelState(source);
        const effectiveRate = Number(inputSampleRate) > 0 ? Number(inputSampleRate) : 24000;
        if (!channel.loggedSampleRate) {
            channel.loggedSampleRate = true;
            console.log(
                `[WhisperSTT] Audio stream "${source}" initialized at ${effectiveRate} Hz (whisper language: ${this.whisperLanguage || 'auto'})`
            );
        }

        const pcm16k = resamplePcmTo16k(monoChunk, effectiveRate, channel.resampleState);
        if (pcm16k.length > 0) {
            this.processChannelAudio(pcm16k, source);
        }
    }

    processChannelAudio(pcm16kBuffer, source = 'interviewer') {
        if (!this.isActive || !pcm16kBuffer || pcm16kBuffer.length === 0) {
            return;
        }

        const channel = this._getChannelState(source);
        const rms = calculateRms(pcm16kBuffer);
        const isVoice = rms > this.vadConfig.energyThreshold;

        if (channel.isSpeaking) {
            channel.speechBuffers.push(Buffer.from(pcm16kBuffer));
            channel.speechBytes += pcm16kBuffer.length;

            if (isVoice) {
                channel.silenceFrameCount = 0;
            } else {
                channel.silenceFrameCount += 1;
            }

            if (channel.silenceFrameCount >= this.vadConfig.silenceFramesRequired || channel.speechBytes >= this.maxSpeechBytes) {
                this._finalizeChannelSegment(channel, source);
            }
            return;
        }

        channel.preSpeechFrames.push(Buffer.from(pcm16kBuffer));
        if (channel.preSpeechFrames.length > this.preRollFrames) {
            channel.preSpeechFrames.shift();
        }

        if (isVoice) {
            channel.speechFrameCount += 1;
            channel.silenceFrameCount = 0;

            if (channel.speechFrameCount >= this.vadConfig.speechFramesRequired) {
                channel.isSpeaking = true;
                channel.speechBuffers = channel.preSpeechFrames.slice();
                channel.speechBytes = channel.speechBuffers.reduce((sum, buf) => sum + buf.length, 0);
                channel.preSpeechFrames = [];
                console.log(`[WhisperSTT] Speech started on ${source} (RMS: ${rms.toFixed(4)})`);
                this.onStatus?.('Listening... (speech detected)');
            }
        } else {
            channel.speechFrameCount = 0;
            channel.silenceFrameCount += 1;
        }
    }

    _finalizeChannelSegment(channel, source) {
        channel.isSpeaking = false;
        channel.speechFrameCount = 0;
        channel.silenceFrameCount = 0;
        const audioData = Buffer.concat(channel.speechBuffers);
        channel.speechBuffers = [];
        channel.speechBytes = 0;

        console.log(`[WhisperSTT] Speech ended on ${source}, accumulated ${audioData.length} bytes`);
        this._enqueueSegment(audioData, source);
    }

    _enqueueSegment(audioData, source) {
        const currentGen = this.generation;
        if (audioData.length < this.minSpeechBytes) {
            console.log(`[WhisperSTT] Audio too short on ${source} (${audioData.length} bytes), skipping`);
            this.onStatus?.('Listening...');
            return;
        }

        if (this.pendingSegments >= this.maxPendingSegments) {
            console.warn(`[WhisperSTT] Queue saturated (${this.pendingSegments} pending), dropping segment on ${source}`);
            return;
        }

        this.pendingSegments += 1;
        this.onStatus?.('Transcribing...');
        this.transcriptionQueue = this.transcriptionQueue
            .then(async () => {
                if (!this.isActive || this.generation !== currentGen) {
                    return;
                }

                const { text, raw, meta } = await this._transcribeAudioDetailed(audioData);
                if (!this.isActive || this.generation !== currentGen) {
                    return;
                }

                if (isLowConfidenceWhisperResult(raw)) {
                    console.log('[WhisperSTT] Filtered low-confidence hallucination:', JSON.stringify(text), meta);
                    this.onFiltered?.({ text, source, reason: 'low_confidence', meta });
                    this.onStatus?.('Listening...');
                    return;
                }

                if (isNoiseOrHallucination(text)) {
                    console.log('[WhisperSTT] Filtered empty or noise transcription:', JSON.stringify(text));
                    this.onFiltered?.({ text, source, reason: 'noise_or_hallucination', meta });
                    this.onStatus?.('Listening...');
                    return;
                }

                if (this.onTranscription) {
                    await this.onTranscription(text.trim(), source, meta);
                }
            })
            .catch(error => {
                if (this.isActive && this.generation === currentGen) {
                    console.error('[WhisperSTT] Transcription error:', error);
                    this.onStatus?.('Transcription error: ' + error.message);
                }
            })
            .finally(() => {
                if (this.generation === currentGen) {
                    this.pendingSegments = Math.max(0, this.pendingSegments - 1);
                }
            });
    }

    async _transcribeAudioDetailed(pcm16kBuffer) {
        if (!this.whisperBaseUrl) {
            throw new Error('Whisper server is not running');
        }

        const wavBuffer = createWavBuffer(pcm16kBuffer);
        const formData = new FormData();
        formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'speech.wav');
        formData.append('response_format', 'verbose_json');
        formData.append('temperature', '0.0');
        formData.append('temperature_inc', '0.0');
        formData.append('no_timestamps', 'true');
        formData.append('language', this.whisperLanguage || 'auto');
        if (this.initialPrompt) {
            formData.append('prompt', this.initialPrompt);
        }

        const startedAt = Date.now();
        const response = await this.fetchImpl(`${this.whisperBaseUrl}/inference`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Whisper server returned HTTP ${response.status}`);
        }

        const result = await response.json();
        const inferMs = Date.now() - startedAt;
        const text = result.text?.trim() || '';
        const segments = Array.isArray(result.segments) ? result.segments : [];
        const logprobs = segments.map(s => s?.avg_logprob).filter(v => typeof v === 'number');
        const noSpeechProbs = segments.map(s => s?.no_speech_prob).filter(v => typeof v === 'number');
        const meta = {
            inferMs,
            language: result.language || this.whisperLanguage || 'auto',
            detectedLanguage: result.detected_language || null,
            detectedLanguageProbability: typeof result.detected_language_probability === 'number' ? result.detected_language_probability : null,
            avgLogprob: logprobs.length > 0 ? Number((logprobs.reduce((a, b) => a + b, 0) / logprobs.length).toFixed(3)) : null,
            noSpeechProb: noSpeechProbs.length > 0 ? Number((noSpeechProbs.reduce((a, b) => a + b, 0) / noSpeechProbs.length).toFixed(3)) : null,
        };

        const detectedPart = meta.detectedLanguage ? `, detected=${meta.detectedLanguage}` : '';
        const logprobPart = meta.avgLogprob !== null ? `, avgLogprob=${meta.avgLogprob}` : '';
        console.log(`[WhisperSTT] Transcription (${inferMs} ms): ${text} (lang=${meta.language}${detectedPart}${logprobPart})`);
        return { text, raw: result, meta };
    }

    async transcribeAudio(pcm16kBuffer) {
        const detailed = await this._transcribeAudioDetailed(pcm16kBuffer);
        return detailed.text;
    }

    stop() {
        this.generation += 1;
        this.isActive = false;
        this.runtime.stopNativeServer(this.whisperProcess);
        this.whisperProcess = null;
        this.whisperBaseUrl = null;
        this.channels.clear();
        this.transcriptionQueue = Promise.resolve();
        this.pendingSegments = 0;
        this.onStatus = null;
        this.onTranscription = null;
        this.onFiltered = null;
    }
}

module.exports = {
    VAD_MODES,
    WhisperSttEngine,
    resample24kTo16k,
    resamplePcmTo16k,
    calculateRms,
    createWavBuffer,
    mapSpeechLanguageToWhisper,
    isNoiseOrHallucination,
    isLowConfidenceWhisperResult,
    sanitizeInitialPrompt,
};
