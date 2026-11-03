// Runs every minute via pg_cron (see supabase/cron.sql).
// Finds SafeArrival check-ins whose expected arrival time + grace period has
// passed without confirmation, then follows each user's own preferences:
// an in-app notice for the user, and (only if they opted in and selected
// contacts) a calm email to those contacts. It never contacts emergency
// services and never states that the user is in danger.
import { adminClient, appUrl, json, sendEmail } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = adminClient();
  const { data: due, error } = await admin
    .from('checkins')
    .select('*, journeys!inner(id, status, destination, share_token, share_enabled, user_id), profiles!inner(full_name)')
    .in('status', ['scheduled', 'reminded'])
    .lt('expected_arrival', new Date().toISOString())
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let processed = 0;
  for (const c of due ?? []) {
    const graceEnds = new Date(c.expected_arrival).getTime() + c.grace_minutes * 60_000;
    if (Date.now() < graceEnds) continue;
    if (c.journeys.status !== 'active') {
      await admin.from('checkins').update({ status: 'cancelled' }).eq('id', c.id);
      continue;
    }
    processed++;
    let notificationStatus = 'not_configured';
    if (c.notify_contacts && c.contact_ids.length > 0) {
      const { data: contacts } = await admin.from('trusted_contacts').select('*')
        .in('id', c.contact_ids).eq('owner_id', c.user_id).eq('invite_status', 'accepted').eq('can_receive_checkin_alerts', true);
      const name = (c.profiles.full_name || 'Your contact').split(' ')[0];
      let delivered = 0;
      for (const contact of contacts ?? []) {
        if (!contact.email) continue;
        const ok = await sendEmail({
          to: contact.email,
          subject: `${name} hasn't confirmed their arrival yet`,
          heading: `${name} hasn't checked in yet`,
          paragraphs: [
            `${name} planned to arrive at ${c.journeys.destination?.label ?? 'their destination'} by ${new Date(c.expected_arrival).toUTCString()} and asked SafeRoute to let you know if they didn't confirm arrival.`,
            'This does not necessarily mean anything is wrong. They may have forgotten to check in, lost signal, or their phone battery may have run out.',
            'You may want to try contacting them directly.',
          ],
          button: c.journeys.share_enabled && c.journeys.share_token ? { label: 'View shared journey', url: `${appUrl()}/s/${c.journeys.share_token}` } : undefined,
        });
        if (ok) delivered++;
      }
      notificationStatus = delivered > 0 ? 'contacts_notified' : 'contacts_notify_failed';
      await admin.from('outbound_messages').insert({ user_id: c.user_id, kind: 'missed_checkin', recipient_count: contacts?.length ?? 0, delivered_count: delivered });
    }
    await admin.from('checkins').update({ status: 'missed', notification_status: notificationStatus }).eq('id', c.id);
    await admin.from('notifications').insert({
      user_id: c.user_id,
      type: 'checkin',
      title: 'Arrival check-in missed',
      body: notificationStatus === 'contacts_notified'
        ? 'Your selected contacts were emailed that you have not confirmed arrival. You can still confirm now.'
        : 'You have not confirmed your arrival. You can still confirm now.',
      link: '/journey',
    });
  }
  return json({ processed });
});
