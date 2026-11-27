import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconAlert, IconCheck, IconClose, IconInfo } from './Icons';

type Variant = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; variant: Variant }

const ToastContext = createContext<{ push: (message: string, variant?: Variant) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, variant: Variant = 'info') => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast toast-end toast-bottom z-[60] max-w-[calc(100vw-1rem)] pb-20 lg:pb-4" aria-live="polite" role="status">
        {toasts.map((t) => {
          const tone =
            t.variant === 'success' ? 'border-success' : t.variant === 'error' ? 'border-error' : 'border-base-300';
          const Icon = t.variant === 'success' ? IconCheck : t.variant === 'error' ? IconAlert : IconInfo;
          const iconTone = t.variant === 'success' ? 'text-free' : t.variant === 'error' ? 'text-occupied' : 'text-base-content/70';
          return (
            <div
              key={t.id}
              data-testid="toast"
              data-variant={t.variant}
              className={`fade-in flex w-80 max-w-full items-start gap-3 rounded-md border border-l-4 bg-base-100 px-3 py-2.5 text-sm shadow-lg ${tone}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} />
              <span className="flex-1 whitespace-normal">{t.message}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.push;
}
