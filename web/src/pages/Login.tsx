import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/lib/ui';
import { useToast } from '../components/ui/Toast';
import { TURNSTILE_SITE_KEY } from '../config/api';
import { login, register } from '../services/authService';
import { useI18n } from '../i18n';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const AUTH_ERROR_KEY_MAP = {
    'Missing fields': 'login.errors.missingFields',
    'Invalid fields': 'login.errors.invalidFields',
    'Username too long': 'login.errors.usernameTooLong',
    'Password too long': 'login.errors.passwordTooLong',
    'User not found': 'login.errors.userNotFound',
    'Password mismatch': 'login.errors.passwordsMismatch',
    'Invalid credentials': 'login.errors.invalidCredentials',
    'Username already exists or error': 'login.errors.usernameExists',
    'Invalid captcha': 'login.errors.invalidCaptcha',
    'Captcha required': 'login.errors.captchaRequired',
    'Captcha expired': 'login.errors.captchaExpired',
    'Weak password': 'login.errors.weakPassword'
};

const getAuthErrorMessage = (rawError, isRegister, t) => {
    if (!rawError) {
        return isRegister ? t('login.errors.registerFailed') : t('login.errors.loginFailed');
    }
    const key = AUTH_ERROR_KEY_MAP[rawError];
    return key ? t(key) : rawError;
};

const isWeakPassword = (password) => {
    if (password.length < 8) return true;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return !hasLetter || !hasNumber;
};

