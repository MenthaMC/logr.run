const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { MAX_LOG_BYTES } = require('./src/config/env.ts');
const { getHeadTailLines, toLines, toText } = require('./snippet.js');

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIR_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR = 0x06054b50;
const MAX_ZIP_ENTRIES = 500;

const LAUNCHER_MARKER = '以下为游戏输出的最后一段内容';
const LAUNCHER_LOG_PICK_ORDER = [
    'rawoutput.log',
    '启动器日志.txt',
    'log1.txt',
    '游戏崩溃前的输出.txt',
    'pcl2 启动器日志.txt',
    'pcl 启动器日志.txt'
];
const MC_LOG_PICK_ORDER = ['latest.log', 'latest log.txt', 'debug.log', 'debug log.txt'];
const DEBUG_LOG_PICK_ORDER = ['debug.log', 'debug log.txt'];
const MC_NAME_SET = new Set([
    ...LAUNCHER_LOG_PICK_ORDER,
    ...MC_LOG_PICK_ORDER
]);

const createLimitError = () => {
    const error = new Error('Log too large');
    error.code = 'LIMIT_EXCEEDED';
    return error;
};

const sanitizeFileName = (fileName) => {
    const normalized = String(fileName || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const base = path.posix.basename(normalized).trim();
    return base || 'upload.log';
};

const decodeFileName = (nameBuffer, utf8) => {
    if (!nameBuffer || nameBuffer.length === 0) return '';
    return nameBuffer.toString(utf8 ? 'utf8' : 'latin1');
};

const dosDateTimeToDate = (date, time) => {
    if (!date && !time) return null;
    const year = ((date >> 9) & 0x7f) + 1980;
    const month = (date >> 5) & 0x0f;
    const day = date & 0x1f;
    const hour = (time >> 11) & 0x1f;
    const minute = (time >> 5) & 0x3f;
    const second = (time & 0x1f) * 2;
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, hour, minute, second);
};

const findEndOfCentralDirectory = (zipBuffer) => {
    const minOffset = Math.max(0, zipBuffer.length - 0x10000 - 22);
    for (let offset = zipBuffer.length - 22; offset >= minOffset; offset -= 1) {
        if (zipBuffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIR) {
            return offset;
        }
    }
    return -1;
};

const parseZipEntries = (zipBuffer) => {
    const eocdOffset = findEndOfCentralDirectory(zipBuffer);
    if (eocdOffset < 0) throw new Error('Invalid zip: end of central directory not found');

    const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    if (totalEntries > MAX_ZIP_ENTRIES) throw createLimitError();

    let pointer = centralDirectoryOffset;
    let uncompressedTotal = 0;
    const results = [];

    for (let i = 0; i < totalEntries; i += 1) {
        if (pointer + 46 > zipBuffer.length) break;
        const signature = zipBuffer.readUInt32LE(pointer);
        if (signature !== ZIP_CENTRAL_DIR_HEADER) break;

        const flags = zipBuffer.readUInt16LE(pointer + 8);
        const compressionMethod = zipBuffer.readUInt16LE(pointer + 10);
        const lastModTime = zipBuffer.readUInt16LE(pointer + 12);
        const lastModDate = zipBuffer.readUInt16LE(pointer + 14);
        const compressedSize = zipBuffer.readUInt32LE(pointer + 20);
        const uncompressedSize = zipBuffer.readUInt32LE(pointer + 24);
        const nameLength = zipBuffer.readUInt16LE(pointer + 28);
        const extraLength = zipBuffer.readUInt16LE(pointer + 30);
        const commentLength = zipBuffer.readUInt16LE(pointer + 32);
        const localHeaderOffset = zipBuffer.readUInt32LE(pointer + 42);

        const nameStart = pointer + 46;
        const nameEnd = nameStart + nameLength;
        if (nameEnd > zipBuffer.length) break;

        const fileName = sanitizeFileName(decodeFileName(zipBuffer.subarray(nameStart, nameEnd), Boolean(flags & 0x0800)));
        pointer = nameEnd + extraLength + commentLength;

        if (!fileName || fileName.endsWith('/')) continue;
        if (uncompressedSize > MAX_LOG_BYTES) throw createLimitError();

        if (localHeaderOffset + 30 > zipBuffer.length) continue;
        const localSignature = zipBuffer.readUInt32LE(localHeaderOffset);
        if (localSignature !== ZIP_LOCAL_FILE_HEADER) continue;
        const localNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        if (dataEnd > zipBuffer.length) continue;

        const compressedData = zipBuffer.subarray(dataStart, dataEnd);
        let fileBuffer;
        if (compressionMethod === 0) {
            fileBuffer = compressedData;
        } else if (compressionMethod === 8) {
            fileBuffer = zlib.inflateRawSync(compressedData);
        } else {
            continue;
        }

        uncompressedTotal += fileBuffer.length;
        if (uncompressedTotal > MAX_LOG_BYTES * 4) throw createLimitError();

        results.push({
            name: fileName,
            text: fileBuffer.toString('utf8'),
            lastModified: dosDateTimeToDate(lastModDate, lastModTime)
        });
    }

    return results;
};

