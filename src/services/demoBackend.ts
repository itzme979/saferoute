/**
 * Demo Mode backend.
 * Used automatically when Supabase is not configured. Everything is stored in
 * this browser's localStorage only; nothing leaves the device and no emails
 * are sent. Every result that would normally involve an outside service says
 * so via `simulated: true`, and the UI labels it.
 */
import { sampleContacts, sampleHazards, sampleJourneys } from '@/demo/sampleData';
import { approximate } from '@/lib/geo';
import { blobToDataUrl } from '@/lib/image';
import { containsPersonalInfo } from '@/lib/validation';
import type {
  AppNotification, AuthUser, Checkin, ContactInput, FlagReason, HazardInput, HazardReport, HazardStatus, HazardVote,
  InviteView, Journey, LatLng, Profile, SendResult, SharedJourneyView, StartJourneyInput, TrustedContact,
} from '@/types';
import { BackendError, type AuthEvent, type Backend, type ProfilePatch } from './backend';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY, DEFAULT_WALKING_PREFS } from './defaults';

const DEMO_KEY = 'saferoute-demo-v1';
const LOCAL_KEY = 'saferoute-local-v1';
const DEMO_EMAIL = 'demo@saferoute.example';

interface DemoUser { id: string; email: string; passwordHash: string; createdAt: string }
type Owned<T> = T & { userId: string };
interface StoredHazard extends HazardReport { userId: string | null; votes: Record<string, HazardVote>; flags: Record<string, FlagReason> }

interface DB {
  users: DemoUser[];
  sessionUserId: string | null;
  profiles: Profile[];
  contacts: Owned<TrustedContact & { inviteToken: string }>[];
  journeys: Owned<Journey>[];
  checkins: Owned<Checkin>[];
  hazards: StoredHazard[];
  notifications: Owned<AppNotification>[];
  resetTokens: Record<string, string>;
  sosLog: Owned<{ at: string }>[];
}

const empty = (seed: boolean): DB => ({
  users: [], sessionUserId: null, profiles: [], contacts: [], journeys: [], checkins: [],
  hazards: seed ? sampleHazards().map((h) => ({ ...h, votes: {}, flags: {} })) : [],
  notifications: [], resetTokens: {}, sosLog: [],
});

function load(key: string, seed: boolean): DB {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...empty(seed), ...(JSON.parse(raw) as DB) };
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return empty(seed);
}

