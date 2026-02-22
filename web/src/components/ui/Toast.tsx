import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/lib/ui';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const lastToastAtRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    setTimeout(() => removeToast(id), 300);
  }, [removeToast]);

  const addToast = useCallback((message, type = 'info', duration = 3200) => {
    const now = performance.now();
    if (now - lastToastAtRef.current < 100) return;
    lastToastAtRef.current = now;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type, duration, closing: false }].slice(-5));

    if (duration > 0) {
      setTimeout(() => {
        closeToast(id);
      }, duration);
    }
  }, [closeToast]);

  const toast = useMemo(() => ({
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onClose={() => closeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const TOAST_META = {
  success: {
    label: '成功',
    icon: <CheckCircle size={18} className="text-emerald-300" />,
    border: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'text-emerald-200',
    body: 'text-zinc-200',
  },
  error: {
    label: '错误',
    icon: <AlertCircle size={18} className="text-red-300" />,
    border: 'border-red-500/25',
    iconBg: 'bg-red-500/10 border-red-500/20',
    title: 'text-red-200',
    body: 'text-zinc-200',
  },
  warning: {
    label: '警告',
    icon: <AlertTriangle size={18} className="text-amber-300" />,
    border: 'border-amber-500/25',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    title: 'text-amber-200',
    body: 'text-zinc-200',
  },
  info: {
    label: '提示',
    icon: <Info size={18} className="text-sky-300" />,
    border: 'border-sky-500/25',
    iconBg: 'bg-sky-500/10 border-sky-500/20',
    title: 'text-sky-200',
    body: 'text-zinc-200',
  },
};

const ToastItem = ({ message, type, closing, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const m = TOAST_META[type] || TOAST_META.info;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const lazy = requestAnimationFrame(() => setShowContent(true));
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(lazy);
    };
  }, []);

  const isVisible = mounted && !closing;

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden w-[320px] sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-[#111119]/95 shadow-xl transform-gpu will-change-transform ${m.border} transition-all duration-300 ${isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-2 scale-[0.98]'}`}
    >
      <div className="relative flex items-start gap-3 px-4 py-3">
        <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center border ${m.iconBg}`}>
          {m.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className={`text-xs font-bold tracking-wide ${m.title}`}>{m.label}</div>
            <Button
              isIconOnly
              variant="light"
              onPress={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="关闭"
            >
              <X size={16} />
            </Button>
          </div>
          {showContent ? (
            <div className={`mt-1 text-sm leading-relaxed break-words ${m.body}`}>{message}</div>
          ) : (
            <div className="mt-1 h-4 w-40 rounded bg-white/10" />
          )}
        </div>
      </div>
    </div>
  );
};
