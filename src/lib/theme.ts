import { useSyncExternalStore } from 'react';

/** Appearance preference. "system" follows the device setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'saferoute-theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

/** Applies the current preference to <html>. index.html runs the same logic before first paint. */
function apply() {
  const dark = resolve(getThemePreference()) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1522' : '#172B4D');
  listeners.forEach((l) => l());
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* the choice still applies for this visit */
  }
  apply();
}

export function initTheme() {
  apply();
  media?.addEventListener('change', () => {
    if (getThemePreference() === 'system') apply();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The theme actually shown ("system" resolved), re-rendering when it changes. */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference);
}
