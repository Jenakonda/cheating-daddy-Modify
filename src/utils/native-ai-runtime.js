const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { getConfigDir } = require('../storage');

const RELEASE_BASE_URL = 'https://github.com/sohzm/cheating-daddy/releases/download/v0.7.0';

const BINARY_RELEASES = {
    darwin: {
        arm64: {
            llama: {
                filename: 'llama-server-macos-arm64',
                sha256: 'edde3d15ee30a96abf09b99ce5ffe3ffd1c20dd484b380edd3c623c9b66ab6d5',
            },
            whisper: {
                filename: 'whisper-server-macos-arm64',
                sha256: '870093560fd80b4637dd900b880dc3566f17c809ae513ff653b265da13f41736',
            },
        },
        x64: {
            llama: {
                filename: 'llama-server-macos-x86_64',
                sha256: '728e4122b8ec9272d8b430cf0be44b6194ca3a21f531c1ae6f778e2174545a10',
            },
            whisper: {
                filename: 'whisper-server-macos-x86_64',
                sha256: '038099749adb67722133dba0daf41405dac57378b2e82d149b89e9fc39693ba9',
            },
        },
    },
    win32: {
        x64: {
            llama: {
                filename: 'llama-server-windows-x86_64.exe',
                sha256: '7dcdb6ae66c8a03f43d412f2fac00382b927a8d2d817d22b231c14a326cdc862',
            },
            whisper: {
                archiveFilename: 'whisper-b5907-blas-x64.zip',
                archiveUrl: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5907/whisper-blas-bin-x64.zip',
                sha256: '98a4691eb23a3a2afe91b0773bea5b2b4bcd5e7432a49e588724e84268711f11',
                extractDir: 'whisper-b5907-blas-x64',
                executableRelativePath: path.join('Release', 'whisper-server.exe'),
                vulkanAddon: {
                    archiveFilename: 'llama-b12584-bin-win-vulkan-x64.zip',
                    archiveUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b12584/llama-b12584-bin-win-vulkan-x64.zip',
                    sha256: '362094a7b2ed5df7c1146238a848356686703794621f1088ef12976719562fbe',
                    dllName: 'ggml-vulkan.dll',
                },
            },
        },
    },
};

const WHISPER_MODELS = {
    tiny: {
        filename: 'ggml-tiny.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    },
    'base-q5_1': {
        filename: 'ggml-base-q5_1.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
        sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
    },
    base: {
        filename: 'ggml-base.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    },
    'small-q5_1': {
        filename: 'ggml-small-q5_1.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin',
        sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
    },
    small: {
        filename: 'ggml-small.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    },
    'large-v3-turbo-q5_0': {
        filename: 'ggml-large-v3-turbo-q5_0.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
        sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    },
    'tiny.en': {
        filename: 'ggml-tiny.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
        sha256: '921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f',
    },
    'base.en': {
        filename: 'ggml-base.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
        sha256: 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002',
    },
    'small.en': {
        filename: 'ggml-small.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
        sha256: 'c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d',
    },
};

function getPlatformReleases() {
    const platformReleases = BINARY_RELEASES[process.platform]?.[process.arch];
    if (!platformReleases) {
        throw new Error(`Local AI is not available for ${process.platform}/${process.arch}`);
    }
    return platformReleases;
}

function getBinariesDirectory() {
    return path.join(getConfigDir(), 'binaries');
}

function getModelsDirectory() {
    return path.join(getConfigDir(), 'models');
}

async function calculateSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(filePath);
        input.on('error', reject);
        input.on('data', chunk => hash.update(chunk));
        input.on('end', () => resolve(hash.digest('hex')));
    });
}

async function fileMatchesChecksum(filePath, expectedSha256) {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const actualSha256 = await calculateSha256(filePath);
    return actualSha256 === expectedSha256;
}

