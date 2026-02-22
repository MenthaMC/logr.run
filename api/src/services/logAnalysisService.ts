const crypto = require('crypto');
const {
    ANALYSIS_MAX_LINES,
    ANALYSIS_MAX_SIGNALS
} = require('../config/env.ts');
const { applyRules } = require('../../ruleEngine.js');
const { prepareLogPackFromContent } = require('../../logPack.js');

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

const maskEvidence = (items) => {
    if (!Array.isArray(items)) return items;
    return items.map((item) => ({
        ...item,
        text: maskSensitiveText(item.text)
    }));
};

const maskActions = (actions) => {
    if (!Array.isArray(actions)) return actions;
    return actions.map((action) => ({
        ...action,
        value: maskSensitiveText(action.value)
    }));
};

const maskReasons = (reasons) => {
    if (!Array.isArray(reasons)) return reasons;
    return reasons.map((reason) => ({
        ...reason,
        id: maskSensitiveText(reason.id),
        title: maskSensitiveText(reason.title),
        message: maskSensitiveText(reason.message),
        evidence: maskEvidence(reason.evidence),
        actions: maskActions(reason.actions)
    }));
};

const maskMatches = (matches) => {
    if (!Array.isArray(matches)) return matches;
    return matches.map((match) => ({
        ...match,
        ruleId: maskSensitiveText(match.ruleId),
        title: maskSensitiveText(match.title),
        message: maskSensitiveText(match.message),
        evidenceLines: maskEvidence(match.evidenceLines),
        actions: maskActions(match.actions)
    }));
};

const maskAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'object') return analysis;

    const masked = {
        ...analysis,
        summary: maskSensitiveText(analysis.summary),
        topConclusion: maskSensitiveText(analysis.topConclusion),
        meta: analysis.meta ? { ...analysis.meta } : analysis.meta,
        signals: Array.isArray(analysis.signals)
            ? analysis.signals.map((signal) => ({
                ...signal,
                text: maskSensitiveText(signal.text)
            }))
            : analysis.signals,
        hints: Array.isArray(analysis.hints)
            ? analysis.hints.map((hint) => maskSensitiveText(hint))
            : analysis.hints,
        reasons: maskReasons(analysis.reasons),
        evidence: maskEvidence(analysis.evidence),
        suspects: analysis.suspects
            ? {
                mods: Array.isArray(analysis.suspects.mods)
                    ? analysis.suspects.mods.map((item) => maskSensitiveText(item))
                    : analysis.suspects.mods,
                keywords: Array.isArray(analysis.suspects.keywords)
                    ? analysis.suspects.keywords.map((item) => maskSensitiveText(item))
                    : analysis.suspects.keywords
            }
            : analysis.suspects,
        matches: maskMatches(analysis.matches),
        ruleMatches: maskMatches(analysis.ruleMatches),
        diagnostics: analysis.diagnostics
            ? {
                ...analysis.diagnostics,
                topConclusion: maskSensitiveText(analysis.diagnostics.topConclusion),
                reasons: maskReasons(analysis.diagnostics.reasons),
                suspects: analysis.diagnostics.suspects
                    ? {
                        mods: Array.isArray(analysis.diagnostics.suspects.mods)
                            ? analysis.diagnostics.suspects.mods.map((item) => maskSensitiveText(item))
                            : analysis.diagnostics.suspects.mods,
                        keywords: Array.isArray(analysis.diagnostics.suspects.keywords)
                            ? analysis.diagnostics.suspects.keywords.map((item) => maskSensitiveText(item))
                            : analysis.diagnostics.suspects.keywords
                    }
                    : analysis.diagnostics.suspects,
                evidence: maskEvidence(analysis.diagnostics.evidence),
                matches: maskMatches(analysis.diagnostics.matches)
            }
            : analysis.diagnostics
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

const normalizePreparedInput = (input) => {
    if (!input) return null;
    if (typeof input === 'string') {
        return prepareLogPackFromContent(input, 'legacy.log');
    }
    if (typeof input !== 'object') return null;
    if (typeof input.combinedText === 'string' && input.combinedText.trim()) return input;
    if (typeof input.content === 'string' && input.content.trim()) {
        return prepareLogPackFromContent(input.content, 'legacy.log');
    }

    const fallback = [input.mcText, input.debugText, input.crashText, input.hsText]
        .filter((text) => typeof text === 'string' && text.trim())
        .join('\n');
    if (!fallback) return null;
    return {
        ...input,
        combinedText: fallback
    };
};

const normalizeReasons = (reasons) => {
    if (!Array.isArray(reasons)) return [];
    return reasons.map((reason) => ({
        id: String(reason.id || 'UNKNOWN'),
        source: reason.source || 'rule',
        priority: Number.isFinite(reason.priority) ? reason.priority : null,
        severity: reason.severity || 'info',
        title: reason.title || reason.id || 'Possible Cause',
        message: reason.message || '',
        actions: Array.isArray(reason.actions) ? reason.actions : [],
        evidence: Array.isArray(reason.evidence)
            ? reason.evidence.map((evidence) => ({
                line: parseInt(evidence.line, 10) || 0,
                scope: evidence.scope || 'all',
                text: String(evidence.text || '').slice(0, 500)
            }))
            : []
    }));
};

const normalizeMatches = (matches) => {
    if (!Array.isArray(matches)) return [];
    return matches.map((match) => ({
        ruleId: String(match.ruleId || 'UNKNOWN'),
        priority: Number.isFinite(match.priority) ? match.priority : null,
        severity: match.severity || 'info',
        title: match.title || match.ruleId || 'Possible Cause',
        message: match.message || '',
        evidenceLines: Array.isArray(match.evidenceLines)
            ? match.evidenceLines.map((item) => ({
                line: parseInt(item.line, 10) || 0,
                scope: item.scope || 'all',
                text: String(item.text || '').slice(0, 500)
            }))
            : [],
        actions: Array.isArray(match.actions) ? match.actions : []
    }));
};

const buildSignals = (reasons) => {
    const signals = [];
    const seen = new Set();

    for (const reason of reasons) {
        for (const item of reason.evidence || []) {
            if (signals.length >= ANALYSIS_MAX_SIGNALS) break;
            if (!item.line) continue;
            const key = `${reason.id}:${item.line}:${item.text}`;
            if (seen.has(key)) continue;
            seen.add(key);

            signals.push({
                line: item.line,
                text: item.text,
                code: reason.id,
                severity: reason.severity
            });
        }
        if (signals.length >= ANALYSIS_MAX_SIGNALS) break;
    }

    return signals;
};

const summarizeTopConclusion = (topReason, crashDetected) => {
    if (topReason) {
        if (topReason.title && topReason.message && topReason.title !== topReason.message) {
            return `${topReason.title}：${topReason.message}`;
        }
        return topReason.message || topReason.title || '检测到可疑问题';
    }
    return crashDetected ? '检测到崩溃报告头。' : '未发现明显崩溃特征。';
};

const analyzeLogContent = (input) => {
    const prepared = normalizePreparedInput(input);
    if (!prepared || !prepared.combinedText) return null;

    const content = String(prepared.combinedText || '');
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

    for (let i = 0; i < totalLines; i += 1) {
        const line = lines[i];
        if (!line) continue;

        if (line.includes('ERROR')) errorCount += 1;
        if (line.includes('WARN')) warnCount += 1;
        if (!crashDetected && /---- Minecraft Crash Report ----/i.test(line)) crashDetected = true;

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
            if (/Fabric Loader|fabric-loader/i.test(line)) loader = 'Fabric';
            else if (/Quilt Loader/i.test(line)) loader = 'Quilt';
            else if (/NeoForge/i.test(line)) loader = 'NeoForge';
            else if (/Forge Mod Loader|MinecraftForge|FML/i.test(line)) loader = 'Forge';
            else if (/Paper|Spigot|Bukkit/i.test(line)) loader = 'Paper/Spigot';
        }
        if (!clientType) {
            if (/Server thread|Dedicated Server|Starting minecraft server/i.test(line)) clientType = 'server';
            if (/Client thread|Minecraft client/i.test(line)) clientType = 'client';
        }
    }

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

    const rulesResult = applyRules(prepared, {
        maxReasons: ANALYSIS_MAX_SIGNALS,
        maxEvidencePerReason: 6
    });
    const reasons = normalizeReasons(rulesResult.reasons);
    const matches = normalizeMatches(rulesResult.matches);
    const evidence = Array.isArray(rulesResult.evidence)
        ? rulesResult.evidence.map((item) => ({
            line: parseInt(item.line, 10) || 0,
            scope: item.scope || 'all',
            text: String(item.text || '').slice(0, 500)
        }))
        : [];
    const suspects = {
        mods: Array.isArray(rulesResult.suspects?.mods) ? rulesResult.suspects.mods : [],
        keywords: Array.isArray(rulesResult.suspects?.keywords) ? rulesResult.suspects.keywords : []
    };

    const topReason = reasons[0] || null;
    const topConclusion = summarizeTopConclusion(topReason, crashDetected);
    const summary = topReason
        ? `已识别 ${reasons.length} 条可能原因，优先处理：${topReason.title}。`
        : (crashDetected ? '检测到崩溃报告。' : '未发现明显崩溃特征。');

    const hints = Array.from(new Set(
        reasons
            .map((reason) => reason.message)
            .filter(Boolean)
    ));
    const signals = buildSignals(reasons);

    const severity =
        reasons.some((reason) => reason.severity === 'error') ? 'error'
        : reasons.some((reason) => reason.severity === 'warn') ? 'warn'
        : crashDetected ? 'error'
        : 'info';

    const seed = (
        causedBy
        || exceptionType
        || (topReason ? `${topReason.id}:${topReason.title}` : null)
        || (signals[0] ? `${signals[0].code}:${signals[0].text}` : null)
        || (crashDetected ? 'CRASH_REPORT' : 'LOG')
    ).slice(0, 500);
    const signature = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12);

    return {
        summary,
        topConclusion,
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
        hints,
        reasons,
        suspects,
        evidence,
        matches,
        ruleMatches: matches,
        diagnostics: {
            topConclusion,
            reasons,
            suspects,
            evidence,
            matches
        }
    };
};

module.exports = {
    analyzeLogContent,
    maskAnalysis,
    maskMetadata,
    maskSensitiveText
};