export default function Login({ onLogin }) {
    const toast = useToast();
    const { t } = useI18n();
    const [isRegister, setIsRegister] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileLoading, setTurnstileLoading] = useState(true);

    const turnstileRef = React.useRef(null);
    const turnstileScriptPromiseRef = React.useRef(null);
    const widgetIdRef = React.useRef(null);

    const loadTurnstileScript = () => {
        if (window.turnstile) return Promise.resolve();
        if (turnstileScriptPromiseRef.current) return turnstileScriptPromiseRef.current;

        turnstileScriptPromiseRef.current = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = TURNSTILE_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.dataset.turnstile = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('turnstile-load-failed'));
            document.head.appendChild(script);
        });

        return turnstileScriptPromiseRef.current;
    };

    const resetTurnstile = () => {
        setTurnstileToken('');
        if (window.turnstile && widgetIdRef.current !== null) {
            window.turnstile.reset(widgetIdRef.current);
        }
    };

    const renderTurnstile = async () => {
        setTurnstileLoading(true);
        setTurnstileToken('');

        if (!TURNSTILE_SITE_KEY) {
            setError(t('login.errors.turnstileNotConfigured'));
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
                'expired-callback': () => setTurnstileToken(''),
                'error-callback': () => {
                    setTurnstileToken('');
                    setError(t('login.errors.invalidCaptcha'));
                }
            });
        } catch {
            setError(t('login.errors.loadCaptchaFailed'));
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
    }, [isRegister]);

    const passwordsMismatch = (
        isRegister &&
        form.password &&
        form.confirmPassword &&
        form.password !== form.confirmPassword
    );

    useEffect(() => {
        if (passwordsMismatch) return;
        if (error === t('login.errors.passwordsMismatch')) setError(null);
    }, [passwordsMismatch, error, t]);

    const submit = async () => {
        if (!form.username || !form.password) return;

        if (isRegister && !form.confirmPassword) {
            setError(t('login.errors.confirmPasswordRequired'));
            return;
        }

        if (isRegister && form.password !== form.confirmPassword) {
            setError(t('login.errors.passwordsMismatch'));
            return;
        }

        if (isRegister && isWeakPassword(form.password)) {
            setError(t('login.errors.weakPassword'));
            return;
        }

        if (!turnstileToken) {
            setError(t('login.errors.captchaRequired'));
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const payload = { ...form, turnstileToken };
            const data = isRegister ? await register(payload) : await login(payload);
            if (!data?.success) {
                throw new Error(data?.error || t('login.errors.unknownAuth'));
            }

            if (isRegister) {
                setIsRegister(false);
                setForm({ username: '', password: '', confirmPassword: '' });
                toast.success(t('login.registerSuccess'));
            } else {
                onLogin(data.token);
            }

            resetTurnstile();
        } catch (e) {
            setError(getAuthErrorMessage(e?.message, isRegister, t));
            resetTurnstile();
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') submit();
    };

    return (
        <div className="login-page page-shell flex-1 h-full relative overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                    <div key={isRegister ? 'register' : 'login'} className="login-panel w-full max-w-[400px] page-card p-6 sm:p-8 z-10 relative my-8">
                        <div className="text-center mb-8 login-stagger login-stagger-1">
                            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                                {isRegister ? t('login.createAccount') : t('login.welcomeBack')}
                            </h1>
                            <p className="text-sm text-zinc-500">
                                {isRegister ? t('login.registerHint') : t('login.loginHint')}
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-1.5 login-stagger login-stagger-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">{t('login.username')}</label>
                                <input
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder:text-zinc-500 focus:border-white/25 focus:ring-1 focus:ring-white/10 outline-none transition"
                                    placeholder={t('login.usernamePlaceholder')}
                                    value={form.username}
                                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                                    onKeyDown={handleKeyDown}
                                    aria-label={t('login.username')}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1.5 login-stagger login-stagger-3">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">
                                    {t('login.password')}
                                </label>
                                <div className="relative">
                                    <input
                                        className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 pr-12 text-base sm:text-sm text-white placeholder:text-zinc-500 focus:border-white/25 focus:ring-1 focus:ring-white/10 outline-none transition"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={t('login.passwordPlaceholder')}
                                        value={form.password}
                                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                                        onKeyDown={handleKeyDown}
                                        aria-label={t('login.password')}
                                    />
                                    <Button
                                        type="button"
                                        variant="light"
                                        size="sm"
                                        onPress={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-auto min-w-0 px-2 py-1 text-xs text-zinc-400 data-[hover=true]:text-white"
                                        aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                                    >
                                        {showPassword ? t('login.hide') : t('login.show')}
                                    </Button>
                                </div>
                            </div>

                            {isRegister && (
                                <div className="space-y-1.5 login-confirm-wrap">
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">{t('login.confirmPassword')}</label>
                                    <div className="relative">
                                        <input
                                            className={`w-full bg-white/[0.02] border rounded-xl px-4 py-3 pr-12 text-base sm:text-sm text-white placeholder:text-zinc-500 focus:ring-1 outline-none transition ${passwordsMismatch ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20' : 'border-white/10 focus:border-white/25 focus:ring-white/10'}`}
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('login.confirmPasswordPlaceholder')}
                                            value={form.confirmPassword}
                                            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                                            onKeyDown={handleKeyDown}
                                            aria-label={t('login.confirmPassword')}
                                            aria-invalid={passwordsMismatch ? 'true' : 'false'}
                                            aria-describedby={passwordsMismatch ? 'confirm-password-error' : undefined}
                                        />
                                        <Button
                                            type="button"
                                            variant="light"
                                            size="sm"
                                            onPress={() => setShowPassword((prev) => !prev)}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-auto min-w-0 px-2 py-1 text-xs text-zinc-400 data-[hover=true]:text-white"
                                            aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                                        >
                                            {showPassword ? t('login.hide') : t('login.show')}
                                        </Button>
                                    </div>
                                    {passwordsMismatch && (
                                        <div id="confirm-password-error" role="alert" className="text-xs text-red-400">
                                            {t('login.errors.passwordsMismatch')}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col gap-2 w-full pt-2 login-stagger login-stagger-4">
                                <div className="flex justify-center items-center">
                                    <div ref={turnstileRef} />
                                </div>
                                {turnstileLoading && TURNSTILE_SITE_KEY && (
                                    <div className="text-[10px] text-zinc-500 text-center">{t('login.loadingCaptcha')}</div>
                                )}
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center animate-fade-in" role="alert" aria-live="polite">
                                    <p className="text-red-400 text-xs font-medium">{error}</p>
                                </div>
                            )}

                            <Button
                                onPress={submit}
                                isLoading={loading}
                                isDisabled={loading || turnstileLoading || !form.username || !form.password || !turnstileToken || (isRegister && (!form.confirmPassword || passwordsMismatch))}
                                className="mt-4 h-12 w-full page-button-primary px-4 text-sm font-semibold login-stagger login-stagger-5 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{isRegister ? t('login.createAccount') : t('login.signIn')}</span>
                                <ArrowRight size={16} className="opacity-70" />
                            </Button>
                        </div>

                        <div className="mt-8 text-center pt-6 border-t border-white/5 login-stagger login-stagger-6">
                            <Button
                                variant="light"
                                size="sm"
                                onPress={() => {
                                    setIsRegister((prev) => !prev);
                                    setError(null);
                                    setForm({ username: '', password: '', confirmPassword: '' });
                                    resetTurnstile();
                                }}
                                className="h-auto min-w-0 p-0 text-xs text-zinc-500 data-[hover=true]:text-white data-[hover=true]:underline"
                            >
                                {isRegister ? t('login.switchToLogin') : t('login.switchToRegister')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
