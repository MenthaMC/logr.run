import React from 'react';
import { Button } from '@heroui/react';
import { AlertTriangle, Info, Tags, BarChart3 } from 'lucide-react';

function Badge({ children }) {
  return (
    <span className="px-2 py-1 rounded-lg text-[11px] font-mono bg-white/5 border border-white/10 text-zinc-200/90">
      {children}
    </span>
  );
}

export default function LogAnalysisPanel({ analysis, onJumpToLine }) {
  if (!analysis) {
    return (
      <aside className="w-[360px] h-full shrink-0 border-l border-white/10 bg-[#0b0b12] p-4">
        <div className="glass-card rounded-2xl p-4 text-sm text-zinc-400">
          暂无分析数据
        </div>
      </aside>
    );
  }

  const meta = analysis.meta || {};
  const stats = analysis.stats || {};
  const signals = Array.isArray(analysis.signals) ? analysis.signals : [];
  const hints = Array.isArray(analysis.hints) ? analysis.hints : [];

  return (
    <aside className="w-[360px] h-full shrink-0 border-l border-white/10 bg-[#0b0b12] overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
            <Info size={14} /> Summary
          </div>
          <div className="text-sm text-zinc-100">{analysis.summary || '—'}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            <Tags size={14} /> Meta
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.severity && <Badge>{String(meta.severity).toUpperCase()}</Badge>}
            {meta.minecraftVersion && <Badge>MC {meta.minecraftVersion}</Badge>}
            {meta.loader && <Badge>{meta.loader}</Badge>}
            {meta.clientType && <Badge>{meta.clientType}</Badge>}
            {meta.javaVersion && <Badge>Java {String(meta.javaVersion).slice(0, 24)}</Badge>}
            {meta.os && <Badge>{String(meta.os).slice(0, 28)}</Badge>}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            <BarChart3 size={14} /> Stats
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2">
              <div className="text-zinc-500">Lines</div>
              <div className="text-zinc-100 font-bold">{stats.lines ?? '—'}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2">
              <div className="text-zinc-500">Errors</div>
              <div className="text-red-300 font-bold">{stats.errors ?? '—'}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2">
              <div className="text-zinc-500">Warn</div>
              <div className="text-amber-300 font-bold">{stats.warnings ?? '—'}</div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            <AlertTriangle size={14} /> Signals
          </div>
          {signals.length === 0 ? (
            <div className="text-xs text-zinc-500">无明显信号</div>
          ) : (
            <div className="space-y-2">
              {signals.map((s, idx) => (
                <Button
                  variant="light"
                  key={`${s.code || 'SIG'}-${idx}`}
                  onPress={() => onJumpToLine?.(s.line)}
                  className="w-full text-left p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-zinc-300">{s.code || 'SIGNAL'}</span>
                    <span className="text-[11px] font-mono text-zinc-500">L{s.line}</span>
                  </div>
                  <div className="text-xs text-zinc-200/90 mt-1 line-clamp-2">
                    {s.text}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>

        {hints.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Hints
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-200/90">
              {hints.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
