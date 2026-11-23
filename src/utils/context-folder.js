const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_INLINE_CHAR_LIMIT = 24000;
const RAG_CATALOG_CHAR_LIMIT = 4500;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 60;
const MAX_SCAN_DEPTH = 4;

const TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.markdown',
    '.csv',
    '.tsv',
    '.json',
    '.yaml',
    '.yml',
    '.xml',
    '.ini',
    '.conf',
    '.env',
    '.log',
    '.sql',
    '.py',
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '.jsx',
    '.java',
    '.kt',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.php',
    '.rb',
    '.sh',
    '.ps1',
    '.css',
    '.scss',
]);

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.pptx', '.docx', '.xlsx', '.odt', '.odp', '.rtf', '.html', '.htm']);

const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...DOCUMENT_EXTENSIONS]);

const SKIPPED_DIRS = new Set(['node_modules', '.git', '__macosx', '.venv', 'venv', 'dist', 'build']);

const parseCache = new Map();

function clearContextCache() {
    parseCache.clear();
}

function decodeXmlEntities(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    const named = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
    };

    return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
        const lower = entity.toLowerCase();
        if (named[lower] !== undefined) {
            return named[lower];
        }
        if (lower.startsWith('#x')) {
            const code = parseInt(lower.slice(2), 16);
            if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
                try {
                    return String.fromCodePoint(code);
                } catch {
                    return match;
                }
            }
            return match;
        }
        if (lower.startsWith('#')) {
            const code = parseInt(lower.slice(1), 10);
            if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
                try {
                    return String.fromCodePoint(code);
                } catch {
                    return match;
                }
            }
        }
        return match;
    });
}

function normalizeExtractedText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function readZipEntries(buffer) {
    const entries = new Map();
    if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
        return entries;
    }

    // Locate End of Central Directory record (0x06054b50) scanning backward
    let eocdOffset = -1;
    const minOffset = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset === -1) {
        return entries;
    }

    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    if (cdOffset >= eocdOffset || totalEntries > 4000) {
        return entries;
    }

    let pos = cdOffset;
    for (let idx = 0; idx < totalEntries && pos + 46 <= eocdOffset; idx += 1) {
        if (buffer.readUInt32LE(pos) !== 0x02014b50) {
            break;
        }

        const compressionMethod = buffer.readUInt16LE(pos + 10);
        const compressedSize = buffer.readUInt32LE(pos + 20);
        const uncompressedSize = buffer.readUInt32LE(pos + 24);
        const nameLen = buffer.readUInt16LE(pos + 28);
        const extraLen = buffer.readUInt16LE(pos + 30);
        const commentLen = buffer.readUInt16LE(pos + 32);
        const localHeaderOffset = buffer.readUInt32LE(pos + 42);

        const nameStart = pos + 46;
        const nameEnd = nameStart + nameLen;
        if (nameEnd > eocdOffset) {
            break;
        }

        const entryName = buffer.subarray(nameStart, nameEnd).toString('utf8').replace(/\\/g, '/');
        pos = nameEnd + extraLen + commentLen;

        if (!entryName || entryName.endsWith('/')) {
            continue;
        }
        if (compressedSize > MAX_ZIP_ENTRY_BYTES || uncompressedSize > MAX_ZIP_ENTRY_BYTES) {
            continue;
        }
        if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
            continue;
        }

        const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const dataEnd = dataStart + compressedSize;
        if (dataEnd > buffer.length) {
            continue;
        }

        const slice = buffer.subarray(dataStart, dataEnd);
        try {
            if (compressionMethod === 0) {
                entries.set(entryName, Buffer.from(slice));
            } else if (compressionMethod === 8) {
                const inflated = zlib.inflateRawSync(slice, { maxOutputLength: MAX_ZIP_ENTRY_BYTES });
                entries.set(entryName, inflated);
            }
        } catch {
            // Skip corrupted or oversized archive entries cleanly
        }
    }

    return entries;
}

