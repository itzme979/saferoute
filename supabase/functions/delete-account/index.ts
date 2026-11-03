// Permanently deletes the calling user's account. Cascading foreign keys
// remove profiles, contacts, journeys, check-ins and notifications. Hazard
// reports are kept for the community but are de-identified (user_id -> null).
import { adminClient, json, preflight, requireUser } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const { user } = await requireUser(req);
  if (!user) return json({ error: 'Not signed in' }, 401);

  const admin = adminClient();
  const { data: files } = await admin.storage.from('avatars').list(user.id);
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'Could not delete account' }, 500);
  return json({ ok: true });
});
