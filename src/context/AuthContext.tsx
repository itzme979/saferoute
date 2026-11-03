import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, type ProfilePatch } from '@/services';
import type { AuthUser, Profile } from '@/types';

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  /** True when signed in but the profile could not be loaded (e.g. network error). */
  profileError: boolean;
  loading: boolean;
  recovering: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<Profile>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function fetchProfile(): Promise<Profile | null> {
  try {
    return await backend.getProfile();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    const apply = async (u: AuthUser | null) => {
      const p = u ? await fetchProfile() : null;
      if (!active) return;
      setUser(u);
      setProfile(p);
      setLoading(false);
    };
    backend.getUser().then(apply);
    const off = backend.onAuthChange((u, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      if (event === 'USER_UPDATED' && u) {
        setUser(u);
        return;
      }
      apply(u);
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfile(await fetchProfile());
  }, []);
  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const p = await backend.updateProfile(patch);
    setProfile(p);
    return p;
  }, []);
  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
    setProfile(null);
    setRecovering(false);
  }, []);

  const value = useMemo(
    () => ({ user, profile, profileError: !!user && !profile && !loading, loading, recovering, refreshProfile, updateProfile, signOut }),
    [user, profile, loading, recovering, refreshProfile, updateProfile, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

/** For pages behind RequireAuth, where a profile is guaranteed. */
export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Profile not loaded');
  return profile;
}