async function downloadFile(url, destinationPath, onProgress, signal) {
    const temporaryPath = `${destinationPath}.download-${process.pid}-${Date.now()}`;
    const response = await fetch(url, { redirect: 'follow', signal });

    if (!response.ok || !response.body) {
        throw new Error(`Download failed with HTTP ${response.status}: ${url}`);
    }

    const expectedBytes = Number(response.headers.get('content-length')) || 0;
    let downloadedBytes = 0;

    try {
        const input = Readable.fromWeb(response.body);
        const progressStream = new Transform({
            transform(chunk, encoding, callback) {
                downloadedBytes += chunk.length;
                onProgress?.({ downloadedBytes, expectedBytes });
                callback(null, chunk);
            },
        });
        await pipeline(input, progressStream, fs.createWriteStream(temporaryPath, { flags: 'wx' }));

        return temporaryPath;
    } catch (error) {
        fs.rmSync(temporaryPath, { force: true });
        throw error;
    }
}

async function installVerifiedFile({ url, destinationPath, sha256, executable, onProgress, signal }) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

    if (await fileMatchesChecksum(destinationPath, sha256)) {
        if (executable && process.platform !== 'win32') {
            fs.chmodSync(destinationPath, 0o755);
        }
        return destinationPath;
    }

    const temporaryPath = await downloadFile(url, destinationPath, onProgress, signal);
    const downloadedSha256 = await calculateSha256(temporaryPath);

    if (downloadedSha256 !== sha256) {
        fs.rmSync(temporaryPath, { force: true });
        throw new Error(`Checksum verification failed for ${path.basename(destinationPath)}`);
    }

    fs.rmSync(destinationPath, { force: true });
    fs.renameSync(temporaryPath, destinationPath);

    if (executable && process.platform !== 'win32') {
        fs.chmodSync(destinationPath, 0o755);
    }

    return destinationPath;
}

async function extractZipArchive(zipPath, destinationDir, signal) {
    fs.mkdirSync(destinationDir, { recursive: true });
    await new Promise((resolve, reject) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:CD_ZIP_SRC -DestinationPath $env:CD_ZIP_DST -Force'],
            {
                env: {
                    ...process.env,
                    CD_ZIP_SRC: zipPath,
                    CD_ZIP_DST: destinationDir,
                },
                windowsHide: true,
                signal,
            },
            error => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            }
        );
    });
}

function hasVulkanRuntime() {
    return process.platform === 'win32' && fs.existsSync(path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'vulkan-1.dll'));
}

function findFileRecursive(rootDir, filename) {
    if (!fs.existsSync(rootDir)) {
        return null;
    }

    const targetLower = filename.toLowerCase();
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === targetLower) {
            return fullPath;
        }
        if (entry.isDirectory()) {
            const nested = findFileRecursive(fullPath, filename);
            if (nested) {
                return nested;
            }
        }
    }

    return null;
}

async function ensureVulkanBackendAddon(releaseDir, vulkanAddon, onProgress, signal) {
    const targetDll = path.join(releaseDir, vulkanAddon.dllName);
    const markerPath = path.join(releaseDir, '.vulkan-sha256');

    if (fs.existsSync(targetDll) && fs.existsSync(markerPath) && fs.readFileSync(markerPath, 'utf8').trim() === vulkanAddon.sha256) {
        return true;
    }

    const archivePath = path.join(getBinariesDirectory(), vulkanAddon.archiveFilename);
    const tempExtractDir = path.join(getBinariesDirectory(), `.vulkan-extract-${process.pid}-${Date.now()}`);

    try {
        await installVerifiedFile({
            url: vulkanAddon.archiveUrl,
            destinationPath: archivePath,
            sha256: vulkanAddon.sha256,
            executable: false,
            onProgress,
            signal,
        });

        await extractZipArchive(archivePath, tempExtractDir, signal);
        const foundDllPath = findFileRecursive(tempExtractDir, vulkanAddon.dllName);
        if (!foundDllPath) {
            throw new Error(`Vulkan addon archive did not contain ${vulkanAddon.dllName}`);
        }

        fs.copyFileSync(foundDllPath, targetDll);
        fs.writeFileSync(markerPath, vulkanAddon.sha256, 'utf8');
        return true;
    } finally {
        try {
            fs.rmSync(tempExtractDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 });
        } catch {
            // Ignore cleanup failure
        }
        try {
            fs.rmSync(archivePath, { force: true });
        } catch {
            // Ignore cleanup failure
        }
    }
}

