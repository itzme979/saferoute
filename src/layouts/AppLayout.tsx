import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DemoBanner } from '@/components/DemoBanner';
import {
  IconHistory, IconHome, IconMap, IconNavigation, IconRoute, IconSettings, IconShield, IconSos, IconUsers, type IconProps,
} from '@/components/icons';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/ui';
import { useProfile } from '@/context/AuthContext';
import { useJourney } from '@/context/JourneyContext';
import { cx } from '@/lib/format';
import { useOnline } from '@/lib/pwa';

interface NavItem { to: string; label: string; short: string; icon: ComponentType<IconProps> }

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: IconHome },
  { to: '/plan', label: 'Plan a Journey', short: 'Plan', icon: IconRoute },
  { to: '/journey', label: 'Active Journey', short: 'Journey', icon: IconNavigation },
  { to: '/circle', label: 'SafeCircle', short: 'Circle', icon: IconUsers },
  { to: '/community', label: 'Community Map', short: 'Map', icon: IconMap },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: IconSettings },
];
const MOBILE_NAV = NAV.slice(0, 5);

export function AppLayout() {
  const profile = useProfile();
  const { journey } = useJourney();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const online = useOnline();

  const activeIndex = NAV.findIndex((n) => location.pathname.startsWith(n.to));
  const mobileIndex = MOBILE_NAV.findIndex((n) => location.pathname.startsWith(n.to));

  // Move focus to main content on route change for screen-reader users.
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-warm">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <DemoBanner />
      {!online && (
        <div className="bg-amber-50 px-4 py-2 text-center text-[13px] font-medium text-amber-700" role="status">
          You're offline. Routes, maps, sharing and alerts need a connection. For emergencies, use your phone's dialer.
        </div>
      )}
      <div className="lg:flex">

      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-navy/[0.06] bg-white lg:flex" aria-label="Main navigation">
        <div className="px-5 pb-4 pt-6"><Logo to="/dashboard" /></div>
        <nav className="relative flex-1 px-3">
          {activeIndex >= 0 && (
            <span
              className="absolute left-3 right-3 top-0 h-11 rounded-xl bg-sky-100 transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateY(${activeIndex * 48}px)` }}
              aria-hidden="true"
            />
          )}
          <ul className="relative space-y-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) => cx(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                    isActive ? 'text-navy' : 'text-slate-500 hover:text-navy',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <n.icon size={20} className={isActive ? 'text-teal-700' : undefined} />
                      <span className="flex-1">{n.label}</span>
                      {n.to === '/journey' && journey && <span className="h-2 w-2 rounded-full bg-teal-500" aria-label="Journey in progress" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-mist pt-4">
            <NavLink to="/history" className={({ isActive }) => cx('flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', isActive ? 'bg-sky-100 text-navy' : 'text-slate-500 hover:text-navy')}>
              <IconHistory size={18} /> Journey history
            </NavLink>
            {profile.isModerator && (
              <NavLink to="/moderation" className={({ isActive }) => cx('mt-1 flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', isActive ? 'bg-sky-100 text-navy' : 'text-slate-500 hover:text-navy')}>
                <IconShield size={18} /> Moderation
              </NavLink>
            )}
          </div>
        </nav>
        <div className="space-y-3 p-4">
          <Link to="/sos" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-coral-100 bg-coral-50 font-semibold text-coral-700 transition hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500">
            <IconSos size={20} /> SafeSOS
          </Link>
          <Link to="/settings" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
            <Avatar name={profile.fullName} url={profile.avatarUrl} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-navy">{profile.fullName || 'Your profile'}</span>
              <span className="block truncate text-xs text-slate-500">{profile.email}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-navy/[0.06] bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <div className="lg:hidden max-[389px]:[&_span]:hidden"><Logo to="/dashboard" /></div>
          <div className="flex-1" />
          <Link to="/sos" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-coral-50 px-3 text-sm font-bold text-coral-700 ring-1 ring-inset ring-coral-100 transition hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500 lg:hidden" aria-label="SafeSOS emergency assistance">
            <IconSos size={18} /> SOS
          </Link>
          <ThemeToggle />
          <NotificationBell />
          <Link to="/settings" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:hidden" aria-label="Settings and profile">
            <Avatar name={profile.fullName} url={profile.avatarUrl} size={36} />
          </Link>
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1} className="pb-28 focus:outline-none lg:pb-0">
        <div key={location.pathname} className="animate-fade-up motion-reduce:animate-none">
          <Outlet />
        </div>
      </main>
      </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/[0.06] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main navigation">
        <div className="relative mx-auto grid max-w-lg grid-cols-5">
          {mobileIndex >= 0 && (
            <span className="absolute top-0 h-[3px] w-[20%] rounded-b-full bg-teal-500 transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${mobileIndex * 100}%)` }} aria-hidden="true" />
          )}
          {MOBILE_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => cx('relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500', isActive ? 'text-navy' : 'text-slate-500')}
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <n.icon size={22} className={isActive ? 'text-teal-700' : undefined} />
                    {n.to === '/journey' && journey && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-teal-500 ring-2 ring-white" aria-label="Journey in progress" />}
                  </span>
                  {n.short}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageContainer({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return <div className={cx('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8', wide ? 'max-w-7xl' : 'max-w-5xl', className)}>{children}</div>;
}
