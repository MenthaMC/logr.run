import React, { useState } from 'react';
import { 
    Server, User, LayoutDashboard, LogOut, 
    Github, Menu, X, FileText
} from 'lucide-react';

export default function Navbar({ onNav, currentPage, token, onLogout }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center cursor-pointer group" onClick={() => onNav('home')}>
                        <span className="font-mono text-xl font-bold text-white tracking-tight group-hover:opacity-90 transition">
                            logr<span className="text-emerald-500">.run</span>
                        </span>
                    </div>
                    
                    <div className="hidden sm:flex items-center gap-6">
                        <a 
                            href="https://github.com/MenthaMC" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-zinc-400 hover:text-white transition flex items-center gap-2 text-sm font-medium"
                        >
                            <Github size={18} />
                            <span className="hidden lg:inline">GitHub</span>
                        </a>

                        <button 
                            onClick={() => onNav('api')}
                            className={`flex items-center gap-2 text-sm font-medium transition ${currentPage === 'api' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <FileText size={18} /> API
                        </button>

                        <div className="w-px h-4 bg-white/10 mx-2"></div>

                        {token ? (
                            <>
                                <button 
                                    onClick={() => onNav('dashboard')}
                                    className={`flex items-center gap-2 text-sm font-medium transition ${currentPage === 'dashboard' ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <LayoutDashboard size={18} /> 控制台
                                </button>
                                <button 
                                    onClick={onLogout}
                                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition" 
                                    title="退出登录"
                                >
                                    <LogOut size={18} />
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => onNav('login')}
                                className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-white/5 active:scale-95"
                            >
                                <User size={16} /> 登录
                            </button>
                        )}
                    </div>

                    <button 
                        className="sm:hidden p-2 text-zinc-400 hover:text-white transition"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {isMenuOpen && (
                <div className="sm:hidden glass border-t border-white/5 animate-slide-up absolute top-full left-0 w-full h-[calc(100dvh-4rem)] z-40 overflow-y-auto">
                    <div className="px-4 py-4 space-y-4">
                        <a 
                            href="https://github.com/MenthaMC" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 text-zinc-400 hover:text-white px-4 py-4 rounded-xl hover:bg-white/5 transition touch-manipulation"
                        >
                            <Github size={24} /> <span className="text-base font-medium">GitHub</span>
                        </a>

                        <button 
                            onClick={() => { onNav('api'); setIsMenuOpen(false); }}
                            className={`flex items-center gap-3 w-full px-4 py-4 rounded-xl transition touch-manipulation ${currentPage === 'api' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Server size={24} /> <span className="text-base font-medium">API 文档</span>
                        </button>

                        <div className="h-px bg-white/5 my-2"></div>

                        {token ? (
                            <>
                                <button 
                                    onClick={() => { onNav('dashboard'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-3 w-full px-4 py-4 rounded-xl transition touch-manipulation ${currentPage === 'dashboard' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <LayoutDashboard size={24} /> <span className="text-base font-medium">控制台</span>
                                </button>
                                <button 
                                    onClick={() => { onLogout(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-3 w-full px-4 py-4 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition touch-manipulation"
                                >
                                    <LogOut size={24} /> <span className="text-base font-medium">退出登录</span>
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => { onNav('login'); setIsMenuOpen(false); }}
                                className="flex items-center justify-center gap-2 w-full bg-emerald-600 text-white px-4 py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition touch-manipulation"
                            >
                                <User size={20} /> <span className="text-base">登录 / 注册</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
