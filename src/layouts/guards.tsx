import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm" role="status" aria-live="polite">
      <LogoMark size={44} className="animate-pulse motion-reduce:animate-none" />
      <span className="sr-only">Loading SafeRoute</span>
    </div>
  );
}

/** Requires a signed-in user with a loaded profile. Redirects new users to onboarding. */
export function RequireAuth({ children, allowUnonboarded }: { children: ReactNode; allowUnonboarded?: boolean }) {
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm p-6">
        <div className="max-w-sm text-center">
          <LogoMark size={40} className="mx-auto" />
          <h1 className="mt-4 text-lg font-bold text-navy">We couldn't load your account</h1>
          <p className="mt-2 text-sm text-slate-600">This is usually a connection problem. Check your internet connection and try again.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
            <Button onClick={refreshProfile}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <FullPageLoader />;
  if (!profile.onboarded && !allowUnonboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Sign-in / sign-up pages: signed-in users go straight to the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (user && !recovering) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/dashboard'} replace />;
  }
  return <>{children}</>;
}
