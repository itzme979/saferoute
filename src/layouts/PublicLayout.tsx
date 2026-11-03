import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DemoBanner } from '@/components/DemoBanner';
import { IconMenu, IconX } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ButtonLink } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/lib/format';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/#features', label: 'Features' },
  { to: '/about', label: 'About' },
];

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location]);

  return (
    <div className="flex min-h-screen flex-col bg-warm">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-navy/[0.06] bg-warm/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => cx('rounded-lg px-3 py-2 text-[15px] font-semibold transition hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', isActive && !location.hash && l.to !== '/#features' ? 'text-navy' : 'text-slate-500')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle className="ml-auto md:ml-0" />
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <ButtonLink to="/dashboard">Open dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/signin" variant="ghost">Sign In</ButtonLink>
                <ButtonLink to="/signup" variant="teal">Get Started</ButtonLink>
              </>
            )}
          </div>
          <button
            type="button"
            className="-ml-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
        {open && (
          <div id="mobile-menu" className="animate-slide-in border-t border-navy/[0.06] bg-warm px-4 pb-5 pt-2 md:hidden">
            <nav className="flex flex-col" aria-label="Primary">
              {LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="rounded-lg px-2 py-3 text-base font-semibold text-navy hover:bg-mist">{l.label}</Link>
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <ButtonLink to="/dashboard" className="col-span-2">Open dashboard</ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/signin" variant="secondary">Sign In</ButtonLink>
                  <ButtonLink to="/signup" variant="teal">Get Started</ButtonLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-navy/[0.06] bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-slate-600">Know your route. Stay connected. Feel prepared.</p>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
            SafeRoute is a decision-support and journey-sharing tool. It is not an emergency service and cannot guarantee anyone's safety. In an emergency, call your local emergency number.
          </p>
        </div>
        <nav aria-label="Company">
          <p className="text-sm font-bold text-navy">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-slate-600 hover:text-navy" to="/about">About</Link></li>
            <li><Link className="text-slate-600 hover:text-navy" to="/contact">Contact</Link></li>
            <li><Link className="text-slate-600 hover:text-navy" to="/help">Help and Support</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="text-sm font-bold text-navy">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-slate-600 hover:text-navy" to="/privacy">Privacy Policy</Link></li>
            <li><Link className="text-slate-600 hover:text-navy" to="/terms">Terms of Service</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-mist">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          &copy; {new Date().getFullYear()} SafeRoute. Map data &copy; OpenStreetMap contributors.
        </p>
      </div>
    </footer>
  );
}
