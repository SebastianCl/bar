import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastContextValue, type ToastTone } from './toast-context';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4_500,
    );
  }, []);
  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            className={`toast toast--${toast.tone}`}
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast__marker" aria-hidden="true" />
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() =>
                setToasts((current) => current.filter((item) => item.id !== toast.id))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