async function hash(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`saferoute-demo:${pw}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const strip = <T extends object>(o: T, ...keys: string[]): T => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k];
  return c as T;
};

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  private readonly key: string;
  private db: DB;
  private authListeners = new Set<(u: AuthUser | null, e: AuthEvent) => void>();
  private notifListeners = new Set<(n: AppNotification) => void>();

  /** @param seed true for the /demo area: fictional sample contacts, journeys and hazard reports. */
  constructor(readonly seed: boolean) {
    this.key = seed ? DEMO_KEY : LOCAL_KEY;
    this.db = load(this.key, seed);
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.db));
    } catch {
      throw new BackendError('Browser storage is full or unavailable. Demo data could not be saved.');
    }
  }

  private uid(): string {
    const id = this.db.sessionUserId;
    if (!id) throw new BackendError('You are signed out. Please sign in again.', 'auth');
    return id;
  }

  private emit(e: AuthEvent) {
    const u = this.currentUser();
    this.authListeners.forEach((cb) => cb(u, e));
  }

  private currentUser(): AuthUser | null {
    const u = this.db.users.find((x) => x.id === this.db.sessionUserId);
    return u ? { id: u.id, email: u.email, emailVerified: true } : null;
  }

  // ---------------- Auth ----------------
  async getUser() {
    return this.currentUser();
  }

  onAuthChange(cb: (u: AuthUser | null, e: AuthEvent) => void) {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }

  async signUp(input: { fullName: string; email: string; password: string }) {
    await delay();
    return this.createAccount(input, false);
  }

  private async createAccount({ fullName, email, password }: { fullName: string; email: string; password: string }, onboarded: boolean) {
    const e = email.trim().toLowerCase();
    if (this.db.users.some((u) => u.email === e)) throw new BackendError('An account with this email already exists. Try signing in.');
    const id = crypto.randomUUID();
    this.db.users.push({ id, email: e, passwordHash: await hash(password), createdAt: now() });
    this.db.profiles.push({
      id, fullName: fullName.trim(), email: e, avatarUrl: null, phone: null,
      walkingPreferences: { ...DEFAULT_WALKING_PREFS }, notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS },
      privacy: { ...DEFAULT_PRIVACY }, emergencyNumber: '911', onboarded, isModerator: true, createdAt: now(),
    });
    if (this.seed) {
      for (const c of sampleContacts()) this.db.contacts.push({ ...c, userId: id, inviteToken: crypto.randomUUID() });
      for (const j of sampleJourneys()) this.db.journeys.push({ ...j, userId: id });
    }
    this.db.notifications.push({
      id: crypto.randomUUID(), userId: id, type: 'system', title: 'Welcome to SafeRoute',
      body: this.seed
        ? 'You are exploring the demo. Sample contacts, journeys and reports are labelled "Sample" and can be removed in Settings.'
        : 'Your data is stored only in this browser and no messages are sent.',
      link: '/settings', read: false, createdAt: now(),
    });
    this.db.sessionUserId = id;
    this.save();
    this.emit('SIGNED_IN');
    return { needsVerification: false };
  }

  /** /demo area: sign straight into a ready-made demo account with sample data. */
  async enterDemo() {
    if (!this.seed) throw new BackendError('The demo is not available here.');
    if (this.currentUser()) return;
    const existing = this.db.users.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      this.db.sessionUserId = existing.id;
      this.save();
      this.emit('SIGNED_IN');
      return;
    }
    await this.createAccount({ fullName: 'Alex Demo', email: DEMO_EMAIL, password: crypto.randomUUID() }, true);
  }

  async signIn(email: string, password: string) {
    await delay();
    const u = this.db.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.passwordHash !== (await hash(password))) throw new BackendError('That email and password combination is not correct.');
    this.db.sessionUserId = u.id;
    this.save();
    this.emit('SIGNED_IN');
  }

  async signOut() {
    this.db.sessionUserId = null;
    this.save();
    this.emit('SIGNED_OUT');
  }

  async requestPasswordReset(email: string) {
    await delay();
    const u = this.db.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u) return {};
    const token = crypto.randomUUID();
    this.db.resetTokens[token] = u.id;
    this.save();
    return { demoResetLink: `/reset-password?demo_token=${token}` };
  }

  /** Demo only: start a recovery session from a reset token. */
  async beginDemoRecovery(token: string): Promise<boolean> {
    const id = this.db.resetTokens[token];
    if (!id) return false;
    delete this.db.resetTokens[token];
    this.db.sessionUserId = id;
    this.save();
    this.emit('PASSWORD_RECOVERY');
    return true;
  }

  async updatePassword(newPassword: string, currentPassword?: string) {
    await delay();
    const u = this.db.users.find((x) => x.id === this.uid())!;
    if (currentPassword !== undefined && u.passwordHash !== (await hash(currentPassword))) {
      throw new BackendError('Your current password is not correct.');
    }
    u.passwordHash = await hash(newPassword);
    this.save();
    this.emit('USER_UPDATED');
  }

  async resendVerification() {
    await delay();
  }

  async deleteAccount() {
    await delay(400);
    const id = this.uid();
    this.db.users = this.db.users.filter((u) => u.id !== id);
    this.db.profiles = this.db.profiles.filter((p) => p.id !== id);
    this.db.contacts = this.db.contacts.filter((c) => c.userId !== id);
    this.db.journeys = this.db.journeys.filter((j) => j.userId !== id);
    this.db.checkins = this.db.checkins.filter((c) => c.userId !== id);
    this.db.notifications = this.db.notifications.filter((n) => n.userId !== id);
    this.db.hazards = this.db.hazards.map((h) => (h.userId === id ? { ...h, userId: null } : h));
    this.db.sessionUserId = null;
    this.save();
    this.emit('SIGNED_OUT');
  }

  // ---------------- Profile ----------------
  async getProfile() {
    const p = this.db.profiles.find((x) => x.id === this.uid());
    if (!p) throw new BackendError('Profile not found.');
    return { ...p };
  }

  async updateProfile(patch: ProfilePatch) {
    await delay(150);
    const p = this.db.profiles.find((x) => x.id === this.uid())!;
    Object.assign(p, patch);
    this.save();
    return { ...p };
  }

  async uploadAvatar(image: Blob) {
    const url = await blobToDataUrl(image);
    await this.updateProfile({ avatarUrl: url });
    return url;
  }

  // ---------------- Contacts ----------------
  async listContacts() {
    const id = this.uid();
    return this.db.contacts.filter((c) => c.userId === id).map((c) => strip(c, 'userId', 'inviteToken') as TrustedContact);
  }

  async addContact(input: ContactInput) {
    await delay();
    const id = this.uid();
    if (this.db.contacts.filter((c) => c.userId === id).length >= 20) throw new BackendError('You can have up to 20 trusted contacts.');
    const c = {
      id: crypto.randomUUID(), userId: id, inviteToken: crypto.randomUUID(), name: input.name.trim(),
      email: input.email?.trim() || null, phone: input.phone?.trim() || null, relationship: input.relationship?.trim() || null,
      inviteStatus: 'not_invited' as const, invitedAt: null, canReceiveJourneys: input.canReceiveJourneys ?? true,
      canReceiveCheckinAlerts: input.canReceiveCheckinAlerts ?? true, canReceiveSos: input.canReceiveSos ?? true, createdAt: now(),
    };
    this.db.contacts.push(c);
    this.save();
    return strip(c, 'userId', 'inviteToken') as TrustedContact;
  }

  async updateContact(cid: string, patch: Partial<ContactInput>) {
    await delay(150);
    const c = this.db.contacts.find((x) => x.id === cid && x.userId === this.uid());
    if (!c) throw new BackendError('Contact not found.');
    const changedAddress = (patch.email !== undefined && (patch.email || null) !== c.email) || (patch.phone !== undefined && (patch.phone || null) !== c.phone);
    Object.assign(c, patch);
    if (patch.email !== undefined) c.email = patch.email?.trim() || null;
    if (patch.phone !== undefined) c.phone = patch.phone?.trim() || null;
    if (changedAddress) {
      c.inviteStatus = 'not_invited';
      c.inviteToken = crypto.randomUUID();
    }
    this.save();
    return strip(c, 'userId', 'inviteToken') as TrustedContact;
  }

  async removeContact(cid: string) {
    await delay(150);
    const id = this.uid();
    this.db.contacts = this.db.contacts.filter((c) => !(c.id === cid && c.userId === id));
    this.save();
  }

  async sendInvite(cid: string) {
    await delay(400);
    const c = this.db.contacts.find((x) => x.id === cid && x.userId === this.uid());
    if (!c) throw new BackendError('Contact not found.');
    if (!c.email) return { sent: 0, failed: 1, simulated: true, message: 'Email invitations need an email address. Share an invitation link instead.' };
    c.inviteStatus = 'pending';
    c.invitedAt = now();
    this.save();
    return {
      sent: 0, failed: 0, simulated: true,
      message: 'Demo Mode: no email was sent. Use the invitation link to see what your contact would see.',
      demoInviteLink: `/invite/${c.inviteToken}`,
    };
  }

  async createInviteLink(cid: string) {
    await delay(200);
    const c = this.db.contacts.find((x) => x.id === cid && x.userId === this.uid());
    if (!c) throw new BackendError('Contact not found.');
    c.inviteStatus = 'pending';
    c.invitedAt = now();
    this.save();
    return `${window.location.origin}/invite/${c.inviteToken}`;
  }

  // ---------------- Journeys ----------------
  async listJourneys() {
    const id = this.uid();
    return this.db.journeys
      .filter((j) => j.userId === id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((j) => strip(j, 'userId') as Journey);
  }

  async getActiveJourney() {
    const id = this.uid();
    const j = this.db.journeys.find((x) => x.userId === id && x.status === 'active');
    if (!j) return null;
    const c = this.db.checkins.find((x) => x.journeyId === j.id) ?? null;
    return { journey: strip(j, 'userId') as Journey, checkin: c ? (strip(c, 'userId') as Checkin) : null };
  }

  async startJourney(input: StartJourneyInput) {
    await delay(350);
    const id = this.uid();
    if (this.db.journeys.some((j) => j.userId === id && j.status === 'active')) {
      throw new BackendError('You already have an active journey. End it before starting a new one.');
    }
    const j: Owned<Journey> = {
      id: crypto.randomUUID(), userId: id, origin: input.origin, destination: input.destination, route: input.route,
      status: 'active', startedAt: now(), expectedArrival: input.expectedArrival, endedAt: null,
      shareEnabled: input.share.enabled, shareLiveLocation: input.share.enabled && input.share.liveLocation,
      sharedContactIds: input.share.enabled ? input.share.contactIds : [],
      shareToken: input.share.enabled ? crypto.randomUUID() : null, lastLocation: null, lastLocationAt: null,
    };
    this.db.journeys.push(j);
    if (input.checkin.enabled) {
      this.db.checkins.push({
        id: crypto.randomUUID(), userId: id, journeyId: j.id, expectedArrival: input.expectedArrival,
        graceMinutes: input.checkin.graceMinutes, notifyContacts: input.checkin.notifyContacts,
        contactIds: input.checkin.contactIds, status: 'scheduled', notificationStatus: 'none', confirmedAt: null,
      });
    }
    this.save();
    return strip(j, 'userId') as Journey;
  }

  private ownJourney(jid: string) {
    const j = this.db.journeys.find((x) => x.id === jid && x.userId === this.uid());
    if (!j) throw new BackendError('Journey not found.');
    return j;
  }

  async updateJourneySharing(jid: string, patch: { enabled?: boolean; liveLocation?: boolean; contactIds?: string[] }) {
    const j = this.ownJourney(jid);
    if (patch.enabled !== undefined) {
      j.shareEnabled = patch.enabled;
      if (patch.enabled && !j.shareToken) j.shareToken = crypto.randomUUID();
      if (!patch.enabled) {
        j.shareLiveLocation = false;
        j.lastLocation = null;
        j.shareToken = null;
      }
    }
    if (patch.liveLocation !== undefined) {
      j.shareLiveLocation = j.shareEnabled && patch.liveLocation;
      if (!patch.liveLocation) j.lastLocation = null;
    }
    if (patch.contactIds) j.sharedContactIds = patch.contactIds;
    this.save();
    return strip(j, 'userId') as Journey;
  }

  async updateJourneyLocation(jid: string, location: LatLng | null) {
    const j = this.ownJourney(jid);
    j.lastLocation = location;
    j.lastLocationAt = location ? now() : null;
    this.save();
  }

  async endJourney(jid: string, status: 'completed' | 'cancelled') {
    await delay(250);
    const j = this.ownJourney(jid);
    j.status = status;
    j.endedAt = now();
    j.lastLocation = null;
    j.shareLiveLocation = false;
    for (const c of this.db.checkins.filter((x) => x.journeyId === jid)) {
      if (c.status !== 'confirmed') c.status = status === 'completed' ? 'confirmed' : 'cancelled';
      if (status === 'completed' && !c.confirmedAt) c.confirmedAt = now();
    }
    const profile = this.db.profiles.find((p) => p.id === j.userId);
    if (profile && !profile.privacy.saveJourneyHistory) {
      this.db.journeys = this.db.journeys.filter((x) => x.id !== jid);
      this.db.checkins = this.db.checkins.filter((x) => x.journeyId !== jid);
    }
    this.save();
  }

  async deleteJourney(jid: string) {
    const j = this.ownJourney(jid);
    if (j.status === 'active') throw new BackendError('End this journey before deleting it.');
    this.db.journeys = this.db.journeys.filter((x) => x.id !== jid);
    this.db.checkins = this.db.checkins.filter((x) => x.journeyId !== jid);
    this.save();
  }

  async clearJourneyHistory() {
    await delay();
    const id = this.uid();
    const removed = new Set(this.db.journeys.filter((j) => j.userId === id && j.status !== 'active').map((j) => j.id));
    this.db.journeys = this.db.journeys.filter((j) => !removed.has(j.id));
    this.db.checkins = this.db.checkins.filter((c) => !removed.has(c.journeyId));
    this.save();
  }

  async updateCheckin(cid: string, patch: Partial<Pick<Checkin, 'status' | 'expectedArrival' | 'notificationStatus'>>) {
    const c = this.db.checkins.find((x) => x.id === cid && x.userId === this.uid());
    if (!c) throw new BackendError('Check-in not found.');
    Object.assign(c, patch);
    if (patch.status === 'confirmed') c.confirmedAt = now();
    if (patch.expectedArrival) {
      const j = this.db.journeys.find((x) => x.id === c.journeyId);
      if (j) j.expectedArrival = patch.expectedArrival;
    }
    this.save();
    return strip(c, 'userId') as Checkin;
  }

  async notifyJourneyShare(_journeyId: string, contactIds: string[]): Promise<SendResult> {
    await delay(300);
    return { sent: 0, failed: 0, simulated: true, message: `Demo Mode: no messages were sent. In a live setup, ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'} would receive an email with a private link.` };
  }

  async sendSos(input: { contactIds: string[]; location: LatLng | null; note: string }): Promise<SendResult> {
    await delay(500);
    const id = this.uid();
    const recent = this.db.sosLog.filter((x) => x.userId === id && Date.now() - new Date(x.at).getTime() < 600000);
    if (recent.length >= 5) throw new BackendError('Too many alerts in a short time. Please wait a few minutes, or call emergency services directly.');
    this.db.sosLog.push({ userId: id, at: now() });
    this.save();
    return { sent: 0, failed: 0, simulated: true, message: `Demo Mode: no alert was sent. In a live setup, ${input.contactIds.length} contact${input.contactIds.length === 1 ? '' : 's'} would be emailed${input.location ? ' with your approximate location' : ''}.` };
  }

  // ---------------- Hazards ----------------
  private toReport(h: StoredHazard, me: string | null): HazardReport {
    const votes = Object.values(h.votes);
    return {
      ...strip(h, 'userId', 'votes', 'flags'),
      isOwn: !!me && h.userId === me,
      resolvedVotes: (h.isSample ? h.resolvedVotes : 0) + votes.filter((v) => v !== 'still_there').length,
      stillThereVotes: (h.isSample ? h.stillThereVotes : 0) + votes.filter((v) => v === 'still_there').length,
      myVote: me ? h.votes[me] ?? null : null,
      flagCount: Object.keys(h.flags).length,
    };
  }

  async listHazards() {
    await delay(200);
    const me = this.db.sessionUserId;
    return this.db.hazards.filter((h) => h.status !== 'hidden').map((h) => this.toReport(h, me));
  }

  async createHazard(input: HazardInput) {
    await delay(400);
    const id = this.uid();
    const recent = this.db.hazards.filter((h) => h.userId === id && Date.now() - new Date(h.createdAt).getTime() < 3600000);
    if (recent.length >= 5) throw new BackendError('Report limit reached. Please try again later.');
    if (containsPersonalInfo(input.description)) throw new BackendError('Please remove email addresses or phone numbers from the description.');
    const pos = approximate(input);
    const h: StoredHazard = {
      id: crypto.randomUUID(), userId: id, category: input.category, description: input.description.trim(),
      lat: pos.lat, lng: pos.lng, photoUrl: input.photo ? await blobToDataUrl(input.photo) : null,
      status: 'active', createdAt: now(), statusChangedAt: null, isOwn: true, resolvedVotes: 0, stillThereVotes: 0,
      myVote: null, votes: {}, flags: {},
    };
    this.db.hazards.push(h);
    this.save();
    return this.toReport(h, id);
  }

  async voteHazard(hid: string, vote: HazardVote) {
    await delay(150);
    const id = this.uid();
    const h = this.db.hazards.find((x) => x.id === hid);
    if (!h) throw new BackendError('Report not found.');
    h.votes[id] = vote;
    const r = this.toReport(h, id);
    let next = h.status;
    if (h.userId === id && vote !== 'still_there') next = vote;
    else if (r.resolvedVotes >= 3 && r.resolvedVotes > r.stillThereVotes) next = vote === 'outdated' ? 'outdated' : 'resolved';
    else if (r.stillThereVotes > r.resolvedVotes && h.status !== 'active') next = 'active';
    if (next !== h.status) {
      h.status = next;
      h.statusChangedAt = now();
    }
    this.save();
  }

  async flagHazard(hid: string, reason: FlagReason) {
    await delay(150);
    const h = this.db.hazards.find((x) => x.id === hid);
    if (!h) throw new BackendError('Report not found.');
    h.flags[this.uid()] = reason;
    if (Object.keys(h.flags).length >= 3) h.status = 'hidden';
    this.save();
  }

  async deleteHazard(hid: string) {
    const id = this.uid();
    const h = this.db.hazards.find((x) => x.id === hid);
    if (!h || h.userId !== id) throw new BackendError('You can only delete your own reports.');
    this.db.hazards = this.db.hazards.filter((x) => x.id !== hid);
    this.save();
  }

  async listModerationQueue() {
    const me = this.uid();
    return this.db.hazards
      .filter((h) => Object.keys(h.flags).length > 0 || h.status === 'hidden')
      .map((h) => this.toReport(h, me));
  }

  async moderateHazard(hid: string, status: HazardStatus) {
    const h = this.db.hazards.find((x) => x.id === hid);
    if (!h) throw new BackendError('Report not found.');
    h.status = status;
    h.statusChangedAt = now();
    if (status === 'active') h.flags = {};
    this.save();
  }

  // ---------------- Notifications ----------------
  async listNotifications() {
    const id = this.db.sessionUserId;
    if (!id) return [];
    return this.db.notifications
      .filter((n) => n.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((n) => strip(n, 'userId') as AppNotification);
  }

  async createNotification(n: { type: AppNotification['type']; title: string; body: string; link?: string }) {
    const rec: Owned<AppNotification> = { id: crypto.randomUUID(), userId: this.uid(), ...n, link: n.link ?? null, read: false, createdAt: now() };
    this.db.notifications.push(rec);
    this.save();
    const out = strip(rec, 'userId') as AppNotification;
    this.notifListeners.forEach((cb) => cb(out));
    return out;
  }

  async markNotificationRead(nid: string) {
    const n = this.db.notifications.find((x) => x.id === nid && x.userId === this.uid());
    if (n) n.read = true;
    this.save();
  }

  async markAllNotificationsRead() {
    const id = this.uid();
    this.db.notifications.forEach((n) => {
      if (n.userId === id) n.read = true;
    });
    this.save();
  }

  subscribeNotifications(cb: (n: AppNotification) => void) {
    this.notifListeners.add(cb);
    return () => this.notifListeners.delete(cb);
  }

  // ---------------- Public token pages ----------------
  async getSharedJourney(token: string): Promise<SharedJourneyView | null> {
    this.db = load(this.key, this.seed);
    const j = this.db.journeys.find((x) => x.shareToken === token && x.shareEnabled);
    if (!j) return null;
    const owner = this.db.profiles.find((p) => p.id === j.userId);
    const ownerFirstName = owner?.fullName.split(' ')[0] ?? 'Someone';
    if (j.status !== 'active') return { ownerFirstName, status: j.status, endedAt: j.endedAt };
    const c = this.db.checkins.find((x) => x.journeyId === j.id);
    return {
      ownerFirstName, status: j.status, origin: j.origin, destination: j.destination,
      route: { coordinates: j.route.coordinates, distanceM: j.route.distanceM, durationS: j.route.durationS },
      startedAt: j.startedAt, expectedArrival: j.expectedArrival, checkinStatus: c?.status ?? null,
      liveLocation: j.shareLiveLocation ? j.lastLocation : null, liveLocationAt: j.shareLiveLocation ? j.lastLocationAt : null,
    };
  }

  async getInvite(token: string): Promise<InviteView | null> {
    this.db = load(this.key, this.seed);
    const c = this.db.contacts.find((x) => x.inviteToken === token);
    if (!c) return null;
    const owner = this.db.profiles.find((p) => p.id === c.userId);
    return { inviterFirstName: owner?.fullName.split(' ')[0] ?? 'Someone', contactName: c.name, status: c.inviteStatus };
  }

  async respondToInvite(token: string, accept: boolean) {
    await delay();
    const c = this.db.contacts.find((x) => x.inviteToken === token);
    if (!c || c.inviteStatus === 'not_invited') return false;
    c.inviteStatus = accept ? 'accepted' : 'declined';
    this.db.notifications.push({
      id: crypto.randomUUID(), userId: c.userId, type: 'invite',
      title: accept ? `${c.name} joined your SafeCircle` : `${c.name} declined your SafeCircle invitation`,
      body: accept ? 'They can now receive journeys you choose to share with them.' : 'You can keep them as a contact or remove them.',
      link: '/circle', read: false, createdAt: now(),
    });
    this.save();
    return true;
  }

  async clearSampleData() {
    const id = this.uid();
    this.db.contacts = this.db.contacts.filter((c) => !(c.userId === id && c.isSample));
    this.db.journeys = this.db.journeys.filter((j) => !(j.userId === id && j.isSample));
    this.db.hazards = this.db.hazards.filter((h) => !h.isSample);
    this.save();
  }
}
