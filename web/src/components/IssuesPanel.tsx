import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/lib/ui';
import { AlertTriangle, Bug, Search, X, Copy, Loader2 } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from 'recharts';
import { useToast } from './ui/Toast';
import { API_BASE_URL } from '../config/api';
import { t } from '../lib/text';

const API_URL = `${API_BASE_URL}/dashboard`;

function formatTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function severityDot(sev) {
  if (sev === 'error') return 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.35)]';
  if (sev === 'warn') return 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.25)]';
  return 'bg-zinc-400/60';
}

function IssueTooltip({ active, payload, label, eventsLabel = 'events' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/70 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200">
      <div className="text-zinc-400 mb-1">{label}</div>
      <div className="font-mono">{payload[0]?.value ?? 0} {eventsLabel}</div>
    </div>
  );
}

export default function IssuesPanel({ token, activeProject, onView, onAuthError }) {
  const toast = useToast();
  const [range, setRange] = useState('7d');
  const [sort, setSort] = useState('lastSeen');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (e) {
      throw new Error(`NETWORK:${e?.message || 'fetch failed'}`);
    }
    if (res.status === 401 || res.status === 403) {
      if (onAuthError) onAuthError();
      throw new Error('AUTH');
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      throw new Error(raw || `HTTP_${res.status}`);
    }
    return res;
  };

  const loadIssues = async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/issues/${activeProject.id}?range=${encodeURIComponent(range)}&sort=${encodeURIComponent(sort)}`);
      const data = await res.json();
      setIssues(Array.isArray(data.issues) ? data.issues : []);
    } catch (e) {
      if (e.message !== 'AUTH') toast.error(t('issues.loadFailed'));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDrawerOpen(false);
    setDetail(null);
    setActiveIssue(null);
    loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, range, sort]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return issues;
    return issues.filter((it) => {
      const title = (it.title || '').toLowerCase();
      const sig = (it.signature || '').toLowerCase();
      return title.includes(term) || sig.includes(term);
    });
  }, [issues, q]);

  const openIssue = async (issue) => {
    if (!activeProject?.id || !issue?.signature) return;
    setDrawerOpen(true);
    setActiveIssue(issue);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await authFetch(`${API_URL}/issues/${activeProject.id}/${issue.signature}?range=${encodeURIComponent(range)}`);
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      if (e.message !== 'AUTH') toast.error(t('issues.loadDetailFailed'));
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('issues.copySuccess'));
    } catch {
      toast.error(t('issues.copyFailed'));
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="bg-[#0f0f16] border border-white/10 rounded-2xl p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <Bug size={14} /> {t('issues.title')}
            </div>

            <div className="ml-2 relative grid grid-cols-3 bg-black/30 border border-white/10 rounded-xl p-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-lg bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-all duration-300 ease-out"
                style={{
                  width: 'calc((100% - 0.5rem) / 3)',
                  transform: `translateX(${range === '24h' ? '0%' : range === '7d' ? '100%' : '200%'})`,
                }}
              />
              {['24h', '7d', '30d'].map((v) => (
                <Button
                  variant="light"
                  key={v}
                  onPress={() => setRange(v)}
                  className={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 ${
                    range === v ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {v}
                </Button>
              ))}
            </div>

            <div className="ml-2 relative grid grid-cols-2 bg-black/30 border border-white/10 rounded-xl p-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-lg bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-all duration-300 ease-out"
                style={{
                  width: 'calc((100% - 0.5rem) / 2)',
                  transform: `translateX(${sort === 'count' ? '100%' : '0%'})`,
                }}
              />
              {[
                { k: 'lastSeen', label: t('issues.sortRecent') },
                { k: 'count', label: t('issues.sortCount') },
              ].map((v) => (
                <Button
                  variant="light"
                  key={v.k}
                  onPress={() => setSort(v.k)}
                  className={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 ${
                    sort === v.k ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 lg:max-w-[380px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('issues.searchPlaceholder')}
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 placeholder:text-zinc-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f16] border border-white/10 rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 md:px-6 bg-[#0a0b0d] border-b border-white/10 text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
          <div className="col-span-1">{t('issues.level')}</div>
          <div className="col-span-7">{t('issues.colTitle')}</div>
          <div className="col-span-2 text-right">{t('issues.colCount')}</div>
          <div className="col-span-2 text-right">{t('issues.colLastSeen')}</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#0a0b0d]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="animate-spin" size={18} />
              <span className="ml-2 text-sm">{t('issues.loading')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-sm">{t('issues.empty')}</div>
          ) : (
            filtered.map((it) => (
              <Button
                variant="light"
                key={it.signature}
                onPress={() => openIssue(it)}
                className="w-full text-left grid grid-cols-12 gap-4 px-4 py-3 md:px-6 border-b border-white/5 hover:bg-white/[0.03] transition"
              >
                <div className="col-span-1 flex items-center">
                  <span className={`w-2.5 h-2.5 rounded-full ${severityDot(it.severity)}`} />
                </div>
                <div className="col-span-7 min-w-0">
                  <div className="text-sm text-zinc-100 font-semibold truncate">
                    {it.title || it.signature}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    {it.topTags?.minecraftVersion && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">MC {it.topTags.minecraftVersion}</span>}
                    {it.topTags?.loader && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{it.topTags.loader}</span>}
                    {it.topTags?.clientType && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{it.topTags.clientType}</span>}
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono">{it.signature}</span>
                  </div>
                </div>
                <div className="col-span-2 text-right font-mono text-sm text-zinc-200">
                  {it.count ?? 0}
                </div>
                <div className="col-span-2 text-right text-xs text-zinc-400">
                  {formatTime(it.lastSeen)}
                </div>
              </Button>
            ))
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 modal-backdrop-animate"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[540px] bg-[#0a0b0d] border-l border-white/10 modal-panel-animate flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-emerald-400" />
                  <div className="font-bold text-white truncate">
                    {detail?.issue?.title || activeIssue?.title || t('issues.issueFallback')}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono">
                    {detail?.issue?.signature || activeIssue?.signature}
                  </span>
                  {detail?.issue?.severity && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      {String(detail.issue.severity).toUpperCase()}
                    </span>
                  )}
                  <Button
                    variant="light"
                    onPress={() => handleCopy(detail?.issue?.signature || activeIssue?.signature)}
                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition inline-flex items-center gap-1"
                    title={t('issues.copySignature')}
                  >
                    <Copy size={12} /> {t('issues.copySignature')}
                  </Button>
                </div>
              </div>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="ml-2 text-sm">{t('issues.detailLoading')}</span>
                </div>
              ) : !detail ? (
                <div className="text-zinc-500 text-sm">{t('issues.noData')}</div>
              ) : (
                <>
                  <div className="glass-card rounded-2xl p-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                        <div className="text-zinc-500">Count</div>
                        <div className="text-zinc-100 font-bold font-mono">{detail.issue.count ?? 0}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                        <div className="text-zinc-500">First</div>
                        <div className="text-zinc-200 font-mono text-[11px]">{formatTime(detail.issue.firstSeen)}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                        <div className="text-zinc-500">Last</div>
                        <div className="text-zinc-200 font-mono text-[11px]">{formatTime(detail.issue.lastSeen)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 h-[140px]">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('issues.timeline')}
                    </div>
                    <div className="h-[90px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.timeline || []}>
                          <defs>
                            <linearGradient id="issueFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.18}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="day" hide />
                          <Tooltip content={<IssueTooltip eventsLabel={t('issues.events')} />} cursor={false} />
                          <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#issueFill)" isAnimationActive={false}/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('issues.tags')}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {Object.entries(detail.tagStats || {}).flatMap(([tagKey, map]) =>
                        Object.entries(map || {}).map(([val, cnt]) => (
                          <span key={`${tagKey}:${val}`} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-200/90">
                            <span className="text-zinc-500 mr-1">{tagKey}:</span>
                            {val} <span className="text-zinc-500">x</span> <span className="font-mono">{cnt}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                      {t('issues.events')}
                    </div>
                    <div className="space-y-2">
                      {(detail.events || []).map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm text-zinc-100 font-semibold truncate">
                                {ev.summary || ev.reason || t('issues.eventFallback')}
                              </div>
                              <div className="mt-1 text-[11px] text-zinc-400 font-mono">
                                {ev.shortId} | {formatTime(ev.uploadTime)}
                              </div>
                            </div>
                            <Button
                              variant="light"
                              onPress={() => onView?.(ev.shortId || ev.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15 transition text-xs font-bold"
                            >
                              {t('issues.open')}
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                            {ev.meta?.minecraftVersion && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">MC {ev.meta.minecraftVersion}</span>}
                            {ev.meta?.loader && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{ev.meta.loader}</span>}
                            {ev.meta?.clientType && <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{ev.meta.clientType}</span>}
                          </div>
                        </div>
                      ))}
                      {(detail.events || []).length === 0 && (
                        <div className="text-zinc-500 text-sm">{t('issues.noEvents')}</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