const readUploadEntries = async ({ sourcePath, originalName, mimetype }) => {
    const buffer = await fs.readFile(sourcePath);
    if (!buffer || buffer.length === 0) return [];
    if (buffer.length > MAX_LOG_BYTES * 4) throw createLimitError();

    const lowerName = String(originalName || 'upload.log').toLowerCase();
    const mime = String(mimetype || '').toLowerCase();
    const isZipBySignature =
        buffer.length >= 4
        && buffer[0] === 0x50
        && buffer[1] === 0x4b
        && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
        && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
    const isZip = lowerName.endsWith('.zip') || mime.includes('zip') || isZipBySignature;

    if (isZip) {
        return parseZipEntries(buffer);
    }

    const isGzip = lowerName.endsWith('.gz')
        || mime.includes('gzip')
        || (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);
    const plainBuffer = isGzip ? zlib.gunzipSync(buffer) : buffer;
    const baseName = sanitizeFileName(lowerName.endsWith('.gz') ? lowerName.slice(0, -3) : originalName);

    return [{
        name: baseName,
        text: plainBuffer.toString('utf8'),
        lastModified: new Date()
    }];
};

const classifyLogFileName = (fileName, lines = []) => {
    const safeName = sanitizeFileName(fileName);
    const lower = safeName.toLowerCase();
    const hasLauncherMarker = lines.some((line) => line.includes(LAUNCHER_MARKER));

    if (lower.startsWith('hs_err')) return 'hsErr';
    if (lower.startsWith('crash-') && lower.endsWith('.txt')) return 'crashReport';
    if (MC_NAME_SET.has(lower) || hasLauncherMarker) return 'minecraftLog';
    return 'extras';
};

const pickNewestFile = (entries) => {
    if (!entries || entries.length === 0) return null;
    return entries
        .slice()
        .sort((left, right) => {
            const leftTs = left.lastModified ? new Date(left.lastModified).getTime() : 0;
            const rightTs = right.lastModified ? new Date(right.lastModified).getTime() : 0;
            if (leftTs !== rightTs) return rightTs - leftTs;
            return String(left.name).localeCompare(String(right.name));
        })[0];
};

const pickByNameOrder = (entries, order) => {
    if (!entries || entries.length === 0) return null;
    const map = new Map();
    for (const entry of entries) {
        const key = sanitizeFileName(entry.name).toLowerCase();
        const existing = map.get(key);
        if (!existing) {
            map.set(key, entry);
            continue;
        }
        const existingTs = existing.lastModified ? new Date(existing.lastModified).getTime() : 0;
        const nextTs = entry.lastModified ? new Date(entry.lastModified).getTime() : 0;
        if (nextTs > existingTs) map.set(key, entry);
    }
    for (const fileName of order) {
        if (map.has(fileName)) return map.get(fileName);
    }
    return null;
};

const extractLauncherTail = (lines) => {
    let markerFound = false;
    const sliced = [];
    for (const line of lines) {
        if (markerFound) {
            sliced.push(line);
            continue;
        }
        if (line.includes(LAUNCHER_MARKER)) {
            markerFound = true;
        }
    }
    if (markerFound) return toText(sliced);
    return getHeadTailLines(lines, 0, 500);
};

const buildCombinedText = ({ mcText, debugText, crashText, hsText }) => {
    const scopes = {};
    const order = [
        { key: 'mc', label: 'MC LOG', text: mcText },
        { key: 'debug', label: 'DEBUG LOG', text: debugText },
        { key: 'crash', label: 'CRASH REPORT', text: crashText },
        { key: 'hs', label: 'HS_ERR', text: hsText }
    ].filter((item) => typeof item.text === 'string' && item.text.trim());

    if (order.length === 0) {
        return {
            combinedText: '',
            scopes: {}
        };
    }

    if (order.length === 1) {
        const only = order[0];
        const lines = toLines(only.text);
        scopes[only.key] = {
            key: only.key,
            label: only.label,
            text: toText(lines),
            lines,
            startLine: 1,
            endLine: lines.length
        };
        return {
            combinedText: scopes[only.key].text,
            scopes
        };
    }

    const combinedLines = [];
    for (const scope of order) {
        const lines = toLines(scope.text);
        if (lines.length === 0) continue;
        combinedLines.push(`===== ${scope.label} =====`);
        const startLine = combinedLines.length + 1;
        combinedLines.push(...lines);
        const endLine = combinedLines.length;
        scopes[scope.key] = {
            key: scope.key,
            label: scope.label,
            text: toText(lines),
            lines,
            startLine,
            endLine
        };
        combinedLines.push('');
    }

    while (combinedLines.length > 0 && combinedLines[combinedLines.length - 1] === '') {
        combinedLines.pop();
    }

    return {
        combinedText: combinedLines.join('\n'),
        scopes
    };
};

