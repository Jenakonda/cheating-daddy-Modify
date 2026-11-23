const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const {
    CHUNK_SIZE,
    clearContextCache,
    copyFilesIntoContextFolder,
    decodeXmlEntities,
    extractDocxText,
    extractPdfText,
    extractPptxText,
    extractRtfText,
    loadContextFolder,
    readZipEntries,
    searchContextBundle,
    summarizeContextBundle,
} = require('../src/utils/context-folder');
const { ClaudeCliRunner, resolveCliBinary } = require('../src/utils/cli-runners');
const { createCliSessionManager } = require('../src/utils/cliai');
const { getSystemPrompt } = require('../src/utils/prompts');

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) {
        crc ^= buffer[i];
        for (let b = 0; b < 8; b += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(fileMap, { useDataDescriptor = false } = {}) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const flags = (useDataDescriptor ? 0x0008 : 0) | 0x0800;

    for (const [name, content] of Object.entries(fileMap)) {
        const nameBuf = Buffer.from(name, 'utf8');
        const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
        const compBuf = zlib.deflateRawSync(rawBuf);
        const checksum = crc32(rawBuf);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(flags, 6);
        localHeader.writeUInt16LE(8, 8);
        localHeader.writeUInt32LE(useDataDescriptor ? 0 : checksum, 14);
        localHeader.writeUInt32LE(useDataDescriptor ? 0 : compBuf.length, 18);
        localHeader.writeUInt32LE(useDataDescriptor ? 0 : rawBuf.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);

        let descBuf = Buffer.alloc(0);
        if (useDataDescriptor) {
            descBuf = Buffer.alloc(16);
            descBuf.writeUInt32LE(0x08074b50, 0);
            descBuf.writeUInt32LE(checksum, 4);
            descBuf.writeUInt32LE(compBuf.length, 8);
            descBuf.writeUInt32LE(rawBuf.length, 12);
        }

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(flags, 8);
        centralHeader.writeUInt16LE(8, 10);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(compBuf.length, 20);
        centralHeader.writeUInt32LE(rawBuf.length, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt32LE(offset, 42);

        localParts.push(localHeader, nameBuf, compBuf, descBuf);
        centralParts.push(centralHeader, nameBuf);
        offset += localHeader.length + nameBuf.length + compBuf.length + descBuf.length;
    }

    const centralBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(Object.keys(fileMap).length, 8);
    eocd.writeUInt16LE(Object.keys(fileMap).length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, centralBuf, eocd]);
}

function buildMinimalPdfBuffer(pageLines) {
    const escaped = pageLines.map(line => `(${String(line).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj T*`).join(' ');
    const streamContent = `BT\n/F1 12 Tf\n14 TL\n72 720 Td\n${escaped}\nET\n`;

    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        `5 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'latin1')} >>\nstream\n${streamContent}endstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += obj;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

test('extractPptxText decodes deflated slides in numeric order with speaker notes and data-descriptor ZIP', () => {
    const zipBuf = buildZipBuffer(
        {
            'ppt/slides/slide10.xml': '<p:sld><a:p><a:t>Десятий слайд &amp; висновки</a:t></a:p></p:sld>',
            'ppt/slides/slide2.xml': '<p:sld><a:p><a:t>Архітектура сервісів</a:t></a:p><a:p><a:t>PostgreSQL &lt;16&gt;</a:t></a:p></p:sld>',
            'ppt/slides/slide1.xml': '<p:sld><a:p><a:t>Квартальний звіт Q4 &quot;Zoom&quot;</a:t></a:p></p:sld>',
            'ppt/notesSlides/notesSlide1.xml': '<p:notes><a:p><a:t>Підкреслити економію 30%</a:t></a:p><a:p><a:t>1</a:t></a:p></p:notes>',
        },
        { useDataDescriptor: true }
    );

    const entries = readZipEntries(zipBuf);
    assert.equal(entries.size, 4);

    const parsed = extractPptxText(zipBuf);
    assert.equal(parsed.unitsLabel, '3 slides');
    assert.equal(parsed.sections.length, 3);
    assert.equal(parsed.sections[0].heading, 'Slide 1');
    assert.equal(parsed.sections[1].heading, 'Slide 2');
    assert.equal(parsed.sections[2].heading, 'Slide 10');

    const idx1 = parsed.text.indexOf('[Slide 1]');
    const idx2 = parsed.text.indexOf('[Slide 2]');
    const idx10 = parsed.text.indexOf('[Slide 10]');
    assert.ok(idx1 !== -1 && idx2 > idx1 && idx10 > idx2, 'Slides must be ordered numerically (1, 2, 10)');
    assert.ok(parsed.text.includes('Квартальний звіт Q4 "Zoom"'));
    assert.ok(parsed.text.includes('Notes: Підкреслити економію 30%'));
    assert.ok(parsed.text.includes('PostgreSQL <16>'));
    assert.ok(parsed.text.includes('Десятий слайд & висновки'));
    assert.equal(decodeXmlEntities('&amp;lt;'), '&lt;');
});

test('extractDocxText and extractRtfText extract Ukrainian Cyrillic and structured text cleanly', () => {
    const docxZip = buildZipBuffer({
        'word/document.xml':
            '<w:document><w:body><w:p><w:r><w:t>Білет 12: Теорема Байєса</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Precision</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0.94</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    });

    const docx = extractDocxText(docxZip);
    assert.ok(docx.text.includes('Білет 12: Теорема Байєса'));
    assert.ok(docx.text.includes('Precision | 0.94'));

    // "Привіт" in Windows-1251 bytes: CF F0 E8 E2 B3 F2 -> \'cf\'f0\'e8\'e2\'b3\'f2 (Wait: CP1251 і = B3)
    const rtfBuf = Buffer.from(
        "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard \\'cf\\'f0\\'e8\\'e2\\'b3\\'f2, \\u1073?\\u1110?\\u1083?\\u1077?\\u1090? 5!\\par Line 2}",
        'latin1'
    );
    const rtf = extractRtfText(rtfBuf);
    assert.ok(rtf.text.includes('Привіт, білет 5!'));
    assert.ok(rtf.text.includes('Line 2'));
    assert.equal(rtf.text.includes('Arial'), false);
});

test('extractPdfText extracts text and page count via unpdf 1.4.0', async () => {
    const pdfBuf = buildMinimalPdfBuffer(['Exam Ticket 7', 'OSI Layer 4 Transport TCP UDP']);
    const parsed = await extractPdfText(pdfBuf);
    assert.equal(parsed.unitsLabel, '1 page');
    assert.equal(parsed.sections.length, 1);
    assert.equal(parsed.sections[0].heading, 'Page 1');
    assert.ok(parsed.text.includes('Exam Ticket 7'));
    assert.ok(parsed.text.includes('OSI Layer 4 Transport TCP UDP'));
});

test('loadContextFolder handles inline vs RAG mode, Ukrainian stem search, and file copying', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-ctx-folder-'));
    const docsDir = path.join(tmpDir, 'docs');
    const sourceDir = path.join(tmpDir, 'sources');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });

    try {
        clearContextCache();
        fs.writeFileSync(path.join(docsDir, 'notes.md'), '# План зустрічі\nМіграція бази PostgreSQL у листопаді.', 'utf8');
        fs.writeFileSync(path.join(docsDir, '~$notes.md'), 'temp Office lock should be ignored', 'utf8');
        fs.writeFileSync(
            path.join(docsDir, 'presentation.pptx'),
            buildZipBuffer({
                'ppt/slides/slide1.xml': '<p:sld><a:p><a:t>Слайд 1: SLA 99.95% та балансування</a:t></a:p></p:sld>',
            })
        );

        const inlineBundle = await loadContextFolder(docsDir, { inlineCharLimit: 5000 });
        assert.equal(inlineBundle.mode, 'inline');
        assert.equal(inlineBundle.loadedFileCount, 2);
        assert.equal(inlineBundle.totalFileCount, 2);
        assert.ok(inlineBundle.inlineText.includes('Міграція бази PostgreSQL'));
        assert.ok(inlineBundle.inlineText.includes('[Slide 1]\nСлайд 1: SLA 99.95% та балансування'));

        // Test RAG mode + stem-prefix matching on inflected Ukrainian words
        const filler = 'Загальний опис архітектури системи та стандартні вимоги до інфраструктури. '.repeat(25);
        fs.writeFileSync(
            path.join(docsDir, 'handbook.txt'),
            `${filler}\nКвантове шифрування та протокол Діффі-Хеллмана на еліптичних кривих забезпечують пряму секретність.\n${filler}`,
            'utf8'
        );

        const ragBundle = await loadContextFolder(docsDir, { inlineCharLimit: 1200, ragCatalogLimit: 900 });
        assert.equal(ragBundle.mode, 'rag');
        assert.ok(ragBundle.totalChunks >= Math.ceil(ragBundle.totalChars / CHUNK_SIZE));
        assert.ok(ragBundle.inlineText.includes('Loaded documents'));
        assert.ok(ragBundle.inlineText.length <= 900);

        const hit = searchContextBundle(ragBundle, 'Що в посібнику про Діффі-Хеллмана і шифруванням?', { maxChunks: 2 });
        assert.ok(hit.matches.length >= 1);
        assert.ok(hit.formattedText.includes('handbook.txt'));
        assert.ok(hit.formattedText.includes('Діффі-Хеллмана'));

        const summary = summarizeContextBundle(ragBundle, { isDefault: true, enabled: true });
        assert.equal(summary.isDefault, true);
        assert.equal(summary.enabled, true);
        assert.equal(summary.mode, 'rag');
        assert.equal(summary.loadedFileCount, 3);
        assert.equal(summary.inlineText, undefined);
        assert.equal(summary.chunks, undefined);

        // Test copyFilesIntoContextFolder collision naming
        const srcFile = path.join(sourceDir, 'notes.md');
        fs.writeFileSync(srcFile, 'Another version', 'utf8');
        const copyRes = copyFilesIntoContextFolder(docsDir, [srcFile]);
        assert.deepEqual(copyRes.copied, ['notes-1.md']);
        assert.equal(fs.readFileSync(path.join(docsDir, 'notes-1.md'), 'utf8'), 'Another version');
    } finally {
        clearContextCache();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('ClaudeCliRunner uses --system-prompt-file when system prompt exceeds 8000 chars and cleans up on close', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-claude-sysfile-'));
    let smallRunner = null;
    let largeRunner = null;
    try {
        const inspectMockPath = path.join(tmpDir, 'mock-sysfile.js');
        fs.writeFileSync(
            inspectMockPath,
            `
const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sf-1' }) + '\\n');
rl.on('line', line => {
    if (!line.trim()) return;
    const args = process.argv.slice(2);
    const fileIdx = args.indexOf('--system-prompt-file');
    const inlineIdx = args.indexOf('--system-prompt');
    const payload = {
        hasFileFlag: fileIdx !== -1,
        hasInlineFlag: inlineIdx !== -1,
        filePath: fileIdx !== -1 ? args[fileIdx + 1] : null,
        fileLength: fileIdx !== -1 && fs.existsSync(args[fileIdx + 1]) ? fs.readFileSync(args[fileIdx + 1], 'utf8').length : 0,
    };
    process.stdout.write(JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'sf-1',
        result: JSON.stringify(payload),
    }) + '\\n');
});
`,
            'utf8'
        );

        const smallCwd = path.join(tmpDir, 'small');
        smallRunner = new ClaudeCliRunner({
            binaryPath: inspectMockPath,
            systemPrompt: 'Short prompt',
            cwd: smallCwd,
        });
        const smallRes = JSON.parse((await smallRunner.sendTurn({ text: 'hi' })).text);
        assert.equal(smallRes.hasInlineFlag, true);
        assert.equal(smallRes.hasFileFlag, false);

        const largeCwd = path.join(tmpDir, 'large');
        const hugePrompt = 'X'.repeat(9500);
        largeRunner = new ClaudeCliRunner({
            binaryPath: inspectMockPath,
            systemPrompt: hugePrompt,
            cwd: largeCwd,
        });
        const largeRes = JSON.parse((await largeRunner.sendTurn({ text: 'hi' })).text);
        assert.equal(largeRes.hasFileFlag, true);
        assert.equal(largeRes.hasInlineFlag, false);
        assert.equal(largeRes.fileLength, 9500);

        await largeRunner.closeAsync();
        assert.equal(fs.existsSync(largeRes.filePath), false, 'Temp system-prompt.md should be deleted on close');
    } finally {
        await smallRunner?.closeAsync();
        await largeRunner?.closeAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});

test('createCliSessionManager injects Context Folder inline into prompt and attaches RAG chunks per turn cleanly', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-cliai-ctx-dir-'));
    const inlineDir = path.join(tmpDir, 'ctx-inline');
    const ragDir = path.join(tmpDir, 'ctx-rag');
    fs.mkdirSync(inlineDir, { recursive: true });
    fs.mkdirSync(ragDir, { recursive: true });

    let manager = null;
    try {
        clearContextCache();
        const mockClaudePath = path.join(tmpDir, 'mock-claude-echo.js');
        fs.writeFileSync(
            mockClaudePath,
            `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'ctx-sess' }) + '\\n');
