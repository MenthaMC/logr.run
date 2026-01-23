import React, { useState, useEffect } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.logr.run";
const API_URL = `${API_BASE_URL}/auth`;
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAACMfhNy4dpEna30X";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function Login({ onLogin }) {
    const toast = useToast();
    const [isReg, setIsReg] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileLoading, setTurnstileLoading] = useState(true);
    const turnstileRef = React.useRef(null);
    const turnstileScriptRef = React.useRef(null);
    const widgetIdRef = React.useRef(null);

    const formatAuthError = (rawError) => {
        if (!rawError) return isReg ? "注册失败，请稍后再试" : "登录失败，请稍后再试";
        if (rawError === "Missing fields") return "请填写完整信息";
        if (rawError === "Invalid fields") return "账号或密码格式不正确";
        if (rawError === "Username too long") return "用户名过长";
        if (rawError === "Password too long") return "密码过长";
        if (rawError === "User not found") return "账号未注册";
        if (rawError === "Password mismatch") return "两次输入的密码不一致，请重新输入";
        if (rawError === "Invalid credentials") return "账号或密码不正确";
        if (rawError === "Username already exists or error") return "用户名已存在或注册失败";
        if (rawError === "Invalid captcha") return "验证失败，请重试";
        if (rawError === "Captcha required") return "请完成人机验证";
        if (rawError === "Captcha expired") return "验证已过期，请刷新";
        if (rawError === "Weak password") return "密码过弱，请使用至少8位包含字母和数字的组合";
        return rawError;
    };

    const isWeakPassword = (password) => {
        if (password.length < 8) return true;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        return !hasLetter || !hasNumber;
    };

    const loadTurnstileScript = () => {
        if (window.turnstile) return Promise.resolve();
        if (turnstileScriptRef.current) return turnstileScriptRef.current;
        turnstileScriptRef.current = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = TURNSTILE_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.dataset.turnstile = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('turnstile'));
            document.head.appendChild(script);
        });
        return turnstileScriptRef.current;
    };

    const resetTurnstile = () => {
        setTurnstileToken("");
        if (window.turnstile && widgetIdRef.current !== null) {
            window.turnstile.reset(widgetIdRef.current);
        }
    };

    const renderTurnstile = async () => {
        setTurnstileLoading(true);
        setTurnstileToken("");
        if (!TURNSTILE_SITE_KEY) {
            setError("未配置 Turnstile 站点密钥");
            setTurnstileLoading(false);
            return;
        }
        try {
            await loadTurnstileScript();
            if (!turnstileRef.current || !window.turnstile) return;
            if (widgetIdRef.current !== null) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
            widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'dark',
                callback: (token) => {
                    setTurnstileToken(token);
                    setError(null);
                },
                'expired-callback': () => {
                    setTurnstileToken("");
                },
                'error-callback': () => {
                    setTurnstileToken("");
                    setError("验证失败，请重试");
                }
            });
        } catch (err) {
            setError("验证加载失败，请稍后再试");
        } finally {
            setTurnstileLoading(false);
        }
    };

    useEffect(() => {
        renderTurnstile();
        return () => {
            if (window.turnstile && widgetIdRef.current !== null) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [isReg]);

    const passwordsMismatch = isReg && form.password && form.confirmPassword && form.password !== form.confirmPassword;

    useEffect(() => {
        if (!passwordsMismatch && error === "两次输入的密码不一致，请重新输入") {
            setError(null);
        }
    }, [passwordsMismatch, error]);

    const submit = async () => {
        if (!form.username || !form.password) return;
        
        if (isReg && !form.confirmPassword) {
            setError("请确认密码");
            return;
        }

        if (isReg && form.password !== form.confirmPassword) {
            setError("两次输入的密码不一致，请重新输入");
            return;
        }

        if (isReg && isWeakPassword(form.password)) {
            setError("密码过弱，请使用至少8位包含字母和数字的组合");
            return;
        }

        if (!turnstileToken) {
            setError("请完成人机验证");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const endpoint = isReg ? '/register' : '/login';
            const res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, turnstileToken })
            });
            const data = await res.json();
            if (data.success) {
                if (isReg) {
                    setIsReg(false);
                    setError(null);
                    setForm({ username: '', password: '', confirmPassword: '' });
                    toast.success("注册成功，请登录");
                } else {
                    onLogin(data.token);
                }
                resetTurnstile();
            } else {
                const rawError = data.error || "验证失败";
                setError(formatAuthError(rawError));
                resetTurnstile();
            }
        } catch (e) {
            setError("服务暂时不可用，请稍后再试");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') submit();
    };

    return (
        <div className="login-page flex-1 h-full relative bg-[#05050a] overflow-hidden">
            
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[128px] pointer-events-none animate-pulse-slow animate-delay-200"></div>

            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-[400px] glass-card rounded-2xl p-6 sm:p-8 shadow-2xl z-10 border border-white/5 relative my-8">
                        
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        {isReg ? '创建账号' : '欢迎回来'}
                    </h1>
                    <p className="text-sm text-zinc-500">
                        {isReg ? '请输入您的详细信息以注册' : '请输入您的凭证以访问账户'}
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">用户名</label>
                        <input
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none transition"
                            placeholder="请输入用户名"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            onKeyDown={handleKeyDown}
                            aria-label="用户名"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">{isReg ? '设置密码' : '密码'}</label>
                        <div className="relative">
                            <input
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-base sm:text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none transition"
                                type={showPassword ? "text" : "password"}
                                placeholder={isReg ? "设置密码" : "请输入密码"}
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                onKeyDown={handleKeyDown}
                                aria-label={isReg ? "设置密码" : "密码"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg transition"
                                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                            >
                                {showPassword ? "隐藏" : "显示"}
                            </button>
                        </div>
                    </div>
                    {isReg && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">确认密码</label>
                            <div className="relative">
                                <input
                                    className={`w-full bg-black/50 border rounded-xl px-4 py-3 pr-12 text-base sm:text-sm text-white placeholder:text-zinc-600 focus:ring-1 outline-none transition ${passwordsMismatch ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20' : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20'}`}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="请再次输入密码"
                                    value={form.confirmPassword}
                                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    aria-label="确认密码"
                                    aria-invalid={passwordsMismatch ? "true" : "false"}
                                    aria-describedby={passwordsMismatch ? "confirm-password-error" : undefined}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg transition"
                                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                >
                                    {showPassword ? "隐藏" : "显示"}
                                </button>
                            </div>
                            {passwordsMismatch && (
                                <div id="confirm-password-error" role="alert" className="text-xs text-red-400">
                                    两次输入的密码不一致，请重新输入
                                </div>
                            )}
                        </div>
                    )}

                    
                    <div className="flex flex-col gap-2 w-full pt-2">
                        <div className="flex justify-center items-center">
                            <div ref={turnstileRef} />
                        </div>
                        {turnstileLoading && TURNSTILE_SITE_KEY && (
                            <div className="text-[10px] text-zinc-500 text-center">正在加载验证...</div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center animate-fade-in" role="alert" aria-live="polite">
                            <p className="text-red-400 text-xs font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={submit}
                        disabled={loading || turnstileLoading || !form.username || !form.password || !turnstileToken || (isReg && (!form.confirmPassword || passwordsMismatch))}
                        className="w-full bg-white hover:bg-zinc-200 text-black text-sm font-bold py-3.5 rounded-xl transition mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {isReg ? '立即注册' : '立即登录'} <ArrowRight size={16} className="opacity-50" />
                    </button>
                </div>

                <div className="mt-8 text-center pt-6 border-t border-white/5">
                    <button
                        onClick={() => {
                            setIsReg(!isReg);
                            setError(null);
            setForm({ username: '', password: '', confirmPassword: '' });
                            resetTurnstile();
                        }}
                        className="text-xs text-zinc-500 hover:text-white transition hover:underline"
                    >
                        {isReg ? "已有账号？直接登录" : "没有账号？立即注册"}
                    </button>
                </div>
            </div>
        </div>
    </div>
    </div>
    );
}
