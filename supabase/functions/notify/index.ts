// Sends user-initiated messages to trusted contacts:
//   invite        - SafeCircle invitation
//   journey_share - "I've shared my journey with you" + view link
//   sos           - user-confirmed SafeSOS alert
// Contacts are loaded with the caller's own credentials, so RLS guarantees a
// user can only ever message their own contacts.
import { adminClient, appUrl, json, preflight, requireUser, sendEmail } from '../_shared/common.ts';

type Kind = 'invite' | 'journey_share' | 'sos';

interface Body {
  kind: Kind;
  contactIds: string[];
  journeyId?: string;
  location?: { lat: number; lng: number } | null;
  note?: string;
}

const LIMITS: Record<Kind, { count: number; minutes: number }> = {
  invite: { count: 20, minutes: 60 },
  journey_share: { count: 20, minutes: 60 },
  sos: { count: 5, minutes: 10 },
};

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const { client, user } = await requireUser(req);
  if (!user) return json({ error: 'Not signed in' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!['invite', 'journey_share', 'sos'].includes(body.kind) || !Array.isArray(body.contactIds) || body.contactIds.length === 0 || body.contactIds.length > 20) {
    return json({ error: 'Invalid request' }, 400);
  }

  if (!Deno.env.get('RESEND_API_KEY')) {
    return json({ error: 'Email delivery is not configured', code: 'not_configured' }, 503);
  }

  const admin = adminClient();
  const limit = LIMITS[body.kind];
  const since = new Date(Date.now() - limit.minutes * 60_000).toISOString();
  const { count } = await admin.from('outbound_messages').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('kind', body.kind).gte('created_at', since);
  if ((count ?? 0) >= limit.count) return json({ error: 'Too many messages. Please wait a few minutes.', code: 'rate_limited' }, 429);

  const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).single();
  const senderName = (profile?.full_name || 'A SafeRoute user').trim();
  const firstName = senderName.split(' ')[0];

  const { data: contacts, error } = await client.from('trusted_contacts').select('*').in('id', body.contactIds);
  if (error) return json({ error: 'Could not load contacts' }, 500);

  let journey: Record<string, any> | null = null;
  if (body.journeyId) {
    const { data } = await client.from('journeys').select('*').eq('id', body.journeyId).single();
    journey = data;
  }

  const results: { contactId: string; sent: boolean; reason?: string }[] = [];
  for (const c of contacts ?? []) {
    if (!c.email) {
      results.push({ contactId: c.id, sent: false, reason: 'no_email' });
      continue;
    }
    if (body.kind === 'invite') {
      const ok = await sendEmail({
        to: c.email,
        subject: `${firstName} invited you to their SafeCircle`,
        heading: `${senderName} would like you in their SafeCircle`,
        paragraphs: [
          `Hi ${c.name}, ${firstName} uses SafeRoute to share walking journeys with people they trust.`,
          'If you accept, you may receive a link when they choose to share a specific journey with you, and a message if they miss an arrival check-in. You will never receive their location automatically.',
          'You do not need a SafeRoute account.',
        ],
        button: { label: 'Review invitation', url: `${appUrl()}/invite/${c.invite_token}` },
      });
      if (ok) await admin.from('trusted_contacts').update({ invite_status: 'pending', invited_at: new Date().toISOString() }).eq('id', c.id);
      results.push({ contactId: c.id, sent: ok });
      continue;
    }

    if (c.invite_status !== 'accepted') {
      results.push({ contactId: c.id, sent: false, reason: 'not_accepted' });
      continue;
    }

    if (body.kind === 'journey_share') {
      if (!c.can_receive_journeys || !journey?.share_token || !journey.share_enabled) {
        results.push({ contactId: c.id, sent: false, reason: 'not_permitted' });
        continue;
      }
      const eta = new Date(journey.expected_arrival).toUTCString();
      const ok = await sendEmail({
        to: c.email,
        subject: `${firstName} shared a walking journey with you`,
        heading: `${firstName} is walking to ${journey.destination?.label ?? 'their destination'}`,
        paragraphs: [
          `They expect to arrive around ${eta}.`,
          journey.share_live_location
            ? 'They chose to share their approximate live location while the journey is active.'
            : 'They shared their planned route. Live location is not being shared.',
          'The link stops working when the journey ends or they stop sharing.',
        ],
        button: { label: 'View journey', url: `${appUrl()}/s/${journey.share_token}` },
      });
      results.push({ contactId: c.id, sent: ok });
      continue;
    }

    // SOS
    if (!c.can_receive_sos) {
      results.push({ contactId: c.id, sent: false, reason: 'not_permitted' });
      continue;
    }
    const loc = body.location;
    const paragraphs = [
      `${senderName} used SafeRoute to ask for your help. Please try to reach them directly.`,
    ];
    if (body.note) paragraphs.push(`Their message: "${body.note.slice(0, 280)}"`);
    if (loc) paragraphs.push(`Location they shared (approximate, from their device at ${new Date().toUTCString()}): https://www.openstreetmap.org/?mlat=${loc.lat.toFixed(5)}&mlon=${loc.lng.toFixed(5)}#map=17/${loc.lat.toFixed(5)}/${loc.lng.toFixed(5)}`);
    paragraphs.push('If you believe they are in immediate danger, call your local emergency number. SafeRoute does not contact emergency services.');
    const ok = await sendEmail({
      to: c.email,
      subject: `${firstName} asked for help via SafeRoute`,
      heading: `${firstName} has asked for help`,
      paragraphs,
      button: journey?.share_token && journey.share_enabled ? { label: 'View their shared journey', url: `${appUrl()}/s/${journey.share_token}` } : undefined,
    });
    results.push({ contactId: c.id, sent: ok });
  }

  const delivered = results.filter((r) => r.sent).length;
  await admin.from('outbound_messages').insert({ user_id: user.id, kind: body.kind, recipient_count: results.length, delivered_count: delivered });
  return json({ sent: delivered, failed: results.length - delivered, results });
});
