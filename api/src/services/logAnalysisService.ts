const crypto = require('crypto');
const {
    ANALYSIS_MAX_LINES,
    ANALYSIS_MAX_SIGNALS
} = require('../config/env.ts');

const ANALYSIS_PATTERNS = [
    {
        code: 'OUT_OF_MEMORY',
        regex: /OutOfMemoryError/i,
        severity: 'error',
        hint: 'OutOfMemoryError detected. Increase memory or reduce mods/plugins.'
    },
    {
        code: 'STACK_OVERFLOW',
        regex: /StackOverflowError/i,
        severity: 'error',
        hint: 'StackOverflowError detected. A mod/plugin may be stuck in recursive calls.'
    },
    {
        code: 'CLASS_NOT_FOUND',
        regex: /(ClassNotFoundException|NoClassDefFoundError)/i,
        severity: 'error',
        hint: 'Missing class detected. Check mod/plugin dependencies and version compatibility.'
    },
    {
        code: 'NO_SUCH_METHOD',
        regex: /NoSuchMethodError/i,
        severity: 'error',
        hint: 'NoSuchMethodError detected. Likely incompatible mod/plugin versions.'
    },
    {
        code: 'MOD_RESOLUTION',
        regex: /(Missing\s+mods|Missing Mods|ModResolutionException|ModLoadingException|Failed to load mod)/i,
        severity: 'error',
        hint: 'Mod resolution failed. Check missing or incompatible mods.'
    },
    {
        code: 'MIXIN_FAILED',
        regex: /(Mixin apply failed|MixinApplyError|MixinTransformerError)/i,
        severity: 'error',
        hint: 'Mixin apply failed. Check mod/loader compatibility.'
    },
    {
        code: 'PLUGIN_EXCEPTION',
        regex: /(Exception in thread|Caused by:)/i,
        severity: 'warn',
        hint: 'Exception detected. Check the stack trace near this line.'
    }
];

const MASK_RULES = [
    { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '***.***.***.***' },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '***@***.***' },
    { regex: /((?:password|passwd|pwd|secret|token|api_key|auth|access_key)["']?\s*[:=]\s*["']?)([^"'\s]+)(["']?)/gi, replacement: '$1********$3' },
    { regex: /\b(1[3-9]\d{2})\d{4}(\d{4})\b/g, replacement: '$1****$2' }
];

const maskSensitiveText = (text) => {
    if (typeof text !== 'string') return text;
    let masked = text;
    for (const rule of MASK_RULES) {
        masked = masked.replace(rule.regex, rule.replacement);
    }
    return masked;
};

const maskMetadata = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return metadata;
    return { ...metadata, error: maskSensitiveText(metadata.error) };
};

const maskAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'object') return analysis;
    const masked = {
        ...analysis,
        summary: maskSensitiveText(analysis.summary),
        meta: analysis.meta ? { ...analysis.meta } : analysis.meta,
        signals: Array.isArray(analysis.signals)
            ? analysis.signals.map((signal) => ({
                ...signal,
                text: maskSensitiveText(signal.text)
            }))
            : analysis.signals
    };
    if (masked.meta) {
        for (const key of Object.keys(masked.meta)) {
            if (typeof masked.meta[key] === 'string') {
                masked.meta[key] = maskSensitiveText(masked.meta[key]);
            }
        }
    }
    return masked;
};