function stripXmlToParagraphs(xml) {
    if (!xml || typeof xml !== 'string') {
        return '';
    }

    const withBreaks = xml
        .replace(/<w:(?:delText|instrText)\b[^>]*>[\s\S]*?<\/w:(?:delText|instrText)>/gi, '')
        .replace(/<\/(?:a:p|w:p|p|text:p|text:h)>\s*(?=<\/(?:a:tc|w:tc|table:table-cell|tc|td|th)>)/gi, '')
        .replace(/<\/(?:a:p|w:p|p|text:p|text:h|a:tr|w:tr|table:table-row|tr)>/gi, '\n')
        .replace(/<(?:a:br|w:br|br|text:line-break)\b[^>]*\/?>/gi, '\n')
        .replace(/<\/(?:a:tc|w:tc|table:table-cell|tc|td|th)>/gi, ' | ')
        .replace(/<(?:w:tab|a:tab|text:tab)\b[^>]*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]*\|[ \t]*(?=\r?\n|$)/g, '');

    return normalizeExtractedText(decodeXmlEntities(withBreaks));
}

function resolvePptxNotesTarget(entries, slideIndex) {
    const relKey = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
    const relBuf = entries.get(relKey);
    if (relBuf) {
        const relXml = relBuf.toString('utf8');
        const notesMatch = relXml.match(/Target=["']([^"']*notesSlide[^"']*\.xml)["']/i);
        if (notesMatch) {
            const rawTarget = notesMatch[1].replace(/\\/g, '/').replace(/^\/+/, '');
            const normalized = rawTarget.startsWith('..')
                ? path.posix.normalize(path.posix.join('ppt/slides', rawTarget))
                : rawTarget.startsWith('ppt/')
                  ? rawTarget
                  : `ppt/${rawTarget}`;
            if (entries.has(normalized)) {
                return normalized;
            }
        }
    }

    const directKey = `ppt/notesSlides/notesSlide${slideIndex}.xml`;
    return entries.has(directKey) ? directKey : null;
}

function extractPptxText(buffer) {
    const entries = readZipEntries(buffer);
    const slideEntries = [];

    for (const key of entries.keys()) {
        const match = key.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
        if (match) {
            slideEntries.push({
                index: parseInt(match[1], 10),
                key,
            });
        }
    }

    slideEntries.sort((a, b) => a.index - b.index);

    const sections = [];
    for (const slide of slideEntries) {
        const slideXml = entries.get(slide.key)?.toString('utf8') || '';
        const slideBody = stripXmlToParagraphs(slideXml);

        let notesBody = '';
        const notesKey = resolvePptxNotesTarget(entries, slide.index);
        if (notesKey) {
            const notesXml = entries.get(notesKey)?.toString('utf8') || '';
            const cleanedNotes = stripXmlToParagraphs(notesXml)
                .replace(/^\d+\s*$/gm, '')
                .trim();
            if (cleanedNotes) {
                notesBody = cleanedNotes;
            }
        }

        const combined = notesBody ? (slideBody ? `${slideBody}\nNotes: ${notesBody}` : `Notes: ${notesBody}`) : slideBody;

        if (combined) {
            sections.push({
                heading: `Slide ${slide.index}`,
                text: combined,
            });
        }
    }

    const formatted = sections.map(section => `[${section.heading}]\n${section.text}`).join('\n\n');
    const slideCount = slideEntries.length;
    return {
        text: formatted,
        sections,
        unitsLabel: slideCount > 0 ? `${slideCount} ${slideCount === 1 ? 'slide' : 'slides'}` : '',
    };
}

function extractDocxText(buffer) {
    const entries = readZipEntries(buffer);
    const parts = [];
    const docXml = entries.get('word/document.xml')?.toString('utf8');
    if (docXml) {
        const body = stripXmlToParagraphs(docXml);
        if (body) parts.push(body);
    }

    const text = parts.join('\n\n').trim();
    const sections = text ? [{ heading: 'Document', text }] : [];
    return {
        text,
        sections,
        unitsLabel: '',
    };
}

function parseXmlAttributes(attrText) {
    const attrs = {};
    if (!attrText) return attrs;
    const regex = /([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = regex.exec(attrText)) !== null) {
        attrs[m[1]] = m[2];
    }
    return attrs;
}

function extractXlsxText(buffer) {
    const entries = readZipEntries(buffer);

    const sharedStrings = [];
    const sstXml = entries.get('xl/sharedStrings.xml')?.toString('utf8');
    if (sstXml) {
        const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
        let m;
        while ((m = siRegex.exec(sstXml)) !== null) {
            const tParts = [];
            const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
            let tm;
            while ((tm = tRegex.exec(m[1])) !== null) {
                tParts.push(decodeXmlEntities(tm[1]));
            }
            sharedStrings.push(tParts.join('').trim());
        }
    }

    const sheetEntries = [];
    for (const key of entries.keys()) {
        const match = key.match(/^xl\/worksheets\/sheet(\d+)\.xml$/i);
        if (match) {
            sheetEntries.push({
                index: parseInt(match[1], 10),
                key,
            });
        }
    }
    sheetEntries.sort((a, b) => a.index - b.index);

    const sections = [];
    for (const sheet of sheetEntries) {
        const sheetXml = entries.get(sheet.key)?.toString('utf8') || '';
        const rows = [];
        const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
            const cells = [];
            const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                const attrs = parseXmlAttributes(cellMatch[1]);
                const inner = cellMatch[2];
                let val = '';

                if (attrs.t === 's') {
                    const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
                    const idx = vMatch ? parseInt(vMatch[1].trim(), 10) : -1;
                    val = Number.isInteger(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
                } else if (attrs.t === 'inlineStr') {
                    val = stripXmlToParagraphs(inner);
                } else {
                    const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
                    val = vMatch ? decodeXmlEntities(vMatch[1].trim()) : stripXmlToParagraphs(inner);
                }

                if (val) {
                    cells.push(val);
                }
            }
            if (cells.length > 0) {
                rows.push(cells.join(' | '));
            }
        }

        const sheetText = normalizeExtractedText(rows.join('\n'));
        if (sheetText) {
            sections.push({
                heading: `Sheet ${sheet.index}`,
                text: sheetText,
            });
        }
    }

    const formatted = sections.map(section => `[${section.heading}]\n${section.text}`).join('\n\n');
    const sheetCount = sheetEntries.length;
    return {
        text: formatted,
        sections,
        unitsLabel: sheetCount > 0 ? `${sheetCount} ${sheetCount === 1 ? 'sheet' : 'sheets'}` : '',
    };
}

