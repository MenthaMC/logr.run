﻿﻿﻿import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AlertTriangle, 
  Terminal, FileText, ChevronLeft, WrapText,
  ArrowUpToLine, ArrowDownToLine, List, FileQuestion, RefreshCw, Home,
  Search, ExternalLink, ChevronUp, ChevronDown, Globe, Lock
} from 'lucide-react';
import { Button } from '@heroui/react';
import { useToast } from './ui/Toast';
import { ApiError } from '../services/http';
import { buildRawLogUrl, getLogDetail, getRawLogText, updateLogVisibility } from '../services/logService';
import LogAnalysisPanel from './LogAnalysisPanel';
import { AnimatePresence, motion } from 'framer-motion';

export default function LogViewer({ id, initialContent, onBack, token }) {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [isWrap, setIsWrap] = useState(true);
  const [activeLine, setActiveLine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [autoWrapDisabled, setAutoWrapDisabled] = useState(false);
  const [showWrapNotice, setShowWrapNotice] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  
  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const lines = useMemo(() => (content ? content.split('\n') : []), [content]);
  const totalLines = lines.length;

  const preparedLines = useMemo(() => lines.map((line, index) => {
    const isError = line.includes('ERROR') || line.includes('Exception') || line.trim().startsWith('at ');
    const isWarn = line.includes('WARN');
    return {
      line,
      lineNum: index + 1,
      isError,
      isWarn
    };
  }), [lines]);

  const visibleLines = useMemo(() => {
    if (filter === 'ERROR') return preparedLines.filter((item) => item.isError);
    if (filter === 'WARN') return preparedLines.filter((item) => item.isWarn);
    return preparedLines;
  }, [preparedLines, filter]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    const results = [];
    for (const item of visibleLines) {
      if (item.line.toLowerCase().includes(normalizedQuery)) {
        results.push(item.lineNum);
      }
    }
    return results;
  }, [visibleLines, normalizedQuery]);

  const viewportHeight = scrollRef.current ? scrollRef.current.clientHeight : 0;
  const LINE_HEIGHT = 24; // Increased for better readability
  const OVERSCAN = 30;
  const isVirtualized = !isWrap && visibleLines.length > 1000;
  const startIndex = isVirtualized
    ? Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
    : 0;
  const endIndex = isVirtualized
    ? Math.min(visibleLines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN)
    : visibleLines.length;
  const windowedLines = isVirtualized ? visibleLines.slice(startIndex, endIndex) : visibleLines;
  const topSpacerHeight = isVirtualized ? startIndex * LINE_HEIGHT : 0;
  const bottomSpacerHeight = isVirtualized ? (visibleLines.length - endIndex) * LINE_HEIGHT : 0;

  useEffect(() => {
    let cancelled = false;

    const loadLog = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getLogDetail(id, token);
        if (!data?.success) {
          throw new Error(data?.error || '日志不存在');
        }

        if (cancelled) return;
        setContent(data.content || initialContent || '');
        setMetadata(data.metadata || null);
        setAnalysis(data.analysis || null);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError) {
          if (err.status === 403) setError('RESTRICTED');
          else if (err.status === 404) setError('日志不存在');
          else setError(`HTTP ${err.status}`);
          return;
        }

        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLog();
    return () => {
      cancelled = true;
    };
  }, [id, initialContent, token]);

  useEffect(() => {
    if (!loading && content) {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#L')) {
        setTimeout(() => {
          const lineNum = parseInt(hash.replace('#L', ''), 10);
          if (!isNaN(lineNum)) scrollToLine(lineNum);
        }, 100);
      }
    }
  }, [loading, content]);

  useEffect(() => {
    setMatchIndex(0);
  }, [normalizedQuery, filter, content]);

  useEffect(() => {
    if (!searchMatches.length) {
      setMatchIndex(0);
      return;
    }
    setMatchIndex((prev) => Math.min(prev, searchMatches.length - 1));
  }, [searchMatches]);

  useEffect(() => {
    const WRAP_DISABLE_THRESHOLD = 5000;
    if (!autoWrapDisabled && totalLines > WRAP_DISABLE_THRESHOLD) {
      setIsWrap(false);
      setAutoWrapDisabled(true);
      setShowWrapNotice(true);
    }
  }, [autoWrapDisabled, totalLines]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop } = scrollRef.current;
      setScrollTop(scrollTop);
      setShowScrollTop(scrollTop > 300);
    }
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  const scrollToLine = (lineNum) => {
    const elementId = `L${lineNum}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveLine(lineNum);
      window.location.hash = `#L${lineNum}`;
      return;
    }
    if (scrollRef.current && isVirtualized) {
      scrollRef.current.scrollTo({ top: (lineNum - 1) * LINE_HEIGHT, behavior: 'smooth' });
      setActiveLine(lineNum);
      window.location.hash = `#L${lineNum}`;
    }
  };

  const handleLineClick = (lineNum) => {
    scrollToLine(lineNum);
  };

  const jumpToMatch = (direction) => {
    if (!searchMatches.length) return;
    let nextIndex = matchIndex + direction;
    if (nextIndex < 0) nextIndex = searchMatches.length - 1;
    if (nextIndex >= searchMatches.length) nextIndex = 0;
    setMatchIndex(nextIndex);
    scrollToLine(searchMatches[nextIndex]);
  };

  const formatLogId = (value) => {
    if (!value) return '';
    return value.length > 7 ? value.slice(0, 7) : value;
  };

  useEffect(() => {
    if (!metadata?.id) return;
    const shortId = metadata.shortId || formatLogId(metadata.id);
    if (!shortId) return;
    const targetPath = `/view/${shortId}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
  }, [metadata]);

  const handleOpenRaw = async () => {
    try {
      const requestId = metadata?.id || id;
      if (!token) {
        window.open(buildRawLogUrl(requestId), '_blank', 'noopener');
        return;
      }

      const text = await getRawLogText(requestId, token);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      toast.error('打开原文失败');
    }
  };

  const handleToggleVisibility = async () => {
    if (!token) return;
    if (!metadata?.projectId) return;
    if (visibilitySaving) return;
    const requestId = metadata?.id || id;
    const nextIsPublic = !metadata?.isPublic;
    setVisibilitySaving(true);
    try {
      const data = await updateLogVisibility(requestId, nextIsPublic, token);
      if (!data?.success) throw new Error(data?.error || '更新失败');
      if (data?.metadata) setMetadata((prev) => ({ ...prev, ...data.metadata }));
    } catch (err) {
      console.error(err);
      toast.error('更新日志可见性失败');
    } finally {
      setVisibilitySaving(false);
    }
  };

  const getFilterStyle = (type) => {
    const isActive = filter === type;
    const baseStyle = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border";
    if (isActive) {
      if (type === 'ERROR') return `${baseStyle} bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-900/20`;
      if (type === 'WARN') return `${baseStyle} bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-lg shadow-amber-900/20`;
      return `${baseStyle} bg-white/10 text-white border-white/10`;
    }
    return `${baseStyle} text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border-transparent`;
  };

  const renderHighlighted = (text) => {
    if (!normalizedQuery) return text;
    const lower = text.toLowerCase();
    const query = normalizedQuery;
    const parts = [];
    let start = 0;
    let index = lower.indexOf(query, start);
    while (index !== -1) {
      if (index > start) parts.push(text.slice(start, index));
      const match = text.slice(index, index + query.length);
      parts.push(
        <span key={`${index}-${match}`} className="bg-amber-500/30 text-white font-bold border-b border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]">
          {match}
        </span>
      );
      start = index + query.length;
      index = lower.indexOf(query, start);
    }
    if (start < text.length) parts.push(text.slice(start));
    return parts;
  };

  if (loading) return (
    <div className="flex flex-col h-full w-full bg-[#0b0b12] font-mono text-sm overflow-hidden">
      <div className="h-16 border-b border-white/5 flex items-center px-6">
        <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse mr-4"></div>
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse"></div>
      </div>
      <div className="flex-1 p-6 space-y-4">
         {[...Array(15)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse-slow" style={{ animationDelay: `${i * 50}ms` }}>
               <div className="w-8 h-4 bg-white/5 rounded shrink-0"></div>
               <div className="h-4 bg-white/5 rounded" style={{ width: `${Math.random() * 40 + 30}%`, opacity: 0.5 }}></div>
            </div>
         ))}
      </div>
    </div>
  );

  const isRestricted = error === "RESTRICTED";
  const isNotFound = error === "日志不存在" || error === "HTTP 404";
  const normalizedError = error && error.startsWith("HTTP ")
    ? `状态码 ${error.replace("HTTP ", "")}`
    : error;

  if (error) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-[#0b0b12] text-zinc-300 gap-6 animate-fade-in">
        <div className="relative">
            <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full"></div>
            <div className="relative glass p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                {isNotFound ? (
                  <span className="text-6xl font-bold text-zinc-200">404</span>
                ) : (
                  <FileQuestion size={64} className="text-zinc-300" />
                )}
            </div>
        </div>
        <div className="text-center max-w-md px-6">
            <h2 className="text-2xl font-bold text-white mb-3">
              {isRestricted ? '访问受限' : (isNotFound ? '日志不存在' : '无法加载日志')}
            </h2>
            <p className="text-sm text-zinc-300/80 leading-relaxed mb-8">
                {isRestricted ? (
                  <>该日志仅限特定用户访问。<br/>请登录后重试。</>
                ) : isNotFound ? (
                  <>我们无法找到 ID 为 <span className="font-mono text-zinc-200">{formatLogId(id)}</span> 的日志。<br/>它可能已被删除或过期。</>
                ) : (
                  <>加载日志时遇到错误：<br/>{normalizedError}</>
                )}
            </p>
            <div className="flex gap-4 justify-center">
                <Button onPress={onBack} className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition flex items-center gap-2">
                    <Home size={18} /> 返回首页
                </Button>
                <Button onPress={() => window.location.reload()} className="px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-medium transition flex items-center gap-2">
                    <RefreshCw size={18} /> 重试
                </Button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0b12] font-mono text-sm text-zinc-200 overflow-hidden relative">
      
      {metadata && (
        <header className="flex-none glass border-b border-white/5 z-30">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-4">
              
              <div className="flex items-center gap-3 sm:gap-4">
                <Button isIconOnly variant="light" onPress={onBack} className="p-2.5 -ml-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="返回">
                  <ChevronLeft size={20} />
                </Button>
                
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-3">
                    <h1 className="font-bold text-white tracking-tight flex items-center gap-2 text-lg font-mono truncate">
                      <FileText size={18} className="text-emerald-500 shrink-0"/>
                      <span className="truncate">{formatLogId(metadata.id)}</span>
                    </h1>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                          metadata.reason === 'CRASH' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 
                          metadata.reason === 'PREVIEW' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 
                          'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      }`}></div>
                      <span className="font-medium text-zinc-400">
                        {metadata.reason === 'CRASH' ? '崩溃' : (metadata.reason === 'PREVIEW' ? '预览' : '常规')}
                      </span>
                    </div>
                    <span className="opacity-20">|</span>
                    <div className="flex items-center gap-1.5">
                        <List size={12} />
                        <span>{totalLines.toLocaleString()} 行</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/15 rounded-lg px-2 py-1.5 w-full sm:w-64 focus-within:border-emerald-500/50 transition-colors">
                  <Search size={14} className="text-zinc-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        jumpToMatch(e.shiftKey ? -1 : 1);
                      }
                    }}
                    placeholder="搜索..."
                    className="bg-transparent text-xs text-zinc-100 w-full outline-none placeholder:text-zinc-500"
                  />
                  <span className="text-[10px] text-zinc-400 min-w-[36px] text-right font-mono">
                    {searchMatches.length ? `${matchIndex + 1}/${searchMatches.length}` : '0/0'}
                  </span>
                  <div className="flex gap-0.5">
                    <Button isIconOnly variant="light" onPress={() => jumpToMatch(-1)} isDisabled={!searchMatches.length} className="p-0.5 min-w-0 h-auto rounded hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronUp size={12}/></Button>
                    <Button isIconOnly variant="light" onPress={() => jumpToMatch(1)} isDisabled={!searchMatches.length} className="p-0.5 min-w-0 h-auto rounded hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronDown size={12}/></Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="light" onPress={() => setFilter('ALL')} className={getFilterStyle('ALL')}>全部</Button>
                  <Button variant="light" onPress={() => setFilter('ERROR')} className={getFilterStyle('ERROR')}>错误</Button>
                  <Button variant="light" onPress={() => setFilter('WARN')} className={getFilterStyle('WARN')}>警告</Button>
                </div>

                <div className="flex items-center gap-2 ml-auto md:ml-0">
                    <Button
                      isIconOnly
                      variant="light"
                      onPress={() => setShowAnalysis(v => !v)}
                      className={`p-2.5 rounded-lg border transition-all ${
                        showAnalysis
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 hover:border-white/20"
                      }`}
                      title={showAnalysis ? "隐藏分析侧栏" : "显示分析侧栏"}
                    >
                      <Terminal size={16} />
                    </Button>
                    <Button
                    isIconOnly
                    variant="light"
                    onPress={() => {
                        const next = !isWrap;
                        setIsWrap(next);
                        if (next) setShowWrapNotice(false);
                    }} 
                    className={`p-2.5 rounded-lg border transition-all ${isWrap ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-zinc-500 border-transparent hover:bg-white/5 hover:text-zinc-300"}`} 
                    title={isWrap ? "关闭换行" : "开启换行"}
                    >
                    <WrapText size={16} />
                    </Button>

                    {token && metadata?.projectId && (
                    <Button
                        isIconOnly
                        variant="light"
                        onPress={handleToggleVisibility}
                        isDisabled={visibilitySaving}
                        className={`p-2.5 rounded-lg border transition-all ${
                        metadata?.isPublic
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 hover:border-white/20'
                        } ${visibilitySaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={metadata?.isPublic ? '已公开（点击设为私有）' : '私有（点击设为公开）'}
                    >
                        {metadata?.isPublic ? <Globe size={16} /> : <Lock size={16} />}
                    </Button>
                    )}

                    <Button isIconOnly variant="light" onPress={handleOpenRaw} className="p-2.5 rounded-lg border transition-all bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 hover:border-white/20" title="查看原文">
                    <ExternalLink size={16} />
                    </Button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
      <main ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent scroll-smooth">
        <div className={`${isWrap ? 'max-w-7xl mx-auto' : 'w-fit min-w-full'} min-h-full transition-all duration-300 relative`}>
          
          {showWrapNotice && (
            <div className="m-4 md:m-6 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200/90 text-xs px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-fade-in">
              <span>为提升性能，已关闭自动换行（文件较大）。</span>
              <Button
                variant="light"
                onPress={() => { setIsWrap(true); setShowWrapNotice(false); }}
                className="px-3 py-1 rounded border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 transition text-xs"
              >
                仍然开启
              </Button>
            </div>
          )}


          {metadata?.reason === 'CRASH' && metadata?.error && (
            <div className="m-4 md:m-6 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden max-w-7xl mx-auto shadow-lg shadow-red-900/10">
              <div className="px-4 py-2 border-b border-red-500/10 bg-red-500/10 flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle size={14} /> Critical Stack Trace
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-red-300/90 text-xs leading-relaxed font-mono whitespace-pre-wrap break-all">
                  {metadata.error}
                </pre>
              </div>
            </div>
          )}

          <div className="py-4 pb-20">
            {isVirtualized && topSpacerHeight > 0 && (
              <div style={{ height: topSpacerHeight }} />
            )}
            {windowedLines.map((item) => {
              const lineNum = item.lineNum;
              const isActive = activeLine === lineNum;
              const isError = item.isError;
              const isWarn = item.isWarn;

              const displayLine = renderHighlighted(item.line);
              let containerClass = "group flex items-stretch transition-colors px-2 relative border-l-2";
              let textClass = "text-white";
              let lineNumClass = "text-zinc-400 group-hover:text-zinc-200";
              let borderClass = "border-transparent";
              let stickyBgClass = "";
              let separatorClass = "border-white/5";

              if (isActive) {
                 // Active state overrides base colors but respects severity (Error/Warn)
                 containerClass += " z-10 shadow-[0_0_15px_rgba(0,0,0,0.3)]";
                 
                 if (isError) {
                    containerClass += " bg-red-500/20 hover:bg-red-500/30";
                    borderClass = "border-red-400";
                    textClass = "text-red-50 font-bold shadow-[0_0_8px_rgba(239,68,68,0.4)]";
                    lineNumClass = "text-red-200 font-bold shadow-[0_0_8px_rgba(239,68,68,0.4)]";
                    stickyBgClass = "bg-red-500/20 group-hover:bg-red-500/30 shadow-[inset_-10px_0_20px_-10px_rgba(239,68,68,0.3)]";
                    separatorClass = "border-red-400/50";
                 } else if (isWarn) {
                    containerClass += " bg-amber-500/20 hover:bg-amber-500/30";
                    borderClass = "border-amber-400";
                    textClass = "text-amber-50 font-bold shadow-[0_0_8px_rgba(251,191,36,0.4)]";
                    lineNumClass = "text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.4)]";
                    stickyBgClass = "bg-amber-500/20 group-hover:bg-amber-500/30 shadow-[inset_-10px_0_20px_-10px_rgba(251,191,36,0.3)]";
                    separatorClass = "border-amber-400/50";
                 } else {
                    containerClass += " bg-indigo-500/25 hover:bg-indigo-500/30";
                    borderClass = "border-indigo-400";
                    textClass = "text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]";
                    lineNumClass = "text-indigo-200 font-bold shadow-[0_0_8px_rgba(165,180,252,0.4)]";
                    stickyBgClass = "bg-indigo-500/25 group-hover:bg-indigo-500/30 shadow-[inset_-10px_0_20px_-10px_rgba(99,102,241,0.3)]";
                    separatorClass = "border-indigo-400/50";
                 }
              } else {
                 // Inactive state logic
                 if (isError) {
                    containerClass += " bg-red-500/10 hover:bg-red-500/20";
                    textClass = "text-red-200";
                    lineNumClass = "text-red-300 group-hover:text-red-200";
                    borderClass = "border-red-500/40";
                    stickyBgClass = "bg-red-500/10 group-hover:bg-red-500/20";
                    separatorClass = "border-red-500/20";
                 } else if (isWarn) {
                    containerClass += " bg-amber-500/10 hover:bg-amber-500/20";
                    textClass = "text-amber-200";
                    lineNumClass = "text-amber-300 group-hover:text-amber-200";
                    borderClass = "border-amber-500/40";
                    stickyBgClass = "bg-amber-500/10 group-hover:bg-amber-500/20";
                    separatorClass = "border-amber-500/20";
                 } else {
                    containerClass += " hover:bg-white/5";
                    stickyBgClass = "group-hover:bg-white/5";
                 }
              }

              return (
                <div key={lineNum} id={`L${lineNum}`} className={`${containerClass} ${borderClass}`}>
                  <div 
                    className={`w-12 sm:w-16 flex-shrink-0 text-right pr-4 py-[2px] text-[11px] font-mono select-none cursor-pointer border-r ${separatorClass} ${lineNumClass} ${!isWrap ? 'sticky left-0 z-10' : ''}`}
                    onClick={() => handleLineClick(lineNum)}
                  >
                    {!isWrap && (
                      <>
                        <div className="absolute inset-0 w-full h-full -z-20 bg-[#0b0b12]"></div>
                        <div className={`absolute inset-0 w-full h-full -z-10 ${stickyBgClass}`}></div>
                      </>
                    )}
                    {lineNum}
                  </div>
                  <div className={`flex-1 min-w-0 pl-3 py-[2px] text-[13px] leading-6 ${textClass} ${isWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                    {displayLine || <br/>}
                  </div>
                </div>
              );
            })}
            {isVirtualized && bottomSpacerHeight > 0 && (
              <div style={{ height: bottomSpacerHeight }} />
            )}
            
            <div className="flex items-center justify-center gap-2 mt-12 opacity-30 text-zinc-500 pb-12">
               <div className="h-px w-16 bg-current"></div>
               <Terminal size={14} />
               <span className="text-xs font-medium">End of Log</span>
               <div className="h-px w-16 bg-current"></div>
            </div>
          </div>
        </div>
      </main>
      <AnimatePresence>
        {showAnalysis && (
          <motion.div
            key="analysis-sidebar"
            initial={{ width: 0, opacity: 0, x: 24 }}
            animate={{ width: 360, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 24 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="h-full shrink-0 overflow-hidden will-change-[width,opacity,transform]"
          >
            <LogAnalysisPanel analysis={analysis} onJumpToLine={scrollToLine} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        <Button
          isIconOnly
          variant="light"
          onPress={scrollToTop}
          className={`p-3 glass rounded-full text-zinc-400 hover:text-white hover:-translate-y-1 transition-all duration-300 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          title="Scroll to Top"
        >
          <ArrowUpToLine size={20} />
        </Button>
        <Button
          isIconOnly
          onPress={scrollToBottom}
          className="p-3 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 hover:-translate-y-1 transition-all active:scale-95"
          title="Scroll to Bottom"
        >
          <ArrowDownToLine size={20} />
        </Button>
      </div>
    </div>
  );
}
