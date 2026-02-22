const fs = require('fs');
const path = require('path');

const RULES_DIR = path.resolve(__dirname, 'rules');
const DEFAULT_REGEX_FLAGS = 'i';
const MAX_EVIDENCE_TEXT_LENGTH = 500;
const DEFAULT_MAX_REASONS = 20;
const DEFAULT_MAX_EVIDENCE_PER_REASON = 5;

const SEVERITY_ORDER = {
    error: 0,
    warn: 1,
    info: 2
};

const STACK_PREFIX_BLACKLIST = [
    'java',
    'javax',
    'jdk',
    'sun',
    'org.lwjgl',
    'com.sun',
    'com.google',
    'com.mojang',
    'org.apache',
    'org.spongepowered',
    'net.minecraft',
    'net.minecraftforge',
    'net.fabricmc',
    'cpw.mods',
    'it.unimi.dsi',
    'com.electronwill.nightconfig',
    'microsoft'
];

const KEYWORD_BLACKLIST = new Set([
    'com', 'org', 'net', 'asm', 'fml', 'mod', 'jar', 'sun', 'lib', 'map', 'gui', 'dev', 'nio',
    'api', 'dsi', 'top', 'mcp', 'core', 'init', 'mods', 'main', 'file', 'game', 'load', 'read',
    'done', 'util', 'tile', 'item', 'base', 'fake', 'oshi', 'impl', 'data', 'pool', 'task',
    'forge', 'setup', 'block', 'model', 'mixin', 'event', 'unimi', 'netty', 'world', 'lwjgl',
    'fakes', 'gitlab', 'common', 'server', 'config', 'mixins', 'compat', 'loader', 'launch',
    'script', 'entity', 'assist', 'client', 'plugin', 'modapi', 'mojang', 'shader', 'events',
    'github', 'recipe', 'render', 'packet', 'preinit', 'preload', 'machine', 'reflect', 'channel',
    'general', 'handler', 'content', 'systems', 'modules', 'service', 'scripts', 'network',
    'fastutil', 'optifine', 'internal', 'platform', 'override', 'fabricmc', 'neoforge', 'external',
    'injection', 'listeners', 'scheduler', 'minecraft', 'universal', 'multipart', 'neoforged',
    'transformer', 'transformers', 'minecraftforge', 'blockentity', 'spongepowered', 'electronwill',
    'concurrent'
]);

const SCOPE_ALIAS = {
    all: 'all',
    mc: 'mc',
    log: 'mc',
    mclog: 'mc',
    minecraft: 'mc',
    minecraftlog: 'mc',
    debug: 'debug',
    debuglog: 'debug',
    crash: 'crash',
    crashreport: 'crash',
    hs: 'hs',
    hserr: 'hs'
};

let cachedRules = [];
let cachedFilesKey = '';

const normalizeSeverity = (value) => {
    const normalized = String(value || 'info').trim().toLowerCase();
    if (normalized === 'error' || normalized === 'warn' || normalized === 'info') return normalized;
    return 'info';
};

const normalizePriority = (value) => {
    const priority = parseInt(value, 10);
    if (!Number.isFinite(priority)) return null;
    if (priority < 1 || priority > 3) return null;
    return priority;
};

const normalizeAction = (action) => {
    if (!action || typeof action !== 'object') return null;
    const label = typeof action.label === 'string' ? action.label.trim() : '';
    const type = typeof action.type === 'string' ? action.type.trim().toLowerCase() : '';
    const value = typeof action.value === 'string' ? action.value : '';
    if (!label || !value) return null;
    if (type !== 'copy' && type !== 'link') return null;
    return { label, type, value };
};

const parseRegexValue = (value, explicitFlags) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const slashMatch = trimmed.match(/^\/(.+)\/([a-z]*)$/i);
    let source = trimmed;
    let flags = explicitFlags || DEFAULT_REGEX_FLAGS;

    if (slashMatch) {
        source = slashMatch[1];
        if (!explicitFlags && slashMatch[2]) flags = slashMatch[2];
    }

    try {
        return new RegExp(source, flags);
    } catch {
        return null;
    }
};

