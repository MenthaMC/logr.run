import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm 必须在 ConfirmProvider 内使用');
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({ title: '', message: '', confirmText: '确定', cancelText: '取消', type: 'danger' });
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, message, confirmText = '确定', cancelText = '取消', type = 'danger' }) => {
    setConfig({ title: title || '请确认', message: message || '', confirmText, cancelText, type });
    setIsOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose(false);
      if (e.key === 'Enter') handleClose(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  const theme = {
    danger: {
      icon: <AlertTriangle size={22} className="text-red-300" />,
      accent: 'from-red-500/20 via-red-500/5',
      iconBg: 'bg-red-500/10 border-red-500/20',
      confirmBtn: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
      ring: 'border-red-500/15',
    },
    info: {
      icon: <Info size={22} className="text-sky-300" />,
      accent: 'from-sky-500/20 via-sky-500/5',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
      confirmBtn: 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20',
      ring: 'border-sky-500/15',
    },
    success: {
      icon: <CheckCircle2 size={22} className="text-emerald-300" />,
      accent: 'from-emerald-500/20 via-emerald-500/5',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      confirmBtn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
      ring: 'border-emerald-500/15',
    },
  };

  const t = theme[config.type] || theme.danger;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <button
            className="absolute inset-0 cursor-default"
            onClick={() => handleClose(false)}
            aria-label="关闭"
          />

          <div className={`relative max-w-sm w-full rounded-2xl border bg-[#0b0b10]/90 overflow-hidden shadow-2xl animate-scale-in ${t.ring}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${t.accent} to-transparent pointer-events-none`} />

            <div className="relative p-5">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 w-10 h-10 rounded-2xl flex items-center justify-center border ${t.iconBg}`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-white leading-snug">{config.title}</h3>
                    <button
                      onClick={() => handleClose(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label="关闭"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {config.message ? (
                    <p className="mt-2 text-sm text-zinc-300/85 leading-relaxed whitespace-pre-wrap">{config.message}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative px-5 pb-5 pt-3 flex items-center justify-end gap-3">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold"
              >
                {config.cancelText}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl text-white shadow-lg transition-all active:scale-95 text-sm font-bold ${t.confirmBtn}`}
              >
                {config.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
