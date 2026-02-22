import React, { useMemo, useState } from 'react';
import { Button } from '@/lib/ui';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, ExternalLink, FileSearch, Tags } from 'lucide-react';
import { useToast } from './ui/Toast';

const SEVERITY_META = {
  error: {
    label: 'ERROR',
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 border-red-500/30 text-red-200',
    border: 'border-red-500/20',
  },
  warn: {
    label: 'WARN',
    dot: 'bg-amber-300',
    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    border: 'border-amber-500/20',
  },
  info: {
    label: 'INFO',
    dot: 'bg-sky-300',
    badge: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
    border: 'border-sky-500/20',
  },
};

const getSeverityMeta = (severity) => {
  const key = String(severity || 'info').toLowerCase();
  return SEVERITY_META[key] || SEVERITY_META.info;
};

const normalizeReasons = (analysis) => {
  if (!analysis || typeof analysis !== 'object') return [];

  if (Array.isArray(analysis.reasons) && analysis.reasons.length > 0) {
    return analysis.reasons.map((reason) => ({
      id: reason.id || 'UNKNOWN',
      severity: reason.severity || 'info',
      title: reason.title || reason.id || 'Possible Cause',
      message: reason.message || '',
      actions: Array.isArray(reason.actions) ? reason.actions : [],
      evidence: Array.isArray(reason.evidence) ? reason.evidence : [],
      source: reason.source || 'rule',
    }));
  }

  const matches = Array.isArray(analysis?.diagnostics?.matches)
    ? analysis.diagnostics.matches
    : (Array.isArray(analysis?.matches) ? analysis.matches : []);

  return matches.map((match) => ({
    id: match.ruleId || 'UNKNOWN',
    severity: match.severity || 'info',
    title: match.title || match.ruleId || 'Possible Cause',
    message: match.message || '',
    actions: Array.isArray(match.actions) ? match.actions : [],
    evidence: Array.isArray(match.evidenceLines) ? match.evidenceLines : [],
    source: 'rule',
  }));
};

const normalizeSuspects = (analysis) => {
  if (!analysis || typeof analysis !== 'object') return { mods: [], keywords: [] };
  const suspects = analysis.suspects || analysis?.diagnostics?.suspects || {};
  return {
    mods: Array.isArray(suspects.mods) ? suspects.mods : [],
    keywords: Array.isArray(suspects.keywords) ? suspects.keywords : [],
  };
};

export default function AnalysisPanel({ analysis, onJumpToLine }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState({});

  const reasons = useMemo(() => normalizeReasons(analysis), [analysis]);
  const suspects = useMemo(() => normalizeSuspects(analysis), [analysis]);
  const topConclusion =
    analysis?.topConclusion
    || analysis?.diagnostics?.topConclusion
    || reasons[0]?.message
    || analysis?.summary
    || 'No diagnostics available.';

  const evidenceCount = reasons.reduce((sum, reason) => (
    sum + (Array.isArray(reason.evidence) ? reason.evidence.length : 0)
  ), 0);

  const toggleExpanded = (reasonId, index) => {
    const key = `${reasonId}-${index}`;
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAction = async (action, reasonId) => {
    if (!action || typeof action !== 'object') return;
    const value = typeof action.value === 'string' ? action.value : '';
    if (!value) return;

    try {
      if (action.type === 'copy') {
        await navigator.clipboard.writeText(value);
        toast.success(`已复制 ${reasonId}`);
        return;
      }
      if (action.type === 'link') {
        window.open(value, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch (error) {
      console.error(error);
      toast.error('操作失败');
    }
  };

  if (!analysis) {
    return (
      <aside className="h-full w-[380px] shrink-0 border-l border-white/10 bg-[#0b0b12] p-4">
        <div className="glass-card rounded-2xl p-4 text-sm text-zinc-400">
          暂无诊断结果
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full w-[380px] shrink-0 border-l border-white/10 bg-[#0b0b12] overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-3">
        <div className="glass-card rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
            <FileSearch size={14} />
            Top Conclusion
          </div>
          <div className="text-sm text-zinc-100 leading-relaxed">
            {topConclusion}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400">
            <span>{reasons.length} reasons</span>
            <span className="opacity-40">|</span>
            <span>{evidenceCount} evidence lines</span>
          </div>
        </div>

        {(suspects.mods.length > 0 || suspects.keywords.length > 0) && (
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              <Tags size={14} />
              Suspects
            </div>
            <div className="space-y-2 text-xs">
              {suspects.mods.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suspects.mods.map((mod, idx) => (
                    <span key={`${mod}-${idx}`} className="px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-200">
                      {mod}
                    </span>
                  ))}
                </div>
              )}
              {suspects.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suspects.keywords.map((keyword, idx) => (
                    <span key={`${keyword}-${idx}`} className="px-1.5 py-0.5 rounded border border-white/20 bg-black/20 text-zinc-300">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="glass-card rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            <AlertTriangle size={14} />
            Reasons
          </div>

          {reasons.length === 0 ? (
            <div className="text-xs text-zinc-500">未命中可用规则。</div>
          ) : (
            <div className="space-y-3">
              {reasons.map((reason, index) => {
                const severityMeta = getSeverityMeta(reason.severity);
                const evidence = Array.isArray(reason.evidence) ? reason.evidence : [];
                const actions = Array.isArray(reason.actions) ? reason.actions : [];
                const key = `${reason.id}-${index}`;
                const isExpanded = Boolean(expanded[key]);

                return (
                  <div key={key} className={`rounded-xl border bg-white/5 p-3 ${severityMeta.border}`}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(reason.id, index)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${severityMeta.dot}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-100 truncate">
                              {reason.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              {reason.id}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${severityMeta.badge}`}>
                            {severityMeta.label}
                          </span>
                          {isExpanded ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-200/90 leading-relaxed">
                        {reason.message}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {evidence.length > 0 && (
                          <div className="space-y-2">
                            {evidence.map((item, evidenceIndex) => (
                              <Button
                                key={`${key}-evidence-${evidenceIndex}`}
                                onPress={() => item.line > 0 && onJumpToLine?.(item.line)}
                                className="w-full text-left rounded-lg border border-white/10 bg-black/20 hover:bg-white/10 transition px-2.5 py-2"
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-mono text-zinc-300">L{item.line || '?'}</span>
                                  <span className="text-zinc-500">{item.scope || 'all'}</span>
                                </div>
                                <div className="mt-1 text-xs text-zinc-200/90 line-clamp-2 break-all">
                                  {item.text}
                                </div>
                              </Button>
                            ))}
                          </div>
                        )}

                        {actions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {actions.map((action, actionIndex) => (
                              <Button
                                key={`${key}-action-${actionIndex}`}
                                onPress={() => handleAction(action, reason.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] text-zinc-200 inline-flex items-center gap-1.5"
                              >
                                {action.type === 'copy' ? <Copy size={12} /> : <ExternalLink size={12} />}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