async function ensureNativeBinary(type, onProgress, signal) {
    const release = getPlatformReleases()[type];
    if (release.archiveUrl) {
        const extractDir = path.join(getBinariesDirectory(), release.extractDir);
        const executablePath = path.join(extractDir, release.executableRelativePath);
        const markerPath = path.join(extractDir, '.verified-sha256');
        const alreadyInstalled =
            fs.existsSync(executablePath) && fs.existsSync(markerPath) && fs.readFileSync(markerPath, 'utf8').trim() === release.sha256;

        if (!alreadyInstalled) {
            const archivePath = path.join(getBinariesDirectory(), release.archiveFilename);
            await installVerifiedFile({
                url: release.archiveUrl,
                destinationPath: archivePath,
                sha256: release.sha256,
                executable: false,
                onProgress,
                signal,
            });

            fs.rmSync(extractDir, { recursive: true, force: true });
            await extractZipArchive(archivePath, extractDir, signal);

            if (!fs.existsSync(executablePath)) {
                throw new Error(`Extracted archive did not contain ${release.executableRelativePath}`);
            }

            fs.writeFileSync(markerPath, release.sha256, 'utf8');
            try {
                fs.rmSync(archivePath, { force: true });
            } catch {
                // Ignore cleanup failures for temporary archive
            }
        }

        if (release.vulkanAddon && hasVulkanRuntime()) {
            try {
                await ensureVulkanBackendAddon(path.dirname(executablePath), release.vulkanAddon, onProgress, signal);
            } catch (vulkanError) {
                if (vulkanError?.name === 'AbortError' || signal?.aborted) {
                    throw vulkanError;
                }
                console.warn('[NativeAI] Vulkan GPU addon unavailable, continuing with CPU/OpenBLAS:', vulkanError.message);
            }
        }

        return executablePath;
    }

    const destinationPath = path.join(getBinariesDirectory(), release.filename);

    return installVerifiedFile({
        url: `${RELEASE_BASE_URL}/${release.filename}`,
        destinationPath,
        sha256: release.sha256,
        executable: true,
        onProgress,
        signal,
    });
}

function normalizeWhisperModel(modelName) {
    const legacyModels = {
        'Xenova/whisper-tiny': 'tiny.en',
        'Xenova/whisper-base': 'base.en',
        'Xenova/whisper-small': 'small.en',
    };

    return legacyModels[modelName] || modelName || 'tiny.en';
}

async function ensureWhisperModel(modelName, onProgress, signal) {
    const normalizedModel = normalizeWhisperModel(modelName);
    const model = WHISPER_MODELS[normalizedModel];

    if (!model) {
        throw new Error(`Unsupported Whisper model: ${modelName}`);
    }

    const destinationPath = path.join(getModelsDirectory(), 'whisper', model.filename);
    return installVerifiedFile({
        url: model.url,
        destinationPath,
        sha256: model.sha256,
        executable: false,
        onProgress,
        signal,
    });
}

function encodePathParts(value) {
    return value
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/');
}

function parseHuggingFaceModelReference(modelReference) {
    const separatorIndex = modelReference.lastIndexOf(':');
    if (separatorIndex <= 0 || separatorIndex === modelReference.length - 1) {
        throw new Error('Language model must use the format owner/repository:quant');
    }

    const repository = modelReference.slice(0, separatorIndex);
    const quant = modelReference.slice(separatorIndex + 1);
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repository) || !/^[A-Za-z0-9._-]+$/.test(quant)) {
        throw new Error('Language model reference contains unsupported characters');
    }

    return {
        repository,
        quant,
    };
}