function extractOdfText(buffer, isPresentation = false) {
    const entries = readZipEntries(buffer);
    const contentXml = entries.get('content.xml')?.toString('utf8') || '';
    if (!contentXml) {
        return { text: '', sections: [], unitsLabel: '' };
    }

    if (isPresentation && /<draw:page\b/i.test(contentXml)) {
        const pageChunks = contentXml.split(/<draw:page\b[^>]*>/i).slice(1);
        const sections = [];
        pageChunks.forEach((chunk, idx) => {
            const pageBody = stripXmlToParagraphs(chunk.split(/<\/draw:page>/i)[0] || chunk);
            if (pageBody) {
                sections.push({
                    heading: `Slide ${idx + 1}`,
                    text: pageBody,
                });
            }
        });
        const formatted = sections.map(s => `[${s.heading}]\n${s.text}`).join('\n\n');
        return {
            text: formatted,
            sections,
            unitsLabel: pageChunks.length > 0 ? `${pageChunks.length} ${pageChunks.length === 1 ? 'slide' : 'slides'}` : '',
        };
    }

    const body = stripXmlToParagraphs(contentXml);
    const sections = body ? [{ heading: 'Document', text: body }] : [];
    return {
        text: body,
        sections,
        unitsLabel: '',
    };
}

function extractRtfText(buffer) {
    const raw = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : String(buffer || '');
    if (!raw.trim()) {
        return { text: '', sections: [], unitsLabel: '' };
    }

    const cp1251Decoder = new TextDecoder('windows-1251');

    // Remove header & ignorable destination groups before decoding body
    let body = raw.replace(/\{\\\*\\[^}]*\}/g, '').replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object|fldinst)\b[\s\S]*?\}/gi, '');

    // Decode hex byte runs (\'xx) using Windows-1251
    body = body.replace(/(?:\\'[0-9a-f]{2})+/gi, hexRun => {
        const matches = hexRun.match(/[0-9a-f]{2}/gi) || [];
        const bytes = new Uint8Array(matches.map(hex => parseInt(hex, 16)));
        return cp1251Decoder.decode(bytes);
    });

    // Decode Unicode escapes (\uN with optional replacement char)
    body = body.replace(/\\u(-?\d+)(?:\\'[0-9a-f]{2}|[? ])?/gi, (_, numStr) => {
        let code = parseInt(numStr, 10);
        if (code < 0) {
            code += 65536;
        }
        if (code > 0 && code <= 0x10ffff) {
            try {
                return String.fromCodePoint(code);
            } catch {
                return '';
            }
        }
        return '';
    });

    // Preserve paragraphs/tabs, then strip remaining control words and braces
    body = body
        .replace(/\\(?:par|line|row)\b\s?/gi, '\n')
        .replace(/\\tab\b\s?/gi, ' ')
        .replace(/\\cell\b\s?/gi, ' | ')
        .replace(/\\([\\{}])/g, '$1')
        .replace(/\\[a-z]+-?\d*\s?/gi, '')
        .replace(/[{}]/g, '');

    const text = normalizeExtractedText(body);
    const sections = text ? [{ heading: 'Document', text }] : [];
    return {
        text,
        sections,
        unitsLabel: '',
    };
}

