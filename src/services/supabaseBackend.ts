import type { SupabaseClient, User } from '@supabase/supabase-js';
import type {
  AppNotification, AuthUser, Checkin, ContactInput, FlagReason, HazardInput, HazardReport, HazardStatus, HazardVote,
  InviteView, Journey, LatLng, Profile, SendResult, SharedJourneyView, StartJourneyInput, TrustedContact,
} from '@/types';
import { BackendError, type AuthEvent, type Backend, type ProfilePatch } from './backend';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY, DEFAULT_WALKING_PREFS } from './defaults';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toUser = (u: User | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '', emailVerified: !!u.email_confirmed_at } : null;

function friendly(error: { message?: string; code?: string } | null, fallback: string): never {
  const msg = error?.message ?? '';
  if (/Invalid login credentials/i.test(msg)) throw new BackendError('That email and password combination is not correct.');
  if (/Email not confirmed/i.test(msg)) throw new BackendError('Please verify your email address first. Check your inbox for the link.', 'unverified');
  if (/User already registered/i.test(msg)) throw new BackendError('An account with this email already exists. Try signing in.');
  if (/rate limit/i.test(msg)) throw new BackendError('Too many attempts. Please wait a minute and try again.');
  if (error?.code === 'P0001' && msg) throw new BackendError(msg);
  if (/Failed to fetch|NetworkError/i.test(msg)) throw new BackendError('Could not reach SafeRoute. Check your connection and try again.', 'network');
  throw new BackendError(fallback);
}

const mapProfile = (r: Row): Profile => ({
  id: r.id, fullName: r.full_name, email: r.email, avatarUrl: r.avatar_url, phone: r.phone,
  walkingPreferences: { ...DEFAULT_WALKING_PREFS, ...r.walking_preferences },
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS, ...r.notification_preferences },
  privacy: { ...DEFAULT_PRIVACY, ...r.privacy },
  emergencyNumber: r.emergency_number, onboarded: r.onboarded, isModerator: r.is_moderator, createdAt: r.created_at,
});

const mapContact = (r: Row): TrustedContact => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone, relationship: r.relationship, inviteStatus: r.invite_status,
  invitedAt: r.invited_at, canReceiveJourneys: r.can_receive_journeys, canReceiveCheckinAlerts: r.can_receive_checkin_alerts,
  canReceiveSos: r.can_receive_sos, createdAt: r.created_at,
});

const mapJourney = (r: Row): Journey => ({
  id: r.id, origin: r.origin, destination: r.destination, route: r.route, status: r.status, startedAt: r.started_at,
  expectedArrival: r.expected_arrival, endedAt: r.ended_at, shareEnabled: r.share_enabled, shareLiveLocation: r.share_live_location,
  sharedContactIds: r.shared_contact_ids ?? [], shareToken: r.share_token, lastLocation: r.last_location, lastLocationAt: r.last_location_at,
});

const mapCheckin = (r: Row): Checkin => ({
  id: r.id, journeyId: r.journey_id, expectedArrival: r.expected_arrival, graceMinutes: r.grace_minutes,
  notifyContacts: r.notify_contacts, contactIds: r.contact_ids ?? [], status: r.status,
  notificationStatus: r.notification_status, confirmedAt: r.confirmed_at,
});

