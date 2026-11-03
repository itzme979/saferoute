// Shared helpers for SafeRoute Edge Functions (Deno runtime).
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const allowedOrigin = Deno.env.get('APP_URL') ?? '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

/** Client that acts as the calling user, so Row Level Security still applies. */
export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

/** Privileged client. Only used for narrowly-scoped server tasks. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export async function requireUser(req: Request) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null };
  return { client, user: data.user };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export interface EmailMessage {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
}

/**
 * Sends an email through Resend. Returns true when Resend accepted the
 * message. Acceptance does not guarantee delivery to the inbox.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'SafeRoute <onboarding@resend.dev>';
  if (!key) return false;
  const body = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#FAFAF7;padding:24px;color:#252B36">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #F1F3F5">
      <p style="margin:0 0 4px;color:#4DAFA1;font-weight:700;font-size:13px;letter-spacing:.04em">SAFEROUTE</p>
      <h1 style="margin:0 0 16px;font-size:20px;color:#172B4D">${escapeHtml(msg.heading)}</h1>
      ${msg.paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.55">${escapeHtml(p)}</p>`).join('')}
      ${msg.button ? `<p style="margin:20px 0"><a href="${escapeHtml(msg.button.url)}" style="background:#172B4D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:600">${escapeHtml(msg.button.label)}</a></p>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280;line-height:1.5">SafeRoute is a journey-sharing tool, not an emergency service. If you believe someone is in immediate danger, contact your local emergency number.</p>
    </div>
  </div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
}
