import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" fill="#172B4D" />
      <path d="M10 23c0-4 3-5 6-6s6-2 6-6" fill="none" stroke="#4DAFA1" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="10" cy="23" r="2.6" fill="#DCEBFA" />
      <circle cx="22" cy="11" r="2.6" fill="#4DAFA1" />
    </svg>
  );
}

export function Logo({ to = '/', light, className }: { to?: string; light?: boolean; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', className)} aria-label="SafeRoute home">
      <LogoMark />
      <span className={cx('text-[19px] font-extrabold tracking-tight', light ? 'text-white' : 'text-navy')}>
        Safe<span className="text-teal-600">Route</span>
      </span>
    </Link>
  );
}
