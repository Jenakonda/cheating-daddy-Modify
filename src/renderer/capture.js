// Capturing screen and audio, streaming it to the main process, and handling session shortcuts.
const { ipcRenderer } = require('electron');
const { storage, loadPreferencesCache, getPreferencesCache } = require('./storage');
const { convertFloat32ToInt16, arrayBufferToBase64, buildManualScreenshotPrompt, createPcmChunker } = require('../utils/capture-utils');

let mediaStream = null;
let micMediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let micAudioContext = null;
let audioSourceNode = null;
let micSourceNode = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioGainNode = null;
let micGainNode = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1; // seconds
const BUFFER_SIZE = 4096; // Increased buffer size for smoother audio

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    window.cheatingDaddy.setStatus(status);
});

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Refresh preferences cache
    await loadPreferencesCache();
    const audioMode = getPreferencesCache().audioMode || 'speaker_only';

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            console.log('macOS screen capture started - audio handled by SystemAudioDump');

            if (audioMode === 'mic_only' || audioMode === 'both') {
                try {
                    micMediaStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('macOS microphone capture started');
                    setupLinuxMicProcessing(micMediaStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on macOS:', micError);
                }
            }
        } else if (isLinux) {
            const captureSystemAudio = audioMode === 'speaker_only' || audioMode === 'both';

            if (captureSystemAudio) {
                // Linux - use display media for screen capture and try to get system audio
                try {
                    // First try to get system audio via getDisplayMedia (works on newer browsers)
                    mediaStream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            frameRate: 1,
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                        },
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: false, // Don't cancel system audio
                            noiseSuppression: false,
                            autoGainControl: false,
                        },
                    });

                    console.log('Linux system audio capture via getDisplayMedia succeeded');

                    // Setup audio processing for Linux system audio
                    setupLinuxSystemAudioProcessing();
                } catch (systemAudioError) {
                    console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                    // Fallback to screen-only capture
                    mediaStream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            frameRate: 1,
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                        },
                        audio: false,
                    });
                }
            } else {
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

            // Additionally get microphone input for Linux based on audio mode
            if (audioMode === 'mic_only' || audioMode === 'both') {
                try {
                    micMediaStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    console.log('Linux microphone capture started');

                    // Setup audio processing for microphone on Linux
                    setupLinuxMicProcessing(micMediaStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            const captureSystemAudio = audioMode === 'speaker_only' || audioMode === 'both';

            // Windows - use display media for screen capture (plus loopback audio when capturing speaker output)
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: captureSystemAudio
                    ? {
                          sampleRate: SAMPLE_RATE,
                          channelCount: 1,
                          echoCancellation: false,
                          noiseSuppression: false,
                          autoGainControl: false,
                      }
                    : false,
            });

            if (captureSystemAudio) {
                if (mediaStream.getAudioTracks().length > 0) {
                    console.log('Windows capture started with loopback audio');
                    setupWindowsLoopbackProcessing();
                } else {
                    console.warn('Windows loopback capture requested, but no system audio track was returned');
                }
            } else {
                console.log('Windows screen capture started (mic_only mode, loopback audio skipped)');
            }

            if (audioMode === 'mic_only' || audioMode === 'both') {
                try {
                    micMediaStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('Windows microphone capture started');
                    setupLinuxMicProcessing(micMediaStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Manual mode only - screenshots captured on demand via shortcut
        console.log('Manual mode enabled - screenshots will be captured on demand only');
    } catch (err) {
        console.error('Error starting capture:', err);
        window.cheatingDaddy.setStatus('error');
    }
}

function setupPcmStreamProcessing(stream, ipcChannel, { label, onInit }) {
    if (!stream || stream.getAudioTracks().length === 0) {
        console.warn(`[Audio] ${label} skipped: stream has no audio track`);
        return;
    }

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const actualSampleRate = ctx.sampleRate || SAMPLE_RATE;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    const samplesPerChunk = Math.max(1, Math.round(actualSampleRate * AUDIO_CHUNK_DURATION));
    const chunker = createPcmChunker(samplesPerChunk);
    const mimeType = `audio/pcm;rate=${actualSampleRate}`;

    console.log(`[Audio] ${label} initialized (requested ${SAMPLE_RATE} Hz, actual ${actualSampleRate} Hz, chunk ${samplesPerChunk} samples)`);

    processor.onaudioprocess = e => {
        // Chunks come out in strict FIFO order, one IPC message per chunk
        for (const pcmData16 of chunker.push(e.inputBuffer.getChannelData(0))) {
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            ipcRenderer
                .invoke(ipcChannel, {
                    data: base64Data,
                    mimeType,
                    sampleRate: actualSampleRate,
                })
                .catch(err => console.error(`[Audio] ${label} IPC error:`, err));
        }
    };

    // Route through a muted GainNode so ScriptProcessor stays active without playing audio back
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    onInit({ ctx, source, processor, gainNode: silentGain });
}

function setupLinuxMicProcessing(micStream) {
    setupPcmStreamProcessing(micStream, 'send-mic-audio-content', {
        label: 'Microphone capture',
        onInit: ({ ctx, source, processor, gainNode }) => {
            micAudioContext = ctx;
            micSourceNode = source;
            micAudioProcessor = processor;
            micGainNode = gainNode;
        },
    });
}

function setupLinuxSystemAudioProcessing() {
    setupPcmStreamProcessing(mediaStream, 'send-audio-content', {
        label: 'Linux system audio capture',
        onInit: ({ ctx, source, processor, gainNode }) => {
            audioContext = ctx;
            audioSourceNode = source;
            audioProcessor = processor;
            audioGainNode = gainNode;
        },
    });
}

function setupWindowsLoopbackProcessing() {
    setupPcmStreamProcessing(mediaStream, 'send-audio-content', {
        label: 'Windows loopback audio capture',
        onInit: ({ ctx, source, processor, gainNode }) => {
            audioContext = ctx;
            audioSourceNode = source;
            audioProcessor = processor;
            audioGainNode = gainNode;
        },
    });
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) return;

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                // Validate base64 data
                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    return;
                }

                const result = await ipcRenderer.invoke('send-image-content', {
                    data: base64data,
                });

                if (result.success) {
                    console.log(`Image sent successfully (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                } else {
                    console.error('Failed to send image:', result.error);
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');
    const quality = imageQuality || currentImageQuality;

    if (!mediaStream) {
        console.error('No media stream available');
        return;
    }

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    // Downscale to max 1280px wide for faster transfer — vision models don't need 4K
    const MAX_WIDTH = 1280;
    const srcW = hiddenVideo.videoWidth;
    const srcH = hiddenVideo.videoHeight;
    let destW = srcW;
    let destH = srcH;
    if (srcW > MAX_WIDTH) {
        destW = MAX_WIDTH;
        destH = Math.round(srcH * (MAX_WIDTH / srcW));
    }
    offscreenCanvas.width = destW;
    offscreenCanvas.height = destH;
    offscreenContext.drawImage(hiddenVideo, 0, 0, destW, destH);

    let qualityValue;
    switch (quality) {
        case 'high':
            qualityValue = 0.85;
            break;
        case 'medium':
            qualityValue = 0.6;
            break;
        case 'low':
            qualityValue = 0.4;
            break;
        default:
            qualityValue = 0.6;
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    return;
                }

                console.log(`Sending image: ${destW}x${destH}, ~${Math.round(base64data.length / 1024)}KB`);

                const manualPrompt = buildManualScreenshotPrompt(getPreferencesCache()?.responseLanguage || 'auto');

                // Send image with prompt to HTTP API (response streams via IPC events)
                const result = await ipcRenderer.invoke('send-image-content', {
                    data: base64data,
                    prompt: manualPrompt,
                });

                if (result.success) {
                    console.log(`Image response completed from ${result.model}`);
                    // Response already displayed via streaming events (new-response/update-response)
                } else {
                    console.error('Failed to get image response:', result.error);
                    window.cheatingDaddy.addNewResponse(`Error: ${result.error}`);
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioSourceNode) {
        audioSourceNode.disconnect();
        audioSourceNode = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioGainNode) {
        audioGainNode.disconnect();
        audioGainNode = null;
    }

    // Clean up microphone audio source, processor, and gain node
    if (micSourceNode) {
        micSourceNode.disconnect();
        micSourceNode = null;
    }

    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (micGainNode) {
        micGainNode.disconnect();
        micGainNode = null;
    }

    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }

    if (micAudioContext) {
        micAudioContext.close().catch(() => {});
        micAudioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (micMediaStream) {
        micMediaStream.getTracks().forEach(track => track.stop());
        micMediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Listen for conversation data from main process and save to storage
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, { conversationHistory: data.fullHistory });
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Listen for session context (profile info) when session starts
ipcRenderer.on('save-session-context', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, {
            profile: data.profile,
            customPrompt: data.customPrompt,
        });
        console.log('Session context saved:', data.sessionId, 'profile:', data.profile);
    } catch (error) {
        console.error('Error saving session context:', error);
    }
});

// Listen for screen analysis responses (from ctrl+enter)
ipcRenderer.on('save-screen-analysis', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, {
            screenAnalysisHistory: data.fullHistory,
            profile: data.profile,
            customPrompt: data.customPrompt,
        });
        console.log('Screen analysis saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving screen analysis:', error);
    }
});

// Listen for emergency erase command from main process
ipcRenderer.on('clear-sensitive-data', async () => {
    console.log('Clearing all data...');
    await storage.clearAll();
});

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    const currentView = window.cheatingDaddy.getCurrentView();

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            window.cheatingDaddy.element().handleStart();
        } else {
            const assistantView = window.cheatingDaddy.element()?.shadowRoot?.querySelector('assistant-view');
            if (assistantView && typeof assistantView.handleScreenAnswer === 'function') {
                assistantView.handleScreenAnswer();
            } else {
                captureManualScreenshot();
            }
        }
    }
}

module.exports = { startCapture, stopCapture, sendTextMessage, handleShortcut, captureManualScreenshot, isLinux, isMacOS };