const buildMatcher = (matcher) => {
    if (!matcher || typeof matcher !== 'object') return null;
    const type = typeof matcher.type === 'string' ? matcher.type.trim().toLowerCase() : '';
    if (type === 'contains') {
        const rawValue = typeof matcher.value === 'string' ? matcher.value.trim() : '';
        if (!rawValue) return null;
        const caseSensitive = Boolean(matcher.caseSensitive);
        return {
            type,
            value: rawValue,
            caseSensitive,
            needle: caseSensitive ? rawValue : rawValue.toLowerCase()
        };
    }
    if (type === 'regex') {
        const regex = parseRegexValue(matcher.value, matcher.flags);
        if (!regex) return null;
        return {
            type,
            value: matcher.value,
            regex
        };
    }
    return null;
};

const normalizeScope = (scope) => {
    if (Array.isArray(scope)) {
        return scope
            .map((entry) => SCOPE_ALIAS[String(entry || '').trim().toLowerCase()] || null)
            .filter(Boolean)
            .join(',');
    }
    const normalized = String(scope || 'all').trim().toLowerCase();
    return SCOPE_ALIAS[normalized] || normalized || 'all';
};

const normalizeRule = (rule, fileName, ruleIndex) => {
    if (!rule || typeof rule !== 'object') return null;

    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    const priority = normalizePriority(rule.priority);
    if (!id || !priority) return null;

    const matchers = (Array.isArray(rule.match) ? rule.match : [])
        .map(buildMatcher)
        .filter(Boolean);
    if (matchers.length === 0) return null;

    const title = typeof rule.title === 'string' && rule.title.trim() ? rule.title.trim() : id;
    const message = typeof rule.message === 'string' && rule.message.trim() ? rule.message.trim() : title;
    const scope = normalizeScope(rule.scope);

    const actions = Array.isArray(rule.actions)
        ? rule.actions.map(normalizeAction).filter(Boolean)
        : [];

    return {
        id,
        priority,
        severity: normalizeSeverity(rule.severity),
        scope,
        title,
        message,
        actions,
        matchers,
        source: `${fileName}#${ruleIndex + 1}`
    };
};

const toRulesArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object' && Array.isArray(payload.rules)) {
        return payload.rules;
    }
    return [];
};

const buildFilesKey = (jsonFiles) => {
    return jsonFiles
        .map((fileName) => {
            const filePath = path.join(RULES_DIR, fileName);
            const stat = fs.statSync(filePath);
            return `${fileName}:${stat.size}:${stat.mtimeMs}`;
        })
        .join('|');
};

const loadRules = () => {
    if (!fs.existsSync(RULES_DIR)) {
        cachedRules = [];
        cachedFilesKey = '';
        return cachedRules;
    }

    const jsonFiles = fs.readdirSync(RULES_DIR)
        .filter((entry) => entry.toLowerCase().endsWith('.json'))
        .sort();

    const nextFilesKey = buildFilesKey(jsonFiles);
    if (nextFilesKey === cachedFilesKey && cachedRules.length > 0) {
        return cachedRules;
    }

    const nextRules = [];
    for (const fileName of jsonFiles) {
        const filePath = path.join(RULES_DIR, fileName);
        let payload;
        try {
            payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`[RuleEngine] Failed to parse ${fileName}:`, error.message);
            continue;
        }

        const rules = toRulesArray(payload);
        for (let i = 0; i < rules.length; i += 1) {
            const normalized = normalizeRule(rules[i], fileName, i);
            if (!normalized) continue;
            nextRules.push(normalized);
        }
    }

    cachedRules = nextRules;
    cachedFilesKey = nextFilesKey;
    return cachedRules;
};