function extractHtmlText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return { text: '', sections: [], unitsLabel: '' };
    }

    const stripped = rawText
        .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
        .replace(/<(?:br|hr)\b[^>]*\/?>/gi, '\n')
        .replace(/<\/(?:td|th)>/gi, ' | ')
        .replace(/<[^>]+>/g, '');

    const text = normalizeExtractedText(decodeXmlEntities(stripped));
    const sections = text ? [{ heading: 'Document', text }] : [];
    return {
        text,
        sections,
        unitsLabel: '',
    };
}

let _unpdfModule = null;
function getUnpdf() {
    if (!_unpdfModule) {
        _unpdfModule = require('unpdf');
    }
    return _unpdfModule;
}

async function extractPdfText(buffer) {
    const { extractText } = getUnpdf();
    const res = await extractText(new Uint8Array(buffer), { mergePages: false });
    const rawPages = Array.isArray(res?.text) ? res.text : typeof res?.text === 'string' ? [res.text] : [];
    const totalPages = typeof res?.totalPages === 'number' && res.totalPages > 0 ? res.totalPages : rawPages.length;

    const sections = [];
    rawPages.forEach((pageText, idx) => {
        const cleaned = normalizeExtractedText(pageText);
        if (cleaned) {
            sections.push({
                heading: `Page ${idx + 1}`,
                text: cleaned,
            });
        }
    });

    const formatted = sections.map(section => `[${section.heading}]\n${section.text}`).join('\n\n');
    return {
        text: formatted,
        sections,
        unitsLabel: totalPages > 0 ? `${totalPages} ${totalPages === 1 ? 'page' : 'pages'}` : '',
    };
}