rl.on('line', line => {
    if (!line.trim()) return;
    const msg = JSON.parse(line);
    const text = (msg.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
    process.stdout.write(JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'ctx-sess',
        result: text,
    }) + '\\n');
});
`,
            'utf8'
        );

        fs.writeFileSync(path.join(inlineDir, 'ticket1.txt'), 'Відповідь на білет 1: алгоритм Дейкстри.', 'utf8');

        let capturedSystemPrompt = '';
        manager = createCliSessionManager({
            getConfigDir: () => path.join(tmpDir, 'cfg-inline'),
            getDefaultContextDir: () => inlineDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: false,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: false,
                cliClaudePath: mockClaudePath,
                contextFolderEnabled: true,
                contextFolderPath: '',
            }),
            getSystemPrompt: (profile, customPrompt, googleSearchEnabled, responseLanguage, folderContext) => {
                capturedSystemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled, responseLanguage, folderContext);
                return capturedSystemPrompt;
            },
            sendToRenderer: () => {},
            initializeNewSession: () => {},
            saveConversationTurn: () => {},
            saveScreenAnalysis: () => {},
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        assert.equal(await manager.initializeCliSession({ claudePath: mockClaudePath }), true);
        assert.ok(capturedSystemPrompt.includes('Reference materials from Context Folder'));
        assert.ok(capturedSystemPrompt.includes('алгоритм Дейкстри'));
        await manager.closeCliSessionAsync();

        // Now test RAG mode (> 24000 chars)
        const bigPad = 'Стандартні матеріали курсу та технічні примітки для підготовки. '.repeat(450);
        fs.writeFileSync(
            path.join(ragDir, 'big-guide.txt'),
            `${bigPad}\nУнікальний маркер презентації: Протокол QUIC працює поверх UDP із вбудованим TLS 1.3.\n`,
            'utf8'
        );

        const savedQuestions = [];
        const ragManager = createCliSessionManager({
            getConfigDir: () => path.join(tmpDir, 'cfg-rag'),
            getDefaultContextDir: () => inlineDir,
            getPreferences: () => ({
                cliPrimaryProvider: 'claude',
                cliFallbackEnabled: false,
                cliUseSubscriptionAuth: true,
                cliWhisperEnabled: false,
                cliClaudePath: mockClaudePath,
                contextFolderEnabled: true,
                contextFolderPath: ragDir,
            }),
            getSystemPrompt: (profile, customPrompt, googleSearchEnabled, responseLanguage, folderContext) => {
                capturedSystemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled, responseLanguage, folderContext);
                return capturedSystemPrompt;
            },
            sendToRenderer: () => {},
            initializeNewSession: () => {},
            saveConversationTurn: t => savedQuestions.push(t),
            saveScreenAnalysis: () => {},
            logTransportEvent: () => {},
            resolveCliBinary,
        });

        manager = ragManager;
        assert.equal(await ragManager.initializeCliSession({ claudePath: mockClaudePath }), true);
        assert.ok(capturedSystemPrompt.includes('big-guide.txt'));
        assert.ok(capturedSystemPrompt.includes('Additional matching excerpts from larger files are attached automatically'));

        const res = await ragManager.sendCliText('Як працює протокол QUIC?');
        assert.equal(res.success, true);
        assert.ok(res.text.includes('[Context: big-guide.txt]'));
        assert.ok(res.text.includes('TLS 1.3'));
        assert.ok(res.text.includes('[Current question]:\nЯк працює протокол QUIC?'));
        assert.deepEqual(savedQuestions, ['Як працює протокол QUIC?']);
        await ragManager.closeCliSessionAsync();
    } finally {
        clearContextCache();
        await manager?.closeCliSessionAsync();
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 });
    }
});
