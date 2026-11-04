import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { IconCheckCircle, IconEye, IconEyeOff } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { TextField } from '@/components/ui';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-warm">
      <DemoBanner />
      <div className="grid flex-1 lg:grid-cols-[1fr_minmax(0,560px)]">
        <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col" aria-hidden="true">
          <Logo light />
          <div className="mt-auto max-w-md">
            <p className="text-3xl font-extrabold leading-tight tracking-tight">Know your route.<br />Stay connected.<br />Feel prepared.</p>
            <ul className="mt-8 space-y-3 text-sky-100">
              {['Compare routes with transparent information', 'Share a journey only when you choose to', 'Optional arrival check-ins with people you trust'].map((t) => (
                <li key={t} className="flex items-start gap-3"><IconCheckCircle size={20} className="mt-0.5 shrink-0 text-teal-200" /> {t}</li>
              ))}
            </ul>
          </div>
          <svg className="absolute -right-24 top-24 h-[420px] w-[420px] opacity-[0.12]" viewBox="0 0 200 200" fill="none">
            <path d="M20 170c30-10 40-40 70-50s60 10 80-30 10-60 10-70" stroke="#4DAFA1" strokeWidth="6" strokeLinecap="round" />
            <circle cx="20" cy="170" r="8" fill="#DCEBFA" />
            <circle cx="180" cy="20" r="8" fill="#4DAFA1" />
          </svg>
        </aside>
        <main id="main" className="flex flex-col px-4 py-8 sm:px-10">
          <div className="lg:hidden"><Logo /></div>
          <div className="mx-auto my-auto w-full max-w-md animate-fade-up py-8">
            <h1 className="text-[28px] font-extrabold tracking-tight text-navy">{title}</h1>
            {subtitle && <div className="mt-2 text-[15px] text-slate-600">{subtitle}</div>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-[15px] text-slate-600">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode }>(
  function PasswordField({ label, error, hint, ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <TextField ref={ref} label={label} error={error} hint={hint} type={show ? 'text' : 'password'} className="pr-12" {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-[30px] flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
    );
  },
);