async function resolveHuggingFaceGguf(modelReference, signal) {
    const { repository, quant } = parseHuggingFaceModelReference(modelReference);
    const repositoryUrl = encodePathParts(repository);
    const response = await fetch(`https://huggingface.co/api/models/${repositoryUrl}/tree/main?recursive=true&expand=true`, { signal });

    if (!response.ok) {
        throw new Error(`Could not inspect Hugging Face model: HTTP ${response.status}`);
    }

    const files = await response.json();
    const normalizedQuant = quant.toUpperCase();
    const matches = files.filter(file => {
        return file.type === 'file' && file.path?.toLowerCase().endsWith('.gguf') && file.path.toUpperCase().includes(normalizedQuant);
    });

    if (matches.length !== 1) {
        throw new Error(`Expected one GGUF file for ${modelReference}, found ${matches.length}`);
    }

    const file = matches[0];
    if (!file.lfs?.oid || !file.size) {
        throw new Error(`Hugging Face did not provide checksum metadata for ${file.path}`);
    }

    const projector = files.find(candidate => candidate.type === 'file' && candidate.path === 'mmproj-BF16.gguf');
    if (!projector?.lfs?.oid || !projector.size) {
        throw new Error(`Hugging Face model ${repository} does not provide mmproj-BF16.gguf`);
    }

    return {
        repository,
        model: {
            path: file.path,
            sha256: file.lfs.oid,
        },
        projector: {
            path: projector.path,
            sha256: projector.lfs.oid,
        },
    };
}

async function ensureLlamaModel(modelReference, onModelProgress, onProjectorProgress, signal) {
    if (path.isAbsolute(modelReference)) {
        if (!fs.existsSync(modelReference)) {
            throw new Error(`Language model does not exist: ${modelReference}`);
        }

        const projectorPath = path.join(path.dirname(modelReference), 'mmproj-BF16.gguf');
        if (!fs.existsSync(projectorPath)) {
            throw new Error(`Multimodal projector does not exist: ${projectorPath}`);
        }

        return {
            modelPath: modelReference,
            projectorPath,
        };
    }

    const model = await resolveHuggingFaceGguf(modelReference, signal);
    const repositoryDirectory = path.join(getModelsDirectory(), 'llama', model.repository);
    const modelPath = await installVerifiedFile({
        url: `https://huggingface.co/${encodePathParts(model.repository)}/resolve/main/${encodePathParts(model.model.path)}`,
        destinationPath: path.join(repositoryDirectory, path.basename(model.model.path)),
        sha256: model.model.sha256,
        executable: false,
        onProgress: onModelProgress,
        signal,
    });
    const projectorPath = await installVerifiedFile({
        url: `https://huggingface.co/${encodePathParts(model.repository)}/resolve/main/${encodePathParts(model.projector.path)}`,
        destinationPath: path.join(repositoryDirectory, path.basename(model.projector.path)),
        sha256: model.projector.sha256,
        executable: false,
        onProgress: onProjectorProgress,
        signal,
    });

    return {
        modelPath,
        projectorPath,
    };
}

async function getAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => resolve(address.port));
        });
    });
}

function attachProcessLogging(childProcess, name) {
    childProcess.stdout.on('data', data => {
        process.stdout.write(`[${name}] ${data}`);
    });
    childProcess.stderr.on('data', data => {
        process.stderr.write(`[${name}] ${data}`);
    });
}

function startNativeServer({ executablePath, arguments: serverArguments, name, environment = {} }) {
    const childProcess = spawn(executablePath, serverArguments, {
        cwd: path.dirname(executablePath),
        env: { ...process.env, ...environment },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });

    attachProcessLogging(childProcess, name);
    return childProcess;
}

async function waitForServer(url, childProcess, timeoutMs) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (childProcess.exitCode !== null) {
            throw new Error(`Native server exited with code ${childProcess.exitCode}`);
        }

        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // The server is still starting.
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }

    throw new Error(`Native server did not become ready: ${url}`);
}

function stopNativeServer(childProcess) {
    if (!childProcess || childProcess.exitCode !== null) {
        return;
    }

    childProcess.kill();
}

module.exports = {
    WHISPER_MODELS,
    hasVulkanRuntime,
    ensureNativeBinary,
    ensureLlamaModel,
    ensureWhisperModel,
    getAvailablePort,
    getModelsDirectory,
    startNativeServer,
    stopNativeServer,
    waitForServer,
};