const matchLine = (line, matcher) => {
    if (matcher.type === 'contains') {
        const haystack = matcher.caseSensitive ? line : line.toLowerCase();
        return haystack.includes(matcher.needle);
    }
    if (matcher.type === 'regex') {
        matcher.regex.lastIndex = 0;
        return matcher.regex.test(line);
    }
    return false;
};

const normalizeScopeData = (scopeKey, scope) => {
    if (!scope || typeof scope !== 'object') return null;
    const lines = Array.isArray(scope.lines)
        ? scope.lines.map((line) => String(line ?? '').replace(/\r/g, ''))
        : String(scope.text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n');
    const startLine = Math.max(1, parseInt(scope.startLine, 10) || 1);
    return {
        key: scopeKey,
        label: scope.label || scopeKey,
        text: typeof scope.text === 'string' ? scope.text : lines.join('\n'),
        lines,
        startLine
    };
};

const coercePrepared = (prepared) => {
    if (typeof prepared === 'string') {
        const lines = prepared.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        return {
            scopes: {
                mc: {
                    key: 'mc',
                    label: 'MC LOG',
                    text: prepared,
                    lines,
                    startLine: 1
                }
            }
        };
    }

    if (!prepared || typeof prepared !== 'object') {
        return { scopes: {} };
    }

    if (prepared.scopes && typeof prepared.scopes === 'object') {
        const scopes = {};
        for (const [scopeKey, scope] of Object.entries(prepared.scopes)) {
            const normalized = normalizeScopeData(scopeKey, scope);
            if (!normalized || normalized.lines.length === 0) continue;
            scopes[scopeKey] = normalized;
        }
        if (Object.keys(scopes).length > 0) return { scopes };
    }

    const scopes = {};
    let lineCursor = 1;
    const rawSources = [
        { key: 'mc', label: 'MC LOG', text: prepared.mcText || prepared.content || '' },
        { key: 'debug', label: 'DEBUG LOG', text: prepared.debugText || '' },
        { key: 'crash', label: 'CRASH REPORT', text: prepared.crashText || '' },
        { key: 'hs', label: 'HS_ERR', text: prepared.hsText || '' }
    ];
    for (const source of rawSources) {
        if (!source.text) continue;
        const lines = String(source.text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        scopes[source.key] = {
            key: source.key,
            label: source.label,
            text: source.text,
            lines,
            startLine: lineCursor
        };
        lineCursor += lines.length;
    }
    return { scopes };
};

const resolveRuleScopeKeys = (scopeRaw, scopes) => {
    const availableKeys = Object.keys(scopes);
    if (availableKeys.length === 0) return [];
    const scopeValue = String(scopeRaw || 'all').trim().toLowerCase();
    if (!scopeValue || scopeValue === 'all') return availableKeys;

    const keys = scopeValue
        .split(',')
        .map((entry) => SCOPE_ALIAS[entry.trim()] || entry.trim())
        .filter(Boolean);

    const filtered = keys.filter((key) => scopes[key]);
    return filtered.length > 0 ? filtered : availableKeys;
};

const matchRuleEvidence = (rule, scopes, { maxEvidencePerReason }) => {
    const evidence = [];
    const seen = new Set();
    const targetScopeKeys = resolveRuleScopeKeys(rule.scope, scopes);

    for (const scopeKey of targetScopeKeys) {
        const scope = scopes[scopeKey];
        if (!scope) continue;
        for (let i = 0; i < scope.lines.length; i += 1) {
            const text = String(scope.lines[i] || '');
            if (!text) continue;

            const hit = rule.matchers.some((matcher) => matchLine(text, matcher));
            if (!hit) continue;

            const globalLine = scope.startLine + i;
            const uniqueKey = `${scopeKey}:${globalLine}:${text}`;
            if (seen.has(uniqueKey)) continue;
            seen.add(uniqueKey);

            evidence.push({
                line: globalLine,
                scope: scopeKey,
                text: text.slice(0, MAX_EVIDENCE_TEXT_LENGTH)
            });

            if (evidence.length >= maxEvidencePerReason) break;
        }
        if (evidence.length >= maxEvidencePerReason) break;
    }

    return evidence;
};

const ruleToReason = (rule, evidence) => ({
    id: rule.id,
    source: 'rule',
    priority: rule.priority,
    severity: rule.severity,
    scope: rule.scope,
    title: rule.title,
    message: rule.message,
    actions: rule.actions,
    evidence
});

const runPriorityRules = (rules, scopes, priority, options) => {
    const reasons = [];
    for (const rule of rules) {
        if (rule.priority !== priority) continue;
        const evidence = matchRuleEvidence(rule, scopes, options);
        if (evidence.length === 0) continue;
        reasons.push(ruleToReason(rule, evidence));
        if (reasons.length >= options.maxReasons) break;
    }
    reasons.sort((left, right) => {
        const severityDiff = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
        if (severityDiff !== 0) return severityDiff;
        const leftLine = left.evidence[0]?.line || Number.MAX_SAFE_INTEGER;
        const rightLine = right.evidence[0]?.line || Number.MAX_SAFE_INTEGER;
        if (leftLine !== rightLine) return leftLine - rightLine;
        return String(left.id).localeCompare(String(right.id));
    });
    return reasons;
};

const extractStackKeywords = (text) => {
    if (typeof text !== 'string' || !text) return [];

    const stackCandidates = new Set();
    const stackPattern = /(?:^|[\s\t])([a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*){2,})/gm;
    let match;
    while ((match = stackPattern.exec(text)) !== null) {
        const value = String(match[1] || '').trim();
        if (!value) continue;
        if (STACK_PREFIX_BLACKLIST.some((prefix) => value.startsWith(prefix))) continue;
        stackCandidates.add(value);
    }

    const keywords = new Set();
    for (const stack of stackCandidates) {
        const parts = stack.split('.');
        const limit = Math.min(4, parts.length);
        for (let i = 0; i < limit; i += 1) {
            const word = String(parts[i] || '').trim();
            if (!word || word.length <= 2 || word.startsWith('func_')) continue;
            if (KEYWORD_BLACKLIST.has(word.toLowerCase())) continue;
            keywords.add(word);
        }
    }

    const result = Array.from(keywords);
    if (result.length > 10) return [];
    return result;
};

const collectStackKeywords = (prepared, scopes) => {
    const sourceTexts = [];
    if (prepared?.crashText) {
        sourceTexts.push(String(prepared.crashText).split(/System Details/i)[0]);
    }
    if (prepared?.mcText) sourceTexts.push(String(prepared.mcText));
    if (prepared?.hsText) {
        const hs = String(prepared.hsText);
        const start = hs.indexOf('T H R E A D');
        const end = hs.indexOf('Registers:');
        if (start >= 0 && end > start) sourceTexts.push(hs.slice(start, end));
        else sourceTexts.push(hs);
    }

    if (sourceTexts.length === 0) {
        for (const scope of Object.values(scopes)) {
            sourceTexts.push(scope.text);
        }
    }

    const allKeywords = new Set();
    for (const text of sourceTexts) {
        for (const keyword of extractStackKeywords(text)) {
            allKeywords.add(keyword);
        }
    }
    return Array.from(allKeywords);
};

const extractModHintsFromLine = (line) => {
    const hints = [];
    const jarRegex = /([^\s\\/:"'<>|]+\.jar)/gi;
    let jarMatch;
    while ((jarMatch = jarRegex.exec(line)) !== null) {
        if (!jarMatch[1]) continue;
        hints.push(jarMatch[1]);
    }

    const modRegex = /(caught exception from|from mod(?:id)?|modid)\s+([a-z0-9_.-]+)/ig;
    let modMatch;
    while ((modMatch = modRegex.exec(line)) !== null) {
        if (!modMatch[2]) continue;
        hints.push(modMatch[2]);
    }

    return hints;
};

const findEvidenceByKeywords = (scopes, keywords, limit = 8) => {
    if (!keywords || keywords.length === 0) return [];

    const normalizedKeywords = keywords.map((item) => item.toLowerCase().replace(/_/g, ''));
    const evidence = [];
    const seen = new Set();

    for (const scope of Object.values(scopes)) {
        for (let i = 0; i < scope.lines.length; i += 1) {
            const text = String(scope.lines[i] || '');
            if (!text) continue;
            const normalized = text.toLowerCase().replace(/_/g, '');
            if (!normalizedKeywords.some((keyword) => normalized.includes(keyword))) continue;

            const globalLine = scope.startLine + i;
            const uniqueKey = `${scope.key}:${globalLine}`;
            if (seen.has(uniqueKey)) continue;
            seen.add(uniqueKey);
            evidence.push({
                line: globalLine,
                scope: scope.key,
                text: text.slice(0, MAX_EVIDENCE_TEXT_LENGTH)
            });

            if (evidence.length >= limit) return evidence;
        }
    }

    return evidence;
};

const inferSuspectMods = (scopes, keywords) => {
    if (!keywords || keywords.length === 0) {
        return {
            mods: [],
            evidence: []
        };
    }

    const normalizedKeywords = keywords.map((item) => item.toLowerCase().replace(/_/g, ''));
    const modHints = new Set();
    const evidence = [];
    const seenEvidence = new Set();

    for (const scope of Object.values(scopes)) {
        for (let i = 0; i < scope.lines.length; i += 1) {
            const text = String(scope.lines[i] || '');
            if (!text) continue;

            const normalized = text.toLowerCase().replace(/_/g, '');
            const keywordHit = normalizedKeywords.some((keyword) => normalized.includes(keyword));
            if (!keywordHit) continue;

            const lineHints = extractModHintsFromLine(text);
            if (lineHints.length === 0) continue;

            for (const hint of lineHints) {
                if (!hint || hint.length > 160) continue;
                modHints.add(hint);
            }

            const globalLine = scope.startLine + i;
            const uniqueKey = `${scope.key}:${globalLine}`;
            if (seenEvidence.has(uniqueKey)) continue;
            seenEvidence.add(uniqueKey);
            evidence.push({
                line: globalLine,
                scope: scope.key,
                text: text.slice(0, MAX_EVIDENCE_TEXT_LENGTH)
            });
            if (evidence.length >= 10) break;
        }
        if (evidence.length >= 10) break;
    }

    return {
        mods: Array.from(modHints).slice(0, 10),
        evidence
    };
};

const buildStackReasons = (prepared, scopes) => {
    const keywords = collectStackKeywords(prepared, scopes);
    if (keywords.length === 0) {
        return {
            reasons: [],
            suspects: { mods: [], keywords: [] }
        };
    }

    const inferred = inferSuspectMods(scopes, keywords);
    if (inferred.mods.length > 0) {
        const reason = {
            id: 'STACK_MOD_SUSPECT',
            source: 'stack',
            priority: 3,
            severity: 'warn',
            scope: 'all',
            title: '怀疑 Mod 导致崩溃',
            message: `从堆栈和日志中定位到可疑 Mod：${inferred.mods.join('、')}。建议先逐个禁用验证。`,
            actions: [
                {
                    label: '复制可疑 Mod 列表',
                    type: 'copy',
                    value: inferred.mods.join('\n')
                }
            ],
            evidence: inferred.evidence
        };
        return {
            reasons: [reason],
            suspects: {
                mods: inferred.mods,
                keywords
            }
        };
    }

    const evidence = findEvidenceByKeywords(scopes, keywords, 8);
    const reason = {
        id: 'STACK_KEYWORD_SUSPECT',
        source: 'stack',
        priority: 3,
        severity: 'info',
        scope: 'all',
        title: '堆栈分析发现可疑关键词',
        message: `堆栈中提取到关键词：${keywords.join('、')}。可用这些词在日志中继续检索。`,
        actions: [
            {
                label: '复制关键词',
                type: 'copy',
                value: keywords.join('\n')
            }
        ],
        evidence
    };
    return {
        reasons: [reason],
        suspects: {
            mods: [],
            keywords
        }
    };
};

const flattenEvidence = (reasons) => {
    const flattened = [];
    const seen = new Set();
    for (const reason of reasons) {
        const evidence = Array.isArray(reason?.evidence) ? reason.evidence : [];
        for (const item of evidence) {
            const key = `${item.scope || 'all'}:${item.line}:${item.text}`;
            if (seen.has(key)) continue;
            seen.add(key);
            flattened.push(item);
        }
    }
    flattened.sort((left, right) => left.line - right.line);
    return flattened;
};

const reasonToMatch = (reason) => ({
    ruleId: reason.id,
    priority: reason.priority,
    severity: reason.severity,
    title: reason.title,
    message: reason.message,
    evidenceLines: Array.isArray(reason.evidence) ? reason.evidence : [],
    actions: Array.isArray(reason.actions) ? reason.actions : []
});

const finalizeResult = (reasons, suspects) => {
    const sortedReasons = reasons.slice().sort((left, right) => {
        const severityDiff = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
        if (severityDiff !== 0) return severityDiff;
        const leftLine = left.evidence?.[0]?.line || Number.MAX_SAFE_INTEGER;
        const rightLine = right.evidence?.[0]?.line || Number.MAX_SAFE_INTEGER;
        if (leftLine !== rightLine) return leftLine - rightLine;
        return String(left.id).localeCompare(String(right.id));
    });

    const evidence = flattenEvidence(sortedReasons);
    const matches = sortedReasons.map(reasonToMatch);
    return {
        reasons: sortedReasons,
        suspects: {
            mods: Array.isArray(suspects?.mods) ? suspects.mods : [],
            keywords: Array.isArray(suspects?.keywords) ? suspects.keywords : []
        },
        evidence,
        matches,
        ruleMatches: matches
    };
};

const applyRules = (preparedInput, options = {}) => {
    const rules = loadRules();
    const prepared = coercePrepared(preparedInput);
    const scopes = prepared.scopes || {};
    if (Object.keys(scopes).length === 0) {
        return finalizeResult([], { mods: [], keywords: [] });
    }

    const normalizedOptions = {
        maxReasons: Math.max(
            1,
            parseInt(options.maxReasons ?? options.maxMatches, 10) || DEFAULT_MAX_REASONS
        ),
        maxEvidencePerReason: Math.max(
            1,
            parseInt(options.maxEvidencePerReason ?? options.maxEvidenceLinesPerRule, 10) || DEFAULT_MAX_EVIDENCE_PER_REASON
        )
    };

    const p1Reasons = runPriorityRules(rules, scopes, 1, normalizedOptions);
    if (p1Reasons.length > 0) {
        return finalizeResult(p1Reasons, { mods: [], keywords: [] });
    }

    const p2Reasons = runPriorityRules(rules, scopes, 2, normalizedOptions);
    if (p2Reasons.length > 0) {
        return finalizeResult(p2Reasons, { mods: [], keywords: [] });
    }

    const stackResult = buildStackReasons(preparedInput, scopes);
    const p3Reasons = runPriorityRules(rules, scopes, 3, normalizedOptions);
    const mergedReasons = [...stackResult.reasons, ...p3Reasons].slice(0, normalizedOptions.maxReasons);

    return finalizeResult(mergedReasons, stackResult.suspects);
};

module.exports = {
    applyRules,
    loadRules
};
