import { cx } from '@/lib/format';
import { setThemePreference, useResolvedTheme } from '@/lib/theme';
import { IconMoon, IconSun } from './icons';

/** Header button that switches between light and dark. Settings also offers "Match device". */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useResolvedTheme() === 'dark';
  return (
    <button
      type="button"
      onClick={() => setThemePreference(dark ? 'light' : 'dark')}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-mist hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', className)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <IconSun size={20} /> : <IconMoon size={20} />}
    </button>
  );
}
