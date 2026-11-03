import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { IconAlert, IconCheckCircle, IconInfo, IconX } from '@/components/icons';
import { cx } from '@/lib/format';

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: ToastTone; title: string; body?: string }

interface ToastApi {
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((tone: ToastTone, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, title, body }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (t, b) => push('success', t, b),
    error: (t, b) => push('error', t, b),
    info: (t, b) => push('info', t, b),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-2xl border border-navy/[0.06] bg-white p-3.5 shadow-lift">
            <span className={cx('mt-0.5 shrink-0', t.tone === 'success' && 'text-teal-600', t.tone === 'error' && 'text-coral-600', t.tone === 'info' && 'text-navy-600')}>
              {t.tone === 'success' ? <IconCheckCircle /> : t.tone === 'error' ? <IconAlert /> : <IconInfo />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-slate-600">{t.body}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-lg p-1 text-slate-400 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Dismiss notification">
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
}