const prepareFromEntries = (entriesInput) => {
    const normalizedEntries = (Array.isArray(entriesInput) ? entriesInput : [])
        .map((entry, index) => {
            const name = sanitizeFileName(entry?.name || `upload-${index + 1}.log`);
            const lower = name.toLowerCase();
            if (!lower.endsWith('.log') && !lower.endsWith('.txt')) return null;

            const text = toText(toLines(entry?.text || ''));
            if (!text) return null;

            return {
                name,
                lines: toLines(text),
                text,
                lastModified: entry?.lastModified || null
            };
        })
        .filter(Boolean);

    if (normalizedEntries.length === 0) {
        return {
            mcText: null,
            debugText: null,
            crashText: null,
            hsText: null,
            combinedText: '',
            scopes: {},
            files: []
        };
    }

    const classified = normalizedEntries.map((entry) => ({
        ...entry,
        type: classifyLogFileName(entry.name, entry.lines)
    }));

    const hasStrictTypes = classified.some((entry) => entry.type !== 'extras');
    if (!hasStrictTypes) {
        for (const entry of classified) {
            entry.type = 'minecraftLog';
        }
    }

    const minecraftLogs = classified.filter((entry) => entry.type === 'minecraftLog');
    const crashReports = classified.filter((entry) => entry.type === 'crashReport');
    const hsErrFiles = classified.filter((entry) => entry.type === 'hsErr');

    const launcherLog = pickByNameOrder(minecraftLogs, LAUNCHER_LOG_PICK_ORDER);
    const mcLog = pickByNameOrder(minecraftLogs, MC_LOG_PICK_ORDER);
    const debugLog = pickByNameOrder(minecraftLogs, DEBUG_LOG_PICK_ORDER);
    const newestCrash = pickNewestFile(crashReports);
    const newestHsErr = pickNewestFile(hsErrFiles);

    let mcText = '';
    if (launcherLog) {
        mcText = extractLauncherTail(launcherLog.lines);
    }
    if (mcLog) {
        mcText = [mcText, getHeadTailLines(mcLog.lines, 1500, 500)]
            .filter(Boolean)
            .join('\n');
    }

    let debugText = debugLog ? getHeadTailLines(debugLog.lines, 1000, 0) : null;
    if (!mcText) {
        if (debugText) {
            mcText = debugText;
        } else if (minecraftLogs.length > 0) {
            mcText = getHeadTailLines(minecraftLogs[0].lines, 1500, 500);
        }
    }

    const crashText = newestCrash ? getHeadTailLines(newestCrash.lines, 300, 700) : null;
    const hsText = newestHsErr ? getHeadTailLines(newestHsErr.lines, 200, 100) : null;

    const combined = buildCombinedText({
        mcText: mcText || null,
        debugText,
        crashText,
        hsText
    });

    if (!combined.combinedText) {
        return {
            mcText: null,
            debugText: null,
            crashText: null,
            hsText: null,
            combinedText: '',
            scopes: {},
            files: classified.map((item) => ({ name: item.name, type: item.type }))
        };
    }

    if (Buffer.byteLength(combined.combinedText, 'utf8') > MAX_LOG_BYTES) {
        throw createLimitError();
    }

    return {
        mcText: mcText || null,
        debugText: debugText || null,
        crashText: crashText || null,
        hsText: hsText || null,
        combinedText: combined.combinedText,
        scopes: combined.scopes,
        files: classified.map((item) => ({ name: item.name, type: item.type }))
    };
};

const prepareLogPackFromUpload = async ({ sourcePath, originalName, mimetype }) => {
    const entries = await readUploadEntries({ sourcePath, originalName, mimetype });
    return prepareFromEntries(entries);
};

const prepareLogPackFromContent = (content, fileName = 'manual-input.log') => {
    if (typeof content !== 'string') return prepareFromEntries([]);
    return prepareFromEntries([{ name: fileName, text: content, lastModified: new Date() }]);
};

module.exports = {
    classifyLogFileName,
    prepareLogPackFromContent,
    prepareLogPackFromUpload
};
