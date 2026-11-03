import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, type LinkProps } from 'react-router-dom';
import { cx, initials } from '@/lib/format';
import { IconAlert, IconCheckCircle, IconInfo, IconX } from './icons';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'teal' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-55 disabled:cursor-not-allowed active:scale-[0.98] motion-reduce:active:scale-100';
const variants: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-600 shadow-sm',
  teal: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
  secondary: 'bg-white text-navy border border-navy-100 hover:border-navy/30 hover:bg-sky-50',
  ghost: 'text-navy hover:bg-mist',
  subtle: 'bg-sky-100 text-navy hover:bg-sky-200',
  danger: 'bg-coral-600 text-white hover:bg-coral-700 shadow-sm',
};
const sizes: Record<Size, string> = {
  sm: 'text-sm px-3 min-h-[38px]',
  md: 'text-[15px] px-4 min-h-[44px]',
  lg: 'text-base px-6 min-h-[52px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variants[variant], sizes[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, block, children, icon, ...rest }: LinkProps & { variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode }) {
  return (
    <Link className={cx(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx('animate-spin motion-reduce:animate-none', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
const inputBase =
  'w-full rounded-xl border bg-white px-3.5 min-h-[46px] text-[15px] text-charcoal placeholder:text-slate-400 ' +
  'transition focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-500';

interface FieldWrapProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
  optional?: boolean;
  hideLabel?: boolean;
}

function FieldWrap({ label, error, hint, id, children, optional, hideLabel }: FieldWrapProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cx('block text-sm font-semibold text-navy', hideLabel && 'sr-only')}>
        {label} {optional && <span className="font-normal text-slate-500">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[13px] text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-[13px] font-medium text-coral-700" role="alert">
          <IconAlert size={15} className="mt-[1px] shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

type FieldProps = { label: string; error?: string | null; hint?: ReactNode; optional?: boolean; hideLabel?: boolean };

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function TextField(
  { label, error, hint, optional, hideLabel, className, id, ...rest }, ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} optional={optional} hideLabel={hideLabel}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cx(inputBase, error ? 'border-coral-500' : 'border-navy-100', className)}
        {...rest}
      />
    </FieldWrap>
  );
});

export function TextArea({ label, error, hint, optional, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} optional={optional}>
      <textarea
        id={fid}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cx(inputBase, 'py-3 min-h-[96px] resize-y', error ? 'border-coral-500' : 'border-navy-100', className)}
        {...rest}
      />
    </FieldWrap>
  );
}

export function Select({ label, error, hint, optional, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} optional={optional}>
      <select id={fid} className={cx(inputBase, 'pr-8', error ? 'border-coral-500' : 'border-navy-100', className)} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, id }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean; id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={fid} className="block text-[15px] font-semibold text-navy cursor-pointer">{label}</label>
        {description && <p id={`${fid}-desc`} className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{description}</p>}
      </div>
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${fid}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50',
          checked ? 'bg-teal-600' : 'bg-slate-300',
        )}
      >
        <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-3 rounded-xl p-2 -mx-2 transition hover:bg-mist/70', disabled && 'opacity-50 cursor-not-allowed')}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0 rounded border-navy-100 accent-[#3A9487]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-navy">{label}</span>
        {description && <span className="block text-[13px] text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------
export function Card({ className = '', children, as: As = 'div', interactive, ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li'; interactive?: boolean } & Record<string, unknown>) {
  // Let callers override the default surface colours without CSS-order conflicts.
  const customBg = /(^|\s)bg-/.test(className);
  const customBorder = /(^|\s)border-(?!t\b|b\b|l\b|r\b|x\b|y\b|\d)[a-z]/.test(className);
  return (
    <As
      className={cx(
        'min-w-0 rounded-2xl border shadow-soft',
        !customBg && 'bg-white',
        !customBorder && 'border-navy/[0.06]',
        interactive && 'transition duration-200 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function SectionHeader({ title, description, action, as: As = 'h2' }: { title: string; description?: ReactNode; action?: ReactNode; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <As className={cx('font-bold text-navy tracking-tight', As === 'h1' ? 'text-2xl sm:text-[28px]' : 'text-lg')}>{title}</As>
        {description && <p className="mt-1 text-[15px] text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'teal' | 'navy' | 'grey' | 'amber' | 'coral' | 'sky';
const tones: Record<Tone, string> = {
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  navy: 'bg-navy-50 text-navy ring-navy-100',
  grey: 'bg-mist text-slate-600 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  coral: 'bg-coral-50 text-coral-700 ring-coral-100',
  sky: 'bg-sky-100 text-navy ring-sky-200',
};

export function Badge({ tone = 'navy', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function SampleBadge() {
  return <Badge tone="sky" className="!text-[11px] uppercase tracking-wide">Sample</Badge>;
}

export function Notice({ tone = 'info', title, children, className, action }: { tone?: 'info' | 'success' | 'warning' | 'neutral'; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const map = {
    info: { cls: 'bg-sky-50 border-sky-200 text-navy', icon: <IconInfo size={18} className="text-navy-600" /> },
    success: { cls: 'bg-teal-50 border-teal-200 text-teal-800', icon: <IconCheckCircle size={18} className="text-teal-700" /> },
    warning: { cls: 'bg-amber-50 border-amber-100 text-amber-700', icon: <IconAlert size={18} className="text-amber-700" /> },
    neutral: { cls: 'bg-mist border-slate-200 text-slate-700', icon: <IconInfo size={18} className="text-slate-500" /> },
  }[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3.5 text-sm leading-relaxed', map.cls, className)} role={tone === 'warning' ? 'alert' : 'status'}>
      <span className="mt-0.5 shrink-0">{map.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-lg bg-mist', className)} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:hidden" />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-navy">{icon}</div>
      <p className="font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-navy ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal (focus-trapped dialog)
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: {
  open: boolean; onClose: () => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg'; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    setTimeout(() => (focusables()[0] ?? el)?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy-900/40 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-lift animate-scale-in sm:rounded-3xl', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-navy">{title}</h2>
            {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
          </div>
          {dismissible && (
            <IconButton label="Close dialog" onClick={onClose} className="-mr-2 -mt-2">
              <IconX />
            </IconButton>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-mist px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Stat({ icon, label, value, muted }: { icon: ReactNode; label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', muted ? 'bg-mist text-slate-400' : 'bg-sky-100 text-navy')}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={cx('truncate text-[15px] font-semibold', muted ? 'text-slate-500' : 'text-navy')}>{value}</p>
      </div>
    </div>
  );
}