async function extractFileContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        return {
            status: 'skipped',
            text: '',
            sections: [],
            unitsLabel: '',
            reason: `Unsupported file type (${ext || 'unknown'})`,
        };
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
        return {
            status: 'skipped',
            text: '',
            sections: [],
            unitsLabel: '',
            reason: 'Not a regular file',
        };
    }

    if (stat.size > MAX_FILE_BYTES) {
        return {
            status: 'skipped',
            text: '',
            sections: [],
            unitsLabel: '',
            reason: `File exceeds ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB limit`,
        };
    }

    const cacheKey = `${filePath}|${stat.mtimeMs}|${stat.size}`;
    if (parseCache.has(cacheKey)) {
        return parseCache.get(cacheKey);
    }

    let extracted;
    try {
        const buffer = fs.readFileSync(filePath);
        if (ext === '.pdf') {
            extracted = await extractPdfText(buffer);
        } else if (ext === '.pptx') {
            extracted = extractPptxText(buffer);
        } else if (ext === '.docx') {
            extracted = extractDocxText(buffer);
        } else if (ext === '.xlsx') {
            extracted = extractXlsxText(buffer);
        } else if (ext === '.odp' || ext === '.odt') {
            extracted = extractOdfText(buffer, ext === '.odp');
        } else if (ext === '.rtf') {
            extracted = extractRtfText(buffer);
        } else if (ext === '.html' || ext === '.htm') {
            extracted = extractHtmlText(buffer.toString('utf8'));
        } else {
            const rawText = normalizeExtractedText(buffer.toString('utf8'));
            extracted = {
                text: rawText,
                sections: rawText ? [{ heading: 'Document', text: rawText }] : [],
                unitsLabel: '',
            };
        }
    } catch (error) {
        return {
            status: 'error',
            text: '',
            sections: [],
            unitsLabel: '',
            reason: error?.message || 'Failed to parse file',
        };
    }

    const text = (extracted?.text || '').trim();
    const sections = Array.isArray(extracted?.sections) ? extracted.sections : [];
    const unitsLabel = extracted?.unitsLabel || '';

    const result = text
        ? {
              status: 'loaded',
              text,
              sections,
              unitsLabel,
              reason: null,
          }
        : {
              status: 'empty',
              text: '',
              sections: [],
              unitsLabel,
              reason: ext === '.pdf' ? 'No extractable text (scanned PDF?)' : 'No readable text found',
          };

    parseCache.set(cacheKey, result);
    if (parseCache.size > 200) {
        const oldestKey = parseCache.keys().next().value;
        parseCache.delete(oldestKey);
    }

    return result;
}

function tokenizeForSearch(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const rawWords = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const tokens = [];
    for (const word of rawWords) {
        if (word.length < 2) {
            continue;
        }
        tokens.push(word);
        if (word.length >= 5) {
            const stemLen = Math.min(6, word.length - 1);
            tokens.push(`~${word.slice(0, stemLen)}`);
        }
    }
    return tokens;
}

function buildTermFreq(tokens) {
    const freq = new Map();
    for (const token of tokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
    }
    return freq;
}

