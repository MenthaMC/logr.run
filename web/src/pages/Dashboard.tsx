import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/lib/ui';
import { 
    Plus, Copy, Search, Trash2, Box, AlertTriangle, 
    Check, Loader2, Server, Ghost, Edit2, X, 
    Clock, Activity, RefreshCw, Globe, Lock,
    CheckSquare, Square
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from 'recharts';
import { useToast } from '../components/ui/Toast';
import IssuesPanel from '../components/IssuesPanel';
import { API_BASE_URL } from '../config/api';
import { listProjectLogs, listProjects } from '../services/dashboardService';
import { ApiError } from '../services/http';
import { t } from '../lib/text';

const API_URL = `${API_BASE_URL}/dashboard`;

export default function Dashboard({ token, onView, onAuthError, animateOnEntry = false }) {
    const toast = useToast();
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [logs, setLogs] = useState([]);
    
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("ALL");
    const [mainTab, setMainTab] = useState('events');
    const [copySuccess, setCopySuccess] = useState(false);
    const [sortOrder, setSortOrder] = useState("desc"); 
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [projectToRename, setProjectToRename] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const searchInputRef = React.useRef(null);
    const networkToastShownRef = React.useRef(false);
    const [selectedLogIndex, setSelectedLogIndex] = useState(-1);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [visibilityUpdatingId, setVisibilityUpdatingId] = useState(null);
    const [selectedLogIds, setSelectedLogIds] = useState(new Set());
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    const filteredLogs = useMemo(() => {
        let result = logs.filter(log => {
            const term = searchQuery.toLowerCase();
            let dateStr = "";
            try {
                dateStr = new Date(log.upload_time).toLocaleString().toLowerCase();
            } catch (e) {}
            
            const logId = log.id ? log.id.toLowerCase() : "";
            const matchSearch = logId.includes(term) || dateStr.includes(term);
            const matchFilter = filterType === "ALL" || (filterType === "CRASH" && log.reason === "CRASH");
            return matchSearch && matchFilter;
        });
        return result.sort((a, b) => {
            const timeA = new Date(a.upload_time).getTime() || 0;
            const timeB = new Date(b.upload_time).getTime() || 0;
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
    }, [logs, searchQuery, filterType, sortOrder]);

    const chartData = useMemo(() => {
        const formatMonthDay = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
        const stats = {};
        for (let i = 14; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = formatMonthDay(d);
            stats[key] = 0;
        }
        logs.forEach(log => {
            try {
                const date = new Date(log.upload_time);
                if (!isNaN(date)) {
                    const key = formatMonthDay(date);
                    if (stats[key] !== undefined) stats[key]++;
                }
            } catch (e) {}
        });
        return Object.keys(stats).map(key => ({ name: key, count: stats[key] }));
    }, [logs]);

    const dailyStats = useMemo(() => {
        const getDateKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        const todayDate = new Date();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(todayDate.getDate() - 1);
        const todayKey = getDateKey(todayDate);
        const yesterdayKey = getDateKey(yesterdayDate);

        let todayCount = 0;
        let yesterdayCount = 0;
        let todayCrashCount = 0;
        let yesterdayCrashCount = 0;

        logs.forEach((log) => {
            const date = new Date(log.upload_time);
            if (isNaN(date)) return;
            const key = getDateKey(date);
            if (key === todayKey) {
                todayCount += 1;
                if (log.reason === 'CRASH') todayCrashCount += 1;
            } else if (key === yesterdayKey) {
                yesterdayCount += 1;
                if (log.reason === 'CRASH') yesterdayCrashCount += 1;
            }
        });

        const formatTrend = (today, yesterday) => {
            if (today === 0 && yesterday === 0) return "暂无数据";
            if (yesterday === 0) return "+100%";
            const percent = Math.round(((today - yesterday) / yesterday) * 100);
            return `${percent > 0 ? '+' : ''}${percent}%`;
        };

        return {
            logTrend: formatTrend(todayCount, yesterdayCount),
            crashTrend: formatTrend(todayCrashCount, yesterdayCrashCount)
        };
    }, [logs]);

    useEffect(() => {
        setSelectedLogIndex(-1);
        setSelectedLogIds(new Set());
    }, [searchQuery, filterType, sortOrder, activeProject]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
            
            if (e.key === '/' && !isInputActive && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }

            if (!isInputActive && filteredLogs && filteredLogs.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedLogIndex(prev => Math.min(prev + 1, filteredLogs.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedLogIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter' && selectedLogIndex >= 0) {
                    const log = filteredLogs[selectedLogIndex];
                    if (log) onView(log.shortId || log.id);
                } else if (e.key === 'Escape') {
                    setSearchQuery("");
                    setFilterType("ALL");
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredLogs, selectedLogIndex, onView]);

    const runAuthorized = async (requestFn) => {
        try {
            return await requestFn();
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                onAuthError?.();
                throw new Error('AUTH');
            }
            throw error;
        }
    };

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
            onAuthError?.();
            throw new Error('AUTH');
        }
        return res;
    };

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const list = await runAuthorized(() => listProjects(token));
                setProjects(list);
                if (list.length > 0) {
                    setActiveProject((prev) => prev || list[0]);
                }
            } catch (error) {
                if (error.message !== 'AUTH') {
                    if (!networkToastShownRef.current) {
                        networkToastShownRef.current = true;
                        toast.error(`无法连接到API服务器`);
                    }
                    console.error("Failed to load projects", error);
                }
            } 
            finally { setIsLoadingProjects(false); }
        };
        fetchProjects();
    }, [token]);

    useEffect(() => {
        if (!activeProject) return;
        const fetchLogs = async () => {
            setIsLoadingLogs(true);
            try {
                const nextLogs = await runAuthorized(() => listProjectLogs(activeProject.id, token));
                setLogs(nextLogs);
            } catch (error) {
                if (error.message !== 'AUTH') {
                    if (!networkToastShownRef.current) {
                        networkToastShownRef.current = true;
                        toast.error(`无法连接到API服务器`);
                    }
                    console.error("Failed to load logs", error);
                }
            } 
            finally { setIsLoadingLogs(false); }
        };
        fetchLogs();
    }, [activeProject, token, refreshTrigger]);

    const handleCopyToken = () => {
        if (activeProject?.token) {
            navigator.clipboard.writeText(activeProject.token);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            const res = await authFetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName })
            });
            if (res.status === 409) {
                toast.error("项目名称已存在");
                return;
            }
            const data = await res.json();
            if (data.success) {
                const project = data.project || data.plugin;
                if (project) {
                    setProjects([...projects, project]);
                    setActiveProject(project);
                    setNewProjectName("");
                    toast.success("项目创建成功");
                }
            }
        } catch (e) { if (e.message !== 'AUTH') toast.error("创建项目失败"); }
    };

    const openRenameModal = (e, project) => {
        e.stopPropagation();
        setProjectToRename(project);
        setRenameValue(project.name);
        setIsRenameModalOpen(true);
    };

    const handleRenameSubmit = async () => {
        if (!renameValue.trim() || !projectToRename) return;
        try {
            const res = await authFetch(`${API_URL}/projects/${projectToRename.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameValue })
            });
            if (res.status === 409) {
                toast.error("项目名称已存在");
                return;
            }
            if ((await res.json()).success) {
                const updatedProjects = projects.map(p => p.id === projectToRename.id ? { ...p, name: renameValue } : p);
                setProjects(updatedProjects);
                if (activeProject?.id === projectToRename.id) setActiveProject({ ...activeProject, name: renameValue });
                setIsRenameModalOpen(false);
                toast.success("重命名成功");
            } else { toast.error("重命名失败"); }
        } catch (e) { if (e.message !== 'AUTH') toast.error("网络错误"); }
    };

    const requestDelete = (e, type, id) => {
        e.stopPropagation();
        setDeleteConfirm({ type, id });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        const { type, id, ids } = deleteConfirm;
        try {
            if (type === 'PROJECT') {
                const res = await authFetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
                if ((await res.json()).success) {
                    const newList = projects.filter(p => p.id !== id);
                    setProjects(newList);
                    if (activeProject?.id === id) setActiveProject(newList.length > 0 ? newList[0] : null);
                    toast.success("项目已删除");
                }
            } else if (type === 'LOG') {
                const res = await authFetch(`${API_URL}/logs/${id}`, { method: 'DELETE' });
                if ((await res.json()).success) {
                    setLogs(prev => prev.filter(l => l.id !== id));
                    toast.success("日志已删除");
                }
            } else if (type === 'BATCH') {
                const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : Array.from(selectedLogIds);
                if (targetIds.length === 0) return;
                setIsBatchProcessing(true);
                const res = await authFetch(`${API_URL}/logs/batch`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: targetIds })
                });
                const raw = await res.text();
                let data = null;
                try { data = raw ? JSON.parse(raw) : null; } catch {}
                if (!res.ok) throw new Error(data?.error || raw || '请求失败');
                if (data.success) {
                    setLogs(prev => prev.filter(l => !targetIds.includes(l.id)));
                    setSelectedLogIds(new Set());
                    toast.success("批量删除成功");
                } else {
                    toast.error(data?.error ? `批量删除失败：${data.error}` : "批量删除失败");
                }
            }
        } catch (e) {
            if (e.message !== 'AUTH') {
                if (type === 'BATCH') {
                    toast.error(e?.message ? `批量删除失败：${e.message}` : "批量删除失败");
                } else {
                    toast.error("删除失败");
                }
            }
        }
        if (type === 'BATCH') setIsBatchProcessing(false);
        setDeleteConfirm(null);
    };

    const handleCopyLogLink = async (e, log) => {
        e.stopPropagation();
        const shortId = log.shortId || (log.id ? log.id.substring(0, 7) : null);
        if (!shortId) return;
        const url = `${window.location.origin}/view/${shortId}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success("链接已复制到剪贴板");
        } catch (err) {
            toast.error("复制失败: " + url);
        }
    };

    const handleToggleLogVisibility = async (e, log) => {
        e.stopPropagation();
        if (!log?.id) return;
        if (visibilityUpdatingId) return;
        const nextIsPublic = !Boolean(log.isPublic);
        setVisibilityUpdatingId(log.id);
        try {
            const res = await authFetch(`${API_BASE_URL}/logs/${log.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: nextIsPublic })
            });
            const data = await res.json();
            if (!data?.success) throw new Error(data?.error || '更新失败');
            setLogs((prev) => prev.map((item) => (item.id === log.id ? { ...item, isPublic: nextIsPublic } : item)));
        } catch (err) {
            if (err.message !== 'AUTH') toast.error('更新日志可见性失败');
        } finally {
            setVisibilityUpdatingId(null);
        }
    };

    const toggleSelectLog = (e, id) => {
        e.stopPropagation();
        const newSet = new Set(selectedLogIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedLogIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedLogIds.size === filteredLogs.length && filteredLogs.length > 0) {
            setSelectedLogIds(new Set());
        } else {
            setSelectedLogIds(new Set(filteredLogs.map(l => l.id)));
        }
    };

    const handleBatchDelete = () => {
        if (selectedLogIds.size === 0) return;
        setDeleteConfirm({ type: 'BATCH', ids: Array.from(selectedLogIds) });
    };

    const handleBatchVisibility = async (isPublic) => {
         setIsBatchProcessing(true);
        try {
            const res = await authFetch(`${API_URL}/logs/batch/visibility`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedLogIds), isPublic })
            });
             const raw = await res.text();
             let data = null;
             try { data = raw ? JSON.parse(raw) : null; } catch {}
             if (!res.ok) throw new Error(data?.error || raw || '请求失败');
            if (data.success) {
                setLogs(prev => prev.map(l => selectedLogIds.has(l.id) ? { ...l, isPublic } : l));
                setSelectedLogIds(new Set());
                toast.success(isPublic ? "已设为公开" : "已设为私有");
            } else {
                toast.error(data?.error ? `批量更新失败：${data.error}` : "批量更新失败");
            }
        } catch (e) { 
            if (e.message !== 'AUTH') toast.error(e?.message ? `批量更新失败：${e.message}` : "批量更新失败"); 
        } finally { 
            setIsBatchProcessing(false); 
        }
    };

    return (
        <div className={`dashboard-page page-shell flex flex-col md:flex-row min-h-full w-full font-sans text-zinc-200 ${animateOnEntry ? 'dashboard-page-enter' : ''}`}>
            
            <div className="dashboard-pane-left w-full md:w-64 flex flex-col border-b md:border-b-0 md:border-r border-white/10 shrink-0 h-auto md:h-[calc(100vh-64px)] md:sticky md:top-0 z-20 bg-[#0a0b0d]">
                <div className="p-4 md:p-6 flex-1 flex flex-col min-h-0">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 px-2 flex justify-between items-center shrink-0">
                        <span>项目列表</span>
                        <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{projects.length}</span>
                    </div>
                    
                    <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2">
                        {isLoadingProjects ? (
                             <div className="flex justify-center py-8"><Loader2 className="animate-spin text-zinc-700" size={16} /></div>
                        ) : (
                            projects.map(p => (
                                <Button
                                    key={p.id}
                                    onClick={() => setActiveProject(p)}
                                    className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 group relative ${activeProject?.id === p.id
                                        ? 'bg-white/10 text-white font-medium'
                                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full transition-all ${activeProject?.id === p.id ? 'bg-emerald-400 scale-125' : 'bg-zinc-500 group-hover:bg-zinc-300'}`}></span>
                                    <span className="truncate flex-1 text-left">{p.name}</span>
                                </Button>
                            ))
                        )}
                    </div>

                    <div className="pt-4 mt-2 shrink-0 border-t border-white/5">
                            <div className="relative group flex gap-2">
                                <input
                                    className="flex-1 bg-transparent border border-dashed border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition placeholder:text-zinc-500 hover:border-zinc-500"
                                    placeholder="创建项目..."
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                                />
                                <Button 
                                    onClick={handleCreateProject}
                                    className="p-2.5 rounded-xl bg-white/10 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-300 transition border border-transparent hover:border-emerald-500/20"
                                >
                                    <Plus size={14} />
                                </Button>
                            </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-pane-right flex-1 bg-[#0a0b0d] flex flex-col min-w-0 h-full relative overflow-y-auto">
                
                {activeProject ? (
                    <div className="dashboard-pane-section flex flex-col min-h-full relative pb-8">
                        <header className="px-4 py-4 md:px-8 md:py-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6 shrink-0">
                            <div>
                                <h1 className="text-2xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                                    {activeProject.name}
                                    <Button onClick={(e) => openRenameModal(e, activeProject)} className="text-zinc-400 hover:text-white transition">
                                        <Edit2 size={16} />
                                    </Button>
                                </h1>
                                <div className="flex items-center gap-4 text-xs text-zinc-400">
                                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition group" onClick={handleCopyToken}>
                                        <span className="font-mono text-zinc-300 group-hover:text-white transition">令牌：{activeProject.token || '...'}</span>
                                        {copySuccess ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                    </div>
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={12} /> {new Date(activeProject.created_at || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button 
                                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                                    className="p-2.5 bg-[#0f0f16] text-zinc-400 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/20 rounded-xl transition shadow-sm"
                                    title={t('dashboard.refreshLogs')}
                                >
                                    <RefreshCw size={18} className={isLoadingLogs ? "animate-spin" : ""} />
                                </Button>
                                <div className="relative grid grid-cols-2 bg-[#0f0f16] p-1 rounded-xl border border-white/10 shadow-sm">
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none absolute left-1 top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-out ${
                                            filterType === 'CRASH'
                                                ? 'translate-x-full bg-red-500/10 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.22)]'
                                                : 'translate-x-0 bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                                        }`}
                                    />
                                    {['ALL', 'CRASH'].map((type) => (
                                        <Button 
                                            key={type} 
                                            onClick={() => setFilterType(type)} 
                                            className={`relative z-10 px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 ${
                                                filterType === type
                                                    ? (type === 'CRASH' ? 'text-red-300' : 'text-white')
                                                    : 'text-zinc-400 hover:text-zinc-200'
                                            }`}
                                        >
                                            {type === 'CRASH' && <AlertTriangle size={12} />}
                                            {type === 'CRASH' ? t('dashboard.crash') : t('dashboard.allLogs')}
                                        </Button>
                                    ))}
                                </div>
                                <Button 
                                    onClick={(e) => requestDelete(e, 'PROJECT', activeProject.id)}
                                    className="p-2.5 bg-[#0f0f16] text-zinc-400 hover:text-red-300 border border-white/10 hover:border-red-500/20 rounded-xl transition shadow-sm" 
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 px-4 md:px-8 mb-8 shrink-0">
                            <StatCardNew 
                                title={t('dashboard.allLogs')} 
                                value={logs.length} 
                                trend={dailyStats.logTrend} 
                                icon={<Box size={20} />}
                                color="blue"
                            />
                            <StatCardNew 
                                title={t('dashboard.crash')} 
                                value={logs.filter(l => l.reason === 'CRASH').length} 
                                trend={dailyStats.crashTrend} 
                                icon={<AlertTriangle size={20} />}
                                color="red"
                            />
                            <div className="col-span-1 sm:col-span-2 md:col-span-1 page-card p-4 relative overflow-hidden flex flex-col justify-between hover:border-white/15 transition h-[160px] md:h-auto">
                                <div className="flex justify-between items-start mb-2">
                                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">趋势</span>
                                     <Activity size={16} className="text-zinc-500" />
                                </div>
                                <div className="absolute inset-0 top-8">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="name" hide />
                                            <Tooltip content={<CustomTooltip />} cursor={false} />
                                            <Area 
                                                type="monotone" 
                                                dataKey="count" 
                                                stroke="#10b981" 
                                                strokeWidth={2} 
                                                fillOpacity={1} 
                                                fill="url(#colorCount)" 
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 md:px-8 mb-4 shrink-0">
                            <div className="relative grid grid-cols-2 bg-[#0f0f16] p-1 rounded-xl border border-white/10 shadow-sm w-fit">
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute left-1 top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-all duration-300 ease-out ${
                                        mainTab === 'issues' ? 'translate-x-full' : 'translate-x-0'
                                    }`}
                                />
                                <Button
                                    onClick={() => setMainTab('events')}
                                    className={`relative z-10 px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-300 ${
                                        mainTab === 'events' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    {t('dashboard.events')}
                                </Button>
                                <Button
                                    onClick={() => setMainTab('issues')}
                                    className={`relative z-10 px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 ${
                                        mainTab === 'issues' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    <AlertTriangle size={12} /> {t('dashboard.issues')}
                                </Button>
                            </div>
                        </div>

                        {mainTab === 'issues' ? (
                        <div className="px-4 md:px-8 flex-1 min-h-0 flex flex-col">
                            <IssuesPanel token={token} activeProject={activeProject} onView={onView} onAuthError={onAuthError} />
                        </div>
                        ) : (
                        <div className="flex-1 px-4 md:px-8 min-h-0 flex flex-col">
                            <div className="bg-[#0f0f16] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl min-h-[500px]">
                                {selectedLogIds.size > 0 ? (
                                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-emerald-500/5 shrink-0 animate-fade-in">
                                        <div className="flex items-center gap-3">
                                            <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold flex items-center gap-2">
                                                <CheckSquare size={14} /> 已选择 {selectedLogIds.size} 项
                                            </div>
                                            <Button onClick={() => setSelectedLogIds(new Set())} className="text-xs text-zinc-300/80 hover:text-zinc-100 transition">取消选择</Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                onClick={() => handleBatchVisibility(true)}
                                                disabled={isBatchProcessing}
                                                className="px-3 py-1.5 bg-[#0a0b0d] border border-white/15 hover:border-emerald-500/50 text-zinc-200/90 hover:text-emerald-300 rounded-lg text-xs transition flex items-center gap-2"
                                            >
                                                <Globe size={14} /> 设为公开
                                            </Button>
                                            <Button 
                                                onClick={() => handleBatchVisibility(false)}
                                                disabled={isBatchProcessing}
                                                className="px-3 py-1.5 bg-[#0a0b0d] border border-white/15 hover:border-emerald-500/50 text-zinc-200/90 hover:text-emerald-300 rounded-lg text-xs transition flex items-center gap-2"
                                            >
                                                <Lock size={14} /> 设为私有
                                            </Button>
                                            <div className="w-px h-4 bg-white/10 mx-1"></div>
                                            <Button 
                                                onClick={handleBatchDelete}
                                                disabled={isBatchProcessing}
                                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition flex items-center gap-2 border border-red-500/20"
                                            >
                                                <Trash2 size={14} /> 批量删除
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 border-b border-white/10 flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-[#0a0b0d] shrink-0">
                                        <div className="relative flex-1">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input
                                                ref={searchInputRef}
                                                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500 font-medium pl-9 py-2 border border-white/20 rounded-lg focus:border-white/30 transition"
                                                placeholder="筛选日志..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center md:hidden text-xs text-zinc-400">
                                            <span>找到结果</span>
                                            <span className="font-mono text-zinc-200 bg-white/10 px-2 py-1 rounded">{filteredLogs.length}</span>
                                        </div>
                                        <div className="hidden md:block text-xs font-mono text-zinc-400 bg-white/10 px-2 py-1 rounded">
                                            {filteredLogs.length}
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar bg-[#0a0b0d] relative flex flex-col">
                                    <div className="min-w-[600px] md:min-w-[800px] flex flex-col flex-1">
                                        <div className="grid grid-cols-12 gap-4 px-4 py-3 md:px-6 bg-[#0a0b0d] border-b border-white/10 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                            <div className="col-span-1 flex items-center">
                                                <Button onClick={toggleSelectAll} className="text-zinc-400 hover:text-zinc-200 transition">
                                                    {filteredLogs.length > 0 && selectedLogIds.size === filteredLogs.length ? <CheckSquare size={14} /> : <Square size={14} />}
                                                </Button>
                                            </div>
                                            <div className="col-span-2">状态</div>
                                            <div className="col-span-6">日志 ID / 类型</div>
                                            <div className="col-span-2 text-right cursor-pointer hover:text-zinc-300 transition" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                                                上传时间
                                            </div>
                                            <div className="col-span-1"></div>
                                        </div>

                                        {isLoadingLogs ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                <Loader2 className="animate-spin text-emerald-500" size={24} />
                                                <span className="text-xs text-zinc-400">正在加载日志...</span>
                                            </div>
                                        ) : filteredLogs.length > 0 ? (
                                            <div className="divide-y divide-white/5">
                                                {filteredLogs.map((log, index) => (
                                                    <div 
                                                        key={log.id} 
                                                        onClick={() => onView(log.shortId || log.id)} 
                                                        className={`grid grid-cols-12 gap-4 px-4 py-3 md:px-6 md:py-4 transition-all cursor-pointer group items-center ${
                                                            selectedLogIndex === index 
                                                                ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500 pl-[14px] md:pl-[22px]' 
                                                                : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                                                        }`}
                                                    >
                                                        <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                                                            <Button onClick={(e) => toggleSelectLog(e, log.id)} className={`transition ${selectedLogIds.has(log.id) ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                                                                {selectedLogIds.has(log.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                                                            </Button>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <StatusBadge type={log.reason} />
                                                        </div>
                                                        <div className="col-span-6 flex flex-col">
                                                            <span className="font-mono text-sm text-zinc-200 group-hover:text-white transition truncate block w-full" title={log.id}>{log.id.substring(0, 7)}</span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider hidden sm:inline-block">应用日志</span>
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                                    log.isPublic
                                                                        ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5'
                                                                        : 'text-zinc-400 border-white/10 bg-white/5'
                                                                }`}>
                                                                    {log.isPublic ? '公开' : '私有'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 text-right text-xs text-zinc-400 font-mono">
                                                            {new Date(log.upload_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    onClick={(e) => handleToggleLogVisibility(e, log)}
                                                                    disabled={visibilityUpdatingId === log.id}
                                                                    className={`p-2 rounded-lg transition opacity-0 group-hover:opacity-100 ${
                                                                        log.isPublic
                                                                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                                                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                                                    } ${visibilityUpdatingId === log.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    title={log.isPublic ? '设为私有' : '设为公开'}
                                                                >
                                                                    {log.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                                                                </Button>
                                                                {log.isPublic && (
                                                                    <Button
                                                                        onClick={(e) => handleCopyLogLink(e, log)}
                                                                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition opacity-0 group-hover:opacity-100"
                                                                        title="复制链接"
                                                                    >
                                                                        <Copy size={14} />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    onClick={(e) => requestDelete(e, 'LOG', log.id)} 
                                                                    className="p-2 text-zinc-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                                                    title="删除"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center w-full px-4 md:px-6 py-20 text-zinc-400 gap-4 text-center min-h-[240px] sm:min-h-[280px] md:min-h-[320px] flex-1">
                                                <div className="p-4 rounded-full bg-white/10 border border-white/10">
                                                    <Ghost size={32} className="opacity-40" />
                                                </div>
                                                <span className="text-sm">没有匹配的日志</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                ) : (
                    <EmptyState />
                )}
            </div>

            <Modal isOpen={isRenameModalOpen} onClose={() => setIsRenameModalOpen(false)} title="重命名项目">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">项目名称</label>
                        <input className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-emerald-500 transition" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()} autoFocus />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={() => setIsRenameModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition">取消</Button>
                        <Button onClick={handleRenameSubmit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition">保存</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={deleteConfirm?.type === 'PROJECT' ? "删除项目" : (deleteConfirm?.type === 'BATCH' ? "批量删除日志" : "删除日志")}>
                <div className="space-y-6">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-zinc-300">
                            {deleteConfirm?.type === 'PROJECT' ? (
                                <>您确定要删除此项目吗？<br /><strong className="text-red-400 block mt-1">此操作无法撤销，并将删除所有相关日志。</strong></>
                            ) : deleteConfirm?.type === 'BATCH' ? (
                                <>您确定要永久删除选中的 <strong className="text-red-400">{deleteConfirm?.ids?.length || 0}</strong> 条日志吗？<br /><strong className="text-red-400 block mt-1">此操作无法撤销。</strong></>
                            ) : ("您确定要永久删除此日志文件吗？")}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition">取消</Button>
                        <Button onClick={confirmDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"><Trash2 size={16} /> 删除</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function StatCardNew({ title, value, trend, icon, color }) {
    const isRed = color === 'red';
    
    let bgClass = 'bg-white/5 text-zinc-200 border-white/10';
    let trendClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    
    if (isRed) {
        bgClass = 'bg-red-500/10 text-red-300 border-red-500/20';
        trendClass = 'bg-red-500/10 text-red-300 border-red-500/20';
    }

    return (
        <div className="page-card p-4 sm:p-5 flex flex-col justify-between hover:border-white/15 transition">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl border ${bgClass}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${trendClass}`}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{title}</div>
            </div>
        </div>
    )
}

function StatusBadge({ type }) {
    if (type === 'CRASH') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                <AlertTriangle size={10} /> 崩溃
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Check size={10} /> 正常
        </span>
    )
}

function EmptyState() {
    return (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-zinc-400 gap-8 relative overflow-hidden min-h-[calc(100vh-64px)]">
            <div className="w-28 h-28 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10">
                <Server size={44} className="text-zinc-300 opacity-80" />
            </div>
            <div className="text-center max-w-sm px-4">
                <h2 className="text-2xl font-bold text-white mb-3">欢迎使用控制台</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                    从侧边栏选择一个项目以开始监控应用日志，或创建一个新项目。
                </p>
            </div>
        </div>
    )
}

function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#111119] border border-white/10 p-2 rounded-lg shadow-xl">
                <p className="text-[10px] text-zinc-400 mb-1">{label}</p>
                <p className="text-xs font-bold text-emerald-400">
                    {payload[0].value} 日志
                </p>
            </div>
        );
    }
    return null;
}

function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-[#111119] border border-white/10 rounded-2xl shadow-2xl p-6 animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
                    <Button onClick={onClose} className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"><X size={18} /></Button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
}

