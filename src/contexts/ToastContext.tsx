import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant, actionLabel?: string, onAction?: () => void) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastViewport({ toasts, removeToast }: { toasts: ToastItem[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`min-w-[240px] max-w-sm rounded-lg shadow-lg px-4 py-3 border text-sm flex items-start gap-3 ${
          t.variant === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800' :
          t.variant === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800' :
          t.variant === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800' :
          'bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex-1">{t.message}</div>
          {t.actionLabel && t.onAction && (
            <button
              onClick={() => { t.onAction?.(); removeToast(t.id); }}
              className="ml-2 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 text-xs opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const addToast = (message: string, variant: ToastVariant = 'info', actionLabel?: string, onAction?: () => void) => {
    const id = `t_${Date.now()}_${idRef.current++}`;
    const toast: ToastItem = { id, message, variant, actionLabel, onAction };
    setToasts((prev) => [...prev, toast]);
    // auto dismiss after 6s
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const value = useMemo(() => ({ toasts, addToast, removeToast }), [toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