function chunkTextWithOverlap(text, maxSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    if (!text || text.length <= maxSize) {
        return text ? [text] : [];
    }

    const chunks = [];
    let start = 0;
    const stepGuard = Math.max(100, maxSize - overlap);

    while (start < text.length) {
        let end = Math.min(text.length, start + maxSize);
        if (end < text.length) {
            const newlineBreak = text.lastIndexOf('\n', end);
            const spaceBreak = text.lastIndexOf(' ', end);
            const minSnap = start + Math.floor(maxSize * 0.55);
            if (newlineBreak >= minSnap) {
                end = newlineBreak;
            } else if (spaceBreak >= minSnap) {
                end = spaceBreak;
            }
        }

        const slice = text.slice(start, end).trim();
        if (slice) {
            chunks.push(slice);
        }
        if (end >= text.length) {
            break;
        }

        const nextStart = Math.max(start + stepGuard, end - overlap);
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}

function chunkDocumentSections(relativePath, sections) {
    const chunks = [];
    const safeSections = Array.isArray(sections) ? sections : [];

    for (const sec of safeSections) {
        const heading = sec?.heading || 'Document';
        const secText = (sec?.text || '').trim();
        if (!secText) {
            continue;
        }

        const pieces = chunkTextWithOverlap(secText, CHUNK_SIZE, CHUNK_OVERLAP);
        for (const piece of pieces) {
            const label = heading && heading !== 'Document' ? `${relativePath} · ${heading}` : relativePath;
            const tokens = tokenizeForSearch(`${label} ${piece}`);
            chunks.push({
                id: `${relativePath}#${chunks.length}`,
                source: relativePath,
                section: heading,
                text: piece,
                tokens,
                termFreq: buildTermFreq(tokens),
            });
        }
    }

    return chunks;
}

function collectCandidateFiles(rootDir) {
    const collected = [];

    function walk(currentDir, depth) {
        if (depth > MAX_SCAN_DEPTH || collected.length >= MAX_FILES) {
            return;
        }

        let dirEntries;
        try {
            dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        dirEntries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of dirEntries) {
            if (collected.length >= MAX_FILES) {
                break;
            }
            const name = entry.name;
            if (!name || name.startsWith('.') || name.startsWith('~$')) {
                continue;
            }
            if (entry.isSymbolicLink()) {
                continue;
            }

            const fullPath = path.join(currentDir, name);
            if (entry.isDirectory()) {
                if (SKIPPED_DIRS.has(name.toLowerCase())) {
                    continue;
                }
                walk(fullPath, depth + 1);
                continue;
            }

            if (entry.isFile()) {
                const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                collected.push({
                    fullPath,
                    relativePath: rel,
                    name,
                    ext: path.extname(name).toLowerCase(),
                });
            }
        }
    }

    walk(rootDir, 0);
    return collected;
}

async function loadContextFolder(folderPath, { inlineCharLimit = DEFAULT_INLINE_CHAR_LIMIT, ragCatalogLimit = RAG_CATALOG_CHAR_LIMIT } = {}) {
    const resolvedPath = folderPath ? path.resolve(String(folderPath)) : '';
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        return {
            folderPath: resolvedPath,
            exists: false,
            mode: 'empty',
            files: [],
            inlineText: '',
            chunks: [],
            loadedFileCount: 0,
            totalFileCount: 0,
            totalChars: 0,
            totalChunks: 0,
        };
    }

    const candidates = collectCandidateFiles(resolvedPath);
    const files = [];
    const loadedDocs = [];
    const allChunks = [];
    let totalChars = 0;

    for (const candidate of candidates) {
        let sizeBytes = 0;
        try {
            sizeBytes = fs.statSync(candidate.fullPath).size;
        } catch {
            sizeBytes = 0;
        }

        const extracted = await extractFileContent(candidate.fullPath);
        const charCount = extracted.text.length;

        files.push({
            relativePath: candidate.relativePath,
            name: candidate.name,
            ext: candidate.ext,
            sizeBytes,
            status: extracted.status,
            charCount,
            unitsLabel: extracted.unitsLabel,
            reason: extracted.reason,
        });

        if (extracted.status === 'loaded' && charCount > 0) {
            totalChars += charCount;
            loadedDocs.push({
                relativePath: candidate.relativePath,
                unitsLabel: extracted.unitsLabel,
                text: extracted.text,
                sections: extracted.sections,
            });
            allChunks.push(...chunkDocumentSections(candidate.relativePath, extracted.sections));
        }
    }

    if (loadedDocs.length === 0) {
        return {
            folderPath: resolvedPath,
            exists: true,
            mode: 'empty',
            files,
            inlineText: '',
            chunks: [],
            loadedFileCount: 0,
            totalFileCount: files.length,
            totalChars: 0,
            totalChunks: 0,
        };
    }

    if (totalChars <= inlineCharLimit) {
        const inlineText = loadedDocs
            .map(doc => {
                const header = doc.unitsLabel ? `=== ${doc.relativePath} (${doc.unitsLabel}) ===` : `=== ${doc.relativePath} ===`;
                return `${header}\n${doc.text}`;
            })
            .join('\n\n');

        return {
            folderPath: resolvedPath,
            exists: true,
            mode: 'inline',
            files,
            inlineText,
            chunks: allChunks,
            loadedFileCount: loadedDocs.length,
            totalFileCount: files.length,
            totalChars,
            totalChunks: allChunks.length,
        };
    }

    // Large folder (> inlineCharLimit): build compact Document Catalog + opening snippets within ragCatalogLimit
    const catalogLines = ['Loaded documents (Smart search attaches relevant excerpts automatically per question):'];
    for (const doc of loadedDocs) {
        const meta = [doc.unitsLabel, `${doc.text.length} chars`].filter(Boolean).join(', ');
        catalogLines.push(`- ${doc.relativePath} (${meta})`);
    }

    let catalogText = catalogLines.join('\n');
    const perDocPreview = Math.max(180, Math.floor((ragCatalogLimit - catalogText.length - 120) / Math.max(1, loadedDocs.length)));

    if (perDocPreview >= 180 && catalogText.length < ragCatalogLimit - 220) {
        const previewBlocks = [];
        for (const doc of loadedDocs) {
            const snippet = doc.text.slice(0, perDocPreview).trim();
            if (snippet) {
                previewBlocks.push(`[Preview: ${doc.relativePath}]\n${snippet}${doc.text.length > perDocPreview ? '...' : ''}`);
            }
        }
        if (previewBlocks.length > 0) {
            catalogText = `${catalogText}\n\n${previewBlocks.join('\n\n')}`.slice(0, ragCatalogLimit);
        }
    } else if (catalogText.length > ragCatalogLimit) {
        catalogText = catalogText.slice(0, ragCatalogLimit);
    }

    return {
        folderPath: resolvedPath,
        exists: true,
        mode: 'rag',
        files,
        inlineText: catalogText,
        chunks: allChunks,
        loadedFileCount: loadedDocs.length,
        totalFileCount: files.length,
        totalChars,
        totalChunks: allChunks.length,
    };
}

