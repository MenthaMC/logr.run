import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LANG_STORAGE_KEY = 'logr.run.lang';
const FALLBACK_LANG = 'en';
const SUPPORTED_LANGS = new Set(['zh', 'en']);

const MESSAGES = {
  zh: {
    common: {
      loading: '加载中...',
    },
    navbar: {
      apiDocs: '接口文档',
      dashboard: '控制台',
      logout: '退出登录',
      login: '登录',
      loginRegister: '登录 / 注册',
    },
    dashboard: {
      refreshLogs: '刷新日志',
      allLogs: '所有日志',
      crash: '崩溃',
      events: '事件',
      issues: '问题',
    },
    issues: {
      title: '问题',
      sortRecent: '最近',
      sortCount: '次数',
      searchPlaceholder: '搜索标题 / 签名...',
      loadFailed: '加载问题失败',
      loadDetailFailed: '加载问题详情失败',
      copySuccess: '已复制',
      copyFailed: '复制失败',
      level: '级别',
      colTitle: '标题',
      colCount: '次数',
      colLastSeen: '最近出现',
      loading: '加载中...',
      empty: '暂无问题',
      issueFallback: '问题',
      copySignature: '复制签名',
      detailLoading: '加载详情...',
      noData: '暂无数据',
      timeline: '趋势',
      tags: '标签',
      events: '事件',
      eventFallback: '事件',
      open: '打开',
      noEvents: '无事件',
    },
    login: {
      createAccount: '创建账号',
      welcomeBack: '欢迎回来',
      registerHint: '注册新账号以继续。',
      loginHint: '登录后进入控制台。',
      username: '用户名',
      usernamePlaceholder: '输入用户名',
      password: '密码',
      passwordPlaceholder: '输入密码',
      confirmPassword: '确认密码',
      confirmPasswordPlaceholder: '再次输入密码',
      show: '显示',
      hide: '隐藏',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      loadingCaptcha: '正在加载验证...',
      signIn: '登录',
      switchToLogin: '已有账号？去登录',
      switchToRegister: '还没有账号？立即注册',
      registerSuccess: '注册成功，请登录。',
      errors: {
        missingFields: '请填写所有必填项。',
        invalidFields: '用户名或密码格式不合法。',
        usernameTooLong: '用户名过长。',
        passwordTooLong: '密码过长。',
        userNotFound: '用户不存在。',
        passwordsMismatch: '两次输入的密码不一致。',
        invalidCredentials: '用户名或密码错误。',
        usernameExists: '用户名已存在。',
        invalidCaptcha: '验证失败，请重试。',
        captchaRequired: '请完成验证。',
        captchaExpired: '验证已过期，请重试。',
        weakPassword: '密码需至少8位，且包含字母和数字。',
        registerFailed: '注册失败，请稍后重试。',
        loginFailed: '登录失败，请稍后重试。',
        unknownAuth: '认证发生未知错误。',
        turnstileNotConfigured: '验证码站点密钥未配置。',
        loadCaptchaFailed: '验证组件加载失败，请重试。',
        confirmPasswordRequired: '请确认密码。',
      },
    },
  },
  en: {
    common: {
      loading: 'Loading...',
    },
    navbar: {
      apiDocs: 'API Docs',
      dashboard: 'Dashboard',
      logout: 'Log out',
      login: 'Log in',
      loginRegister: 'Log in / Sign up',
    },
    dashboard: {
      refreshLogs: 'Refresh logs',
      allLogs: 'All logs',
      crash: 'Crash',
      events: 'Events',
      issues: 'Issues',
    },
    issues: {
      title: 'Issues',
      sortRecent: 'Recent',
      sortCount: 'Count',
      searchPlaceholder: 'Search title / signature...',
      loadFailed: 'Failed to load issues',
      loadDetailFailed: 'Failed to load issue details',
      copySuccess: 'Copied',
      copyFailed: 'Copy failed',
      level: 'Level',
      colTitle: 'Title',
      colCount: 'Count',
      colLastSeen: 'Last seen',
      loading: 'Loading...',
      empty: 'No issues',
      issueFallback: 'Issue',
      copySignature: 'Copy signature',
      detailLoading: 'Loading details...',
      noData: 'No data',
      timeline: 'Timeline',
      tags: 'Tags',
      events: 'Events',
      eventFallback: 'Event',
      open: 'Open',
      noEvents: 'No events',
    },
    login: {
      createAccount: 'Create Account',
      welcomeBack: 'Welcome Back',
      registerHint: 'Register a new account to continue.',
      loginHint: 'Sign in to open your dashboard.',
      username: 'Username',
      usernamePlaceholder: 'Enter username',
      password: 'Password',
      passwordPlaceholder: 'Enter password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm password',
      show: 'Show',
      hide: 'Hide',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      loadingCaptcha: 'Loading captcha...',
      signIn: 'Sign In',
      switchToLogin: 'Already have an account? Sign in.',
      switchToRegister: 'No account yet? Register now.',
      registerSuccess: 'Registration successful. Please login.',
      errors: {
        missingFields: 'Please fill in all required fields.',
        invalidFields: 'Invalid username or password format.',
        usernameTooLong: 'Username is too long.',
        passwordTooLong: 'Password is too long.',
        userNotFound: 'User not found.',
        passwordsMismatch: 'Passwords do not match.',
        invalidCredentials: 'Invalid username or password.',
        usernameExists: 'Username already exists.',
        invalidCaptcha: 'Captcha validation failed. Please retry.',
        captchaRequired: 'Please complete the captcha.',
        captchaExpired: 'Captcha expired. Please retry.',
        weakPassword: 'Password must be 8+ chars and include letters and numbers.',
        registerFailed: 'Registration failed. Please try again.',
        loginFailed: 'Login failed. Please try again.',
        unknownAuth: 'Unknown authentication error.',
        turnstileNotConfigured: 'Turnstile site key is not configured.',
        loadCaptchaFailed: 'Failed to load captcha. Please retry.',
        confirmPasswordRequired: 'Please confirm your password.',
      },
    },
  },
} as const;

function readMessage(obj: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>) ? (acc as Record<string, unknown>)[part] : undefined),
      obj,
    );
}

function resolveStoredLang() {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (SUPPORTED_LANGS.has(value ?? '')) return value;
  return null;
}

function detectBrowserLang() {
  if (typeof navigator === 'undefined') return FALLBACK_LANG;
  const languages = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  const hasChinese = languages.some((lang) => String(lang).toLowerCase().startsWith('zh'));
  return hasChinese ? 'zh' : 'en';
}

function detectInitialLang() {
  return resolveStoredLang() || detectBrowserLang();
}

type I18nContextValue = {
  lang: string;
  setLang: (nextLang: string) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: FALLBACK_LANG,
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(() => detectInitialLang());

  const setLang = useCallback((nextLang: string) => {
    const normalized = SUPPORTED_LANGS.has(nextLang) ? nextLang : FALLBACK_LANG;
    setLangState(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const byCurrent = readMessage(MESSAGES[lang as 'zh' | 'en'], key);
      if (typeof byCurrent === 'string') return byCurrent;
      const byFallback = readMessage(MESSAGES[FALLBACK_LANG as 'zh' | 'en'], key);
      return typeof byFallback === 'string' ? byFallback : key;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
