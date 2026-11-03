import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!config.hasBackend) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}