function searchContextBundle(bundle, queryText, { maxChunks = 5, maxChars = 7500 } = {}) {
    const chunks = bundle?.chunks;
    if (!Array.isArray(chunks) || chunks.length === 0 || !queryText || typeof queryText !== 'string') {
        return { matches: [], formattedText: '' };
    }

    const queryTokens = Array.from(new Set(tokenizeForSearch(queryText)));
    if (queryTokens.length === 0) {
        return { matches: [], formattedText: '' };
    }

    const numDocs = chunks.length;
    const docFreq = new Map();
    let totalTokenLen = 0;

    for (const chunk of chunks) {
        totalTokenLen += chunk.tokens.length;
        for (const token of queryTokens) {
            if (chunk.termFreq.has(token)) {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
            }
        }
    }

    const avgLen = Math.max(1, totalTokenLen / numDocs);
    const k1 = 1.4;
    const b = 0.7;

    const scored = [];
    for (const chunk of chunks) {
        let score = 0;
        const chunkLen = Math.max(1, chunk.tokens.length);

        for (const token of queryTokens) {
            const tf = chunk.termFreq.get(token) || 0;
            if (tf === 0) continue;

            const df = docFreq.get(token) || 1;
            const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));
            const weight = token.startsWith('~') ? 0.55 : 1.0;
            const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * chunkLen) / avgLen));
            score += idf * tfNorm * weight;
        }

        if (score > 0) {
            scored.push({
                source: chunk.source,
                section: chunk.section,
                text: chunk.text,
                score,
            });
        }
    }

    scored.sort((a, bItem) => bItem.score - aItem.score);

    const selected = [];
    let usedChars = 0;

    for (const item of scored) {
        if (selected.length >= maxChunks) break;
        const label = item.section && item.section !== 'Document' ? `${item.source} · ${item.section}` : item.source;
        const formattedBlock = `[Context: ${label}]\n${item.text}`;
        if (selected.length > 0 && usedChars + formattedBlock.length > maxChars) {
            continue;
        }
        if (formattedBlock.length <= maxChars) {
            selected.push(item);
            usedChars += formattedBlock.length + 2;
        } else if (selected.length === 0) {
            selected.push({ ...item, text: item.text.slice(0, maxChars - label.length - 20) });
            break;
        }
    }

    const formattedText = selected
        .map(item => {
            const label = item.section && item.section !== 'Document' ? `${item.source} · ${item.section}` : item.source;
            return `[Context: ${label}]\n${item.text}`;
        })
        .join('\n\n');

    return {
        matches: selected,
        formattedText,
    };
}

