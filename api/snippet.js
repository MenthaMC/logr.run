const normalizeLine = (line) => {
    if (line === null || line === undefined) return '';
    return String(line).replace(/\r/g, '');
};

const toLines = (input) => {
    if (Array.isArray(input)) {
        return input.map(normalizeLine);
    }
    if (typeof input === 'string') {
        const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return text.split('\n').map((line) => normalizeLine(line));
    }
    return [];
};

const toText = (lines) => {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    return lines
        .map(normalizeLine)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const getHeadTailLines = (rawLines, headLines, tailLines) => {
    const lines = toLines(rawLines);
    const head = Math.max(0, parseInt(headLines, 10) || 0);
    const tail = Math.max(0, parseInt(tailLines, 10) || 0);

    if (lines.length === 0) return '';

    const joinDistinct = (source) => {
        const seen = new Set();
        const out = [];
        for (const line of source) {
            const normalized = normalizeLine(line);
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            out.push(normalized);
        }
        return out.join('\n');
    };

    if (lines.length <= head + tail) {
        return joinDistinct(lines);
    }

    const result = [];
    let realHeadLines = 0;
    let viewedIndex = 0;

    for (; viewedIndex < lines.length; viewedIndex += 1) {
        const current = normalizeLine(lines[viewedIndex]);
        if (!current || result.includes(current)) continue;
        realHeadLines += 1;
        result.push(current);
        if (realHeadLines >= head) break;
    }

    let realTailLines = 0;
    for (let i = lines.length - 1; i > viewedIndex; i -= 1) {
        const current = normalizeLine(lines[i]);
        if (!current || result.includes(current)) continue;
        realTailLines += 1;
        result.splice(realHeadLines, 0, current);
        if (realTailLines >= tail) break;
    }

    return result
        .filter((line) => line !== '')
        .join('\n');
};

module.exports = {
    getHeadTailLines,
    toLines,
    toText
};
