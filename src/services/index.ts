import { config } from '@/lib/config';
import type { Backend } from './backend';
import { DemoBackend } from './demoBackend';
import { SupabaseBackend } from './supabaseBackend';
import { getSupabase } from './supabaseClient';

const sb = config.isSampleDemo ? null : getSupabase();

/**
 * The single backend instance used by the app:
 * - /demo area: browser-only backend seeded with fictional sample data
 * - Supabase configured: real accounts
 * - otherwise: browser-only backend with no sample data
 */
export const backend: Backend = sb ? new SupabaseBackend(sb) : new DemoBackend(config.isSampleDemo);

export { BackendError } from './backend';
export type { Backend, ProfilePatch } from './backend';

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