function summarizeContextBundle(bundle, { isDefault = false, enabled = true } = {}) {
    return {
        enabled: Boolean(enabled),
        isDefault: Boolean(isDefault),
        folderPath: bundle?.folderPath || '',
        exists: Boolean(bundle?.exists),
        mode: bundle?.mode || 'empty',
        loadedFileCount: bundle?.loadedFileCount || 0,
        totalFileCount: bundle?.totalFileCount || 0,
        totalChars: bundle?.totalChars || 0,
        totalChunks: bundle?.totalChunks || 0,
        files: Array.isArray(bundle?.files)
            ? bundle.files.map(file => ({
                  relativePath: file.relativePath,
                  name: file.name,
                  ext: file.ext,
                  sizeBytes: file.sizeBytes,
                  status: file.status,
                  charCount: file.charCount,
                  unitsLabel: file.unitsLabel,
                  reason: file.reason,
              }))
            : [],
    };
}

function copyFilesIntoContextFolder(targetFolder, sourceFilePaths = []) {
    const resolvedTarget = path.resolve(String(targetFolder));
    fs.mkdirSync(resolvedTarget, { recursive: true });

    const copied = [];
    const skipped = [];

    for (const rawPath of sourceFilePaths || []) {
        if (!rawPath || typeof rawPath !== 'string') continue;
        const srcPath = path.resolve(rawPath);

        try {
            const stat = fs.statSync(srcPath);
            if (!stat.isFile()) {
                skipped.push({ source: srcPath, reason: 'Not a file' });
                continue;
            }

            const ext = path.extname(srcPath).toLowerCase();
            const base = path.basename(srcPath, ext);
            let candidateName = `${base}${ext}`;
            let destPath = path.join(resolvedTarget, candidateName);
            let counter = 1;

            while (fs.existsSync(destPath)) {
                candidateName = `${base}-${counter}${ext}`;
                destPath = path.join(resolvedTarget, candidateName);
                counter += 1;
            }

            fs.copyFileSync(srcPath, destPath);
            copied.push(candidateName);
        } catch (error) {
            skipped.push({ source: srcPath, reason: error?.message || 'Copy failed' });
        }
    }

    clearContextCache();
    return { copied, skipped };
}

module.exports = {
    SUPPORTED_EXTENSIONS,
    DEFAULT_INLINE_CHAR_LIMIT,
    RAG_CATALOG_CHAR_LIMIT,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    MAX_FILE_BYTES,
    MAX_FILES,
    MAX_SCAN_DEPTH,
    readZipEntries,
    decodeXmlEntities,
    extractPptxText,
    extractDocxText,
    extractXlsxText,
    extractOdfText,
    extractRtfText,
    extractHtmlText,
    extractPdfText,
    extractFileContent,
    clearContextCache,
    chunkDocumentSections,
    tokenizeForSearch,
    loadContextFolder,
    searchContextBundle,
    summarizeContextBundle,
    copyFilesIntoContextFolder,
};