const analyzeLogContent = (content) => {
    if (!content) return null;
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    const scanStart = Math.max(0, totalLines - ANALYSIS_MAX_LINES);

    let errorCount = 0;
    let warnCount = 0;
    let crashDetected = false;
    let minecraftVersion = null;
    let loader = null;
    let javaVersion = null;
    let os = null;
    let runtime = null;
    let clientType = null;

    const signals = [];
    const hints = new Set();

    const pushSignal = (lineIndex, text, code, severity) => {
        if (signals.length >= ANALYSIS_MAX_SIGNALS) return;
        signals.push({
            line: lineIndex + 1,
            text: text.slice(0, 500),
            code,
            severity
        });
    };

    for (let i = 0; i < totalLines; i += 1) {
        const line = lines[i];
        if (!line) continue;

        if (line.includes('ERROR')) errorCount += 1;
        if (line.includes('WARN')) warnCount += 1;

        if (!minecraftVersion) {
            const match = line.match(/Minecraft(?:\s+Version)?[:=]\s*([0-9.]+)/i)
                || line.match(/MC\s*Version[:=]\s*([0-9.]+)/i);
            if (match) minecraftVersion = match[1];
        }
        if (!javaVersion) {
            const match = line.match(/Java\s+Version[:=]\s*([^\s,]+.*)/i)
                || line.match(/java version\s+"([^"]+)"/i);
            if (match) javaVersion = match[1];
        }
        if (!os) {
            const match = line.match(/Operating System:\s*(.*)/i)
                || line.match(/OS:\s*(.*)/i);
            if (match) os = match[1];
        }
        if (!runtime) {
            const match = line.match(/JVM\s+Flags:\s*(.*)/i);
            if (match) runtime = match[1];
        }
        if (!loader) {
            if (/Fabric Loader/i.test(line) || /fabric-loader/i.test(line)) loader = 'Fabric';
            else if (/Quilt Loader/i.test(line)) loader = 'Quilt';
            else if (/Forge Mod Loader|MinecraftForge|FML/i.test(line)) loader = 'Forge';
            else if (/Paper|Spigot|Bukkit/i.test(line)) loader = 'Paper/Spigot';
        }
        if (!clientType) {
            if (/Server thread|Dedicated Server|Starting minecraft server/i.test(line)) clientType = 'server';
            if (/Client thread|Minecraft client/i.test(line)) clientType = 'client';
        }

        if (!crashDetected && /---- Minecraft Crash Report ----/i.test(line)) {
            crashDetected = true;
        }

        if (i < scanStart) continue;

        for (const pattern of ANALYSIS_PATTERNS) {
            if (pattern.regex.test(line)) {
                pushSignal(i, line, pattern.code, pattern.severity);
                if (pattern.hint) hints.add(pattern.hint);
                break;
            }
        }
    }

    const summary = crashDetected
        ? 'Crash report detected.'
        : (signals.length > 0 ? 'Potential issues detected.' : 'No obvious crash detected.');

    // Issue signature / title helpers
    let causedBy = null;
    let exceptionType = null;

    for (let i = scanStart; i < totalLines; i += 1) {
        const line = lines[i] || '';
        if (!causedBy) {
            const match = line.match(/Caused by:\s*(.+)$/i);
            if (match) causedBy = match[1].trim().slice(0, 220);
        }
        if (!exceptionType) {
            const match = line.match(/\b([a-zA-Z0-9_.$]+(?:Exception|Error))\b/);
            if (match) exceptionType = match[1];
        }
        if (causedBy && exceptionType) break;
    }

    const severity =
        signals.some((s) => s.severity === 'error') ? 'error'
        : signals.some((s) => s.severity === 'warn') ? 'warn'
        : crashDetected ? 'error'
        : 'info';

    const seed = (
        causedBy
        || exceptionType
        || (signals[0] ? `${signals[0].code}:${signals[0].text}` : null)
        || (crashDetected ? 'CRASH_REPORT' : 'LOG')
    ).slice(0, 500);

    const signature = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12);

    return {
        summary,
        meta: {
            minecraftVersion,
            loader,
            javaVersion,
            os,
            runtime,
            clientType,
            signature,
            exceptionType,
            causedBy,
            severity
        },
        stats: {
            lines: totalLines,
            errors: errorCount,
            warnings: warnCount
        },
        signals,
        hints: Array.from(hints)
    };
};

module.exports = {
    analyzeLogContent,
    maskAnalysis,
    maskMetadata,
    maskSensitiveText
};