const mapNotification = (r: Row): AppNotification => ({
  id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, read: r.read, createdAt: r.created_at,
});

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new BackendError('You are signed out. Please sign in again.', 'auth');
    return id;
  }

  private photoUrl(path: string | null): string | null {
    if (!path) return null;
    return this.sb.storage.from('hazard-photos').getPublicUrl(path).data.publicUrl;
  }

  // ---------------- Auth ----------------
  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return toUser(data.session?.user);
  }

  onAuthChange(cb: (u: AuthUser | null, e: AuthEvent) => void) {
    const { data } = this.sb.auth.onAuthStateChange((event, session) => {
      const map: Record<string, AuthEvent> = { SIGNED_IN: 'SIGNED_IN', SIGNED_OUT: 'SIGNED_OUT', PASSWORD_RECOVERY: 'PASSWORD_RECOVERY', USER_UPDATED: 'USER_UPDATED', INITIAL_SESSION: 'INITIAL', TOKEN_REFRESHED: 'USER_UPDATED' };
      if (map[event]) cb(toUser(session?.user), map[event]);
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp({ fullName, email, password }: { fullName: string; email: string; password: string }) {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) friendly(error, 'We could not create your account. Please try again.');
    // Supabase returns a user with no identities when the email is already registered (to prevent enumeration).
    if (data.user && data.user.identities?.length === 0) throw new BackendError('An account with this email already exists. Try signing in.');
    return { needsVerification: !data.session };
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) friendly(error, 'We could not sign you in. Please try again.');
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    if (error) friendly(error, 'We could not send a reset link. Please try again.');
    return {};
  }

  async updatePassword(newPassword: string, currentPassword?: string) {
    if (currentPassword !== undefined) {
      const { data } = await this.sb.auth.getSession();
      const email = data.session?.user.email;
      if (!email) throw new BackendError('You are signed out.');
      const { error } = await this.sb.auth.signInWithPassword({ email, password: currentPassword });
      if (error) throw new BackendError('Your current password is not correct.');
    }
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) friendly(error, 'We could not update your password.');
  }

  async resendVerification(email: string) {
    const { error } = await this.sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/onboarding` } });
    if (error) friendly(error, 'We could not resend the email.');
  }

  async deleteAccount() {
    const { error } = await this.sb.functions.invoke('delete-account', { body: {} });
    if (error) throw new BackendError('Your account could not be deleted. Please try again or contact support.');
    await this.sb.auth.signOut();
  }

  // ---------------- Profile ----------------
  async getProfile() {
    const id = await this.uid();
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', id).single();
    if (error || !data) friendly(error, 'Your profile could not be loaded.');
    return mapProfile(data);
  }

  async updateProfile(patch: ProfilePatch) {
    const id = await this.uid();
    const row: Row = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName.trim();
    if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.walkingPreferences) row.walking_preferences = patch.walkingPreferences;
    if (patch.notificationPreferences) row.notification_preferences = patch.notificationPreferences;
    if (patch.privacy) row.privacy = patch.privacy;
    if (patch.emergencyNumber !== undefined) row.emergency_number = patch.emergencyNumber;
    if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
    const { data, error } = await this.sb.from('profiles').update(row).eq('id', id).select('*').single();
    if (error || !data) friendly(error, 'Your changes could not be saved.');
    if (patch.fullName !== undefined) await this.sb.auth.updateUser({ data: { full_name: patch.fullName.trim() } });
    return mapProfile(data);
  }

  async uploadAvatar(image: Blob) {
    const id = await this.uid();
    const path = `${id}/avatar-${Date.now()}.jpg`;
    const { error } = await this.sb.storage.from('avatars').upload(path, image, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new BackendError('Your photo could not be uploaded.');
    const url = this.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    await this.updateProfile({ avatarUrl: url });
    return url;
  }

  // ---------------- Contacts ----------------
  async listContacts() {
    const { data, error } = await this.sb.from('trusted_contacts').select('*').order('created_at');
    if (error) friendly(error, 'Your SafeCircle could not be loaded.');
    return (data ?? []).map(mapContact);
  }

  async addContact(input: ContactInput) {
    const id = await this.uid();
    const { count } = await this.sb.from('trusted_contacts').select('id', { count: 'exact', head: true });
    if ((count ?? 0) >= 20) throw new BackendError('You can have up to 20 trusted contacts.');
    const { data, error } = await this.sb.from('trusted_contacts').insert({
      owner_id: id, name: input.name.trim(), email: input.email?.trim() || null, phone: input.phone?.trim() || null,
      relationship: input.relationship?.trim() || null, can_receive_journeys: input.canReceiveJourneys ?? true,
      can_receive_checkin_alerts: input.canReceiveCheckinAlerts ?? true, can_receive_sos: input.canReceiveSos ?? true,
    }).select('*').single();
    if (error || !data) friendly(error, 'This contact could not be added.');
    return mapContact(data);
  }

  async updateContact(cid: string, patch: Partial<ContactInput>) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.email !== undefined) row.email = patch.email?.trim() || null;
    if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
    if (patch.relationship !== undefined) row.relationship = patch.relationship?.trim() || null;
    if (patch.canReceiveJourneys !== undefined) row.can_receive_journeys = patch.canReceiveJourneys;
    if (patch.canReceiveCheckinAlerts !== undefined) row.can_receive_checkin_alerts = patch.canReceiveCheckinAlerts;
    if (patch.canReceiveSos !== undefined) row.can_receive_sos = patch.canReceiveSos;
    const { data, error } = await this.sb.from('trusted_contacts').update(row).eq('id', cid).select('*').single();
    if (error || !data) friendly(error, 'This contact could not be updated.');
    return mapContact(data);
  }

  async removeContact(cid: string) {
    const { error } = await this.sb.from('trusted_contacts').delete().eq('id', cid);
    if (error) friendly(error, 'This contact could not be removed.');
  }

  private async invokeNotify(body: Row): Promise<SendResult> {
    const { data, error } = await this.sb.functions.invoke('notify', { body });
    if (error) {
      let detail: Row = {};
      try {
        detail = await (error as any).context?.json?.();
      } catch {
        /* ignore */
      }
      if (detail?.code === 'not_configured') {
        return { sent: 0, failed: 0, simulated: true, message: 'Email delivery is not set up for this SafeRoute installation, so no message was sent.' };
      }
      throw new BackendError(detail?.error ?? 'Messages could not be sent. Please try again.');
    }
    return { sent: data.sent, failed: data.failed, simulated: false };
  }

  async sendInvite(cid: string) {
    return this.invokeNotify({ kind: 'invite', contactIds: [cid] });
  }

  async createInviteLink(cid: string) {
    const { data, error } = await this.sb.from('trusted_contacts')
      .update({ invite_status: 'pending', invited_at: new Date().toISOString() })
      .eq('id', cid).select('invite_token').single();
    if (error || !data) friendly(error, 'The invitation link could not be created.');
    return `${window.location.origin}/invite/${data.invite_token}`;
  }

  // ---------------- Journeys ----------------
  async listJourneys() {
    const { data, error } = await this.sb.from('journeys').select('*').order('started_at', { ascending: false }).limit(100);
    if (error) friendly(error, 'Your journeys could not be loaded.');
    return (data ?? []).map(mapJourney);
  }

  async getActiveJourney() {
    const { data, error } = await this.sb.from('journeys').select('*, checkins(*)').eq('status', 'active').maybeSingle();
    if (error) friendly(error, 'Your active journey could not be loaded.');
    if (!data) return null;
    const c = (data.checkins as Row[] | null)?.[0];
    return { journey: mapJourney(data), checkin: c ? mapCheckin(c) : null };
  }

  async startJourney(input: StartJourneyInput) {
    const id = await this.uid();
    const { data, error } = await this.sb.from('journeys').insert({
      user_id: id, origin: input.origin, destination: input.destination, route: input.route,
      expected_arrival: input.expectedArrival, share_enabled: input.share.enabled,
      share_live_location: input.share.enabled && input.share.liveLocation,
      shared_contact_ids: input.share.enabled ? input.share.contactIds : [],
      share_token: input.share.enabled ? crypto.randomUUID() : null,
    }).select('*').single();
    if (error?.code === '23505') throw new BackendError('You already have an active journey. End it before starting a new one.');
    if (error || !data) friendly(error, 'Your journey could not be started.');
    if (input.checkin.enabled) {
      const { error: cErr } = await this.sb.from('checkins').insert({
        journey_id: data.id, user_id: id, expected_arrival: input.expectedArrival, grace_minutes: input.checkin.graceMinutes,
        notify_contacts: input.checkin.notifyContacts, contact_ids: input.checkin.contactIds,
      });
      if (cErr) {
        await this.sb.from('journeys').delete().eq('id', data.id);
        friendly(cErr, 'Your arrival check-in could not be set up.');
      }
    }
    return mapJourney(data);
  }

  async updateJourneySharing(jid: string, patch: { enabled?: boolean; liveLocation?: boolean; contactIds?: string[] }) {
    const row: Row = {};
    if (patch.enabled !== undefined) {
      row.share_enabled = patch.enabled;
      if (patch.enabled) {
        row.share_token = crypto.randomUUID();
        row.share_revoked_at = null;
      } else {
        row.share_live_location = false;
        row.last_location = null;
        row.share_revoked_at = new Date().toISOString();
      }
    }
    if (patch.liveLocation !== undefined) {
      row.share_live_location = patch.liveLocation;
      if (!patch.liveLocation) row.last_location = null;
    }
    if (patch.contactIds) row.shared_contact_ids = patch.contactIds;
    const { data, error } = await this.sb.from('journeys').update(row).eq('id', jid).select('*').single();
    if (error || !data) friendly(error, 'Sharing settings could not be updated.');
    return mapJourney(data);
  }

  async updateJourneyLocation(jid: string, location: LatLng | null) {
    await this.sb.from('journeys').update({ last_location: location, last_location_at: location ? new Date().toISOString() : null }).eq('id', jid);
  }

  async endJourney(jid: string, status: 'completed' | 'cancelled') {
    const ts = new Date().toISOString();
    const { error } = await this.sb.from('journeys').update({ status, ended_at: ts, last_location: null, share_live_location: false }).eq('id', jid);
    if (error) friendly(error, 'Your journey could not be ended. Please try again.');
    await this.sb.from('checkins')
      .update(status === 'completed' ? { status: 'confirmed', confirmed_at: ts } : { status: 'cancelled' })
      .eq('journey_id', jid).in('status', ['scheduled', 'reminded', 'missed']);
    const profile = await this.getProfile();
    if (!profile.privacy.saveJourneyHistory) await this.sb.from('journeys').delete().eq('id', jid);
  }

  async deleteJourney(jid: string) {
    const { error } = await this.sb.from('journeys').delete().eq('id', jid).neq('status', 'active');
    if (error) friendly(error, 'This journey could not be deleted.');
  }

  async clearJourneyHistory() {
    const id = await this.uid();
    const { error } = await this.sb.from('journeys').delete().eq('user_id', id).neq('status', 'active');
    if (error) friendly(error, 'Your history could not be cleared.');
  }

  async updateCheckin(cid: string, patch: Partial<Pick<Checkin, 'status' | 'expectedArrival' | 'notificationStatus'>>) {
    const row: Row = {};
    if (patch.status) row.status = patch.status;
    if (patch.status === 'confirmed') row.confirmed_at = new Date().toISOString();
    if (patch.expectedArrival) row.expected_arrival = patch.expectedArrival;
    if (patch.notificationStatus) row.notification_status = patch.notificationStatus;
    const { data, error } = await this.sb.from('checkins').update(row).eq('id', cid).select('*').single();
    if (error || !data) friendly(error, 'Your check-in could not be updated.');
    if (patch.expectedArrival) await this.sb.from('journeys').update({ expected_arrival: patch.expectedArrival }).eq('id', data.journey_id);
    return mapCheckin(data);
  }

  async notifyJourneyShare(journeyId: string, contactIds: string[]) {
    return this.invokeNotify({ kind: 'journey_share', journeyId, contactIds });
  }

  async sendSos(input: { contactIds: string[]; location: LatLng | null; note: string; journeyId?: string }) {
    return this.invokeNotify({ kind: 'sos', contactIds: input.contactIds, location: input.location, note: input.note, journeyId: input.journeyId });
  }

  // ---------------- Hazards ----------------
  private mapHazard = (r: Row): HazardReport => ({
    id: r.id, category: r.category, description: r.description, lat: r.lat, lng: r.lng, photoUrl: this.photoUrl(r.photo_path),
    status: r.status, createdAt: r.created_at, statusChangedAt: r.status_changed_at, isOwn: !!r.is_own,
    resolvedVotes: r.resolved_votes ?? 0, stillThereVotes: r.still_there_votes ?? 0, myVote: r.my_vote ?? null, flagCount: r.flag_count,
  });

  async listHazards() {
    const since = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data, error } = await this.sb.from('hazard_reports_public').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500);
    if (error) friendly(error, 'Community reports could not be loaded.');
    return (data ?? []).map(this.mapHazard);
  }

  async createHazard(input: HazardInput) {
    const id = await this.uid();
    let photo_path: string | null = null;
    if (input.photo) {
      photo_path = `${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await this.sb.storage.from('hazard-photos').upload(photo_path, input.photo, { contentType: 'image/jpeg' });
      if (error) throw new BackendError('Your photo could not be uploaded. Try again or submit without a photo.');
    }
    const { data, error } = await this.sb.from('hazard_reports').insert({
      user_id: id, category: input.category, description: input.description.trim(), lat: input.lat, lng: input.lng, photo_path,
    }).select('*').single();
    if (error || !data) {
      if (photo_path) await this.sb.storage.from('hazard-photos').remove([photo_path]);
      friendly(error, 'Your report could not be submitted.');
    }
    return this.mapHazard({ ...data, is_own: true });
  }

  async voteHazard(hid: string, vote: HazardVote) {
    const id = await this.uid();
    const { error } = await this.sb.from('hazard_votes').upsert({ report_id: hid, user_id: id, vote });
    if (error) friendly(error, 'Your update could not be saved.');
  }

  async flagHazard(hid: string, reason: FlagReason) {
    const id = await this.uid();
    const { error } = await this.sb.from('hazard_flags').insert({ report_id: hid, user_id: id, reason });
    if (error?.code === '23505') throw new BackendError('You have already flagged this report.');
    if (error) friendly(error, 'Your flag could not be submitted.');
  }

  async deleteHazard(hid: string) {
    const { error } = await this.sb.from('hazard_reports').delete().eq('id', hid);
    if (error) friendly(error, 'This report could not be deleted.');
  }

  async listModerationQueue() {
    const { data, error } = await this.sb.from('hazard_reports').select('*').or('flag_count.gt.0,status.eq.hidden').order('flag_count', { ascending: false }).limit(200);
    if (error) friendly(error, 'The moderation queue could not be loaded.');
    return (data ?? []).map(this.mapHazard);
  }

  async moderateHazard(hid: string, status: HazardStatus) {
    const row: Row = { status };
    if (status === 'active') row.flag_count = 0;
    const { error } = await this.sb.from('hazard_reports').update(row).eq('id', hid);
    if (error) friendly(error, 'This report could not be updated.');
  }

  // ---------------- Notifications ----------------
  async listNotifications() {
    const { data, error } = await this.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return (data ?? []).map(mapNotification);
  }

  async createNotification(n: { type: AppNotification['type']; title: string; body: string; link?: string }) {
    const id = await this.uid();
    const { data, error } = await this.sb.from('notifications').insert({ user_id: id, ...n, link: n.link ?? null }).select('*').single();
    if (error || !data) friendly(error, 'Notification could not be saved.');
    return mapNotification(data);
  }

  async markNotificationRead(nid: string) {
    await this.sb.from('notifications').update({ read: true }).eq('id', nid);
  }

  async markAllNotificationsRead() {
    await this.sb.from('notifications').update({ read: true }).eq('read', false);
  }

  subscribeNotifications(cb: (n: AppNotification) => void) {
    const channel = this.sb
      .channel('notifications-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => cb(mapNotification(payload.new as Row)))
      .subscribe();
    return () => {
      this.sb.removeChannel(channel);
    };
  }

  // ---------------- Public token pages ----------------
  async getSharedJourney(token: string): Promise<SharedJourneyView | null> {
    const { data, error } = await this.sb.rpc('get_shared_journey', { p_token: token });
    if (error) throw new BackendError('This journey could not be loaded.');
    return data as SharedJourneyView | null;
  }

  async getInvite(token: string): Promise<InviteView | null> {
    const { data, error } = await this.sb.rpc('get_invite', { p_token: token });
    if (error) throw new BackendError('This invitation could not be loaded.');
    return data as InviteView | null;
  }

  async respondToInvite(token: string, accept: boolean) {
    const { data, error } = await this.sb.rpc('respond_invite', { p_token: token, p_accept: accept });
    if (error) throw new BackendError('Your response could not be saved.');
    return !!(data as Row)?.ok;
  }
}
