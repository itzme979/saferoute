import type {
  AppNotification, AuthUser, Checkin, ContactInput, FlagReason, HazardInput, HazardReport, HazardStatus, HazardVote,
  InviteView, Journey, LatLng, NotificationType, Profile, SendResult, SharedJourneyView, StartJourneyInput, TrustedContact,
} from '@/types';

export type ProfilePatch = Partial<Pick<Profile,
  'fullName' | 'phone' | 'avatarUrl' | 'walkingPreferences' | 'notificationPreferences' | 'privacy' | 'emergencyNumber' | 'onboarded'>>;

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'INITIAL';

/**
 * Everything the UI needs from a backend. Two implementations exist:
 *  - SupabaseBackend: production (auth, Postgres with RLS, storage, Edge Functions)
 *  - DemoBackend: clearly-labelled local demo stored in this browser only
 */
export interface Backend {
  readonly mode: 'supabase' | 'demo';

  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null, event: AuthEvent) => void): () => void;
  signUp(input: { fullName: string; email: string; password: string }): Promise<{ needsVerification: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ demoResetLink?: string }>;
  /** Sets a new password for the signed-in (or recovering) user. currentPassword re-verifies identity when provided. */
  updatePassword(newPassword: string, currentPassword?: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  deleteAccount(): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  uploadAvatar(image: Blob): Promise<string>;

  listContacts(): Promise<TrustedContact[]>;
  addContact(input: ContactInput): Promise<TrustedContact>;
  updateContact(id: string, patch: Partial<ContactInput>): Promise<TrustedContact>;
  removeContact(id: string): Promise<void>;
  sendInvite(id: string): Promise<SendResult & { demoInviteLink?: string }>;
  /** Marks the contact as invited and returns their private invitation link. */
  createInviteLink(id: string): Promise<string>;

  listJourneys(): Promise<Journey[]>;
  getActiveJourney(): Promise<{ journey: Journey; checkin: Checkin | null } | null>;
  startJourney(input: StartJourneyInput): Promise<Journey>;
  updateJourneySharing(id: string, patch: { enabled?: boolean; liveLocation?: boolean; contactIds?: string[] }): Promise<Journey>;
  updateJourneyLocation(id: string, location: LatLng | null): Promise<void>;
  endJourney(id: string, status: 'completed' | 'cancelled'): Promise<void>;
  deleteJourney(id: string): Promise<void>;
  clearJourneyHistory(): Promise<void>;
  updateCheckin(id: string, patch: Partial<Pick<Checkin, 'status' | 'expectedArrival' | 'notificationStatus'>>): Promise<Checkin>;
  notifyJourneyShare(journeyId: string, contactIds: string[]): Promise<SendResult>;
  sendSos(input: { contactIds: string[]; location: LatLng | null; note: string; journeyId?: string }): Promise<SendResult>;

  listHazards(): Promise<HazardReport[]>;
  createHazard(input: HazardInput): Promise<HazardReport>;
  voteHazard(id: string, vote: HazardVote): Promise<void>;
  flagHazard(id: string, reason: FlagReason): Promise<void>;
  deleteHazard(id: string): Promise<void>;
  listModerationQueue(): Promise<HazardReport[]>;
  moderateHazard(id: string, status: HazardStatus): Promise<void>;

  listNotifications(): Promise<AppNotification[]>;
  createNotification(n: { type: NotificationType; title: string; body: string; link?: string }): Promise<AppNotification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  subscribeNotifications(cb: (n: AppNotification) => void): () => void;

  getSharedJourney(token: string): Promise<SharedJourneyView | null>;
  getInvite(token: string): Promise<InviteView | null>;
  respondToInvite(token: string, accept: boolean): Promise<boolean>;

  /** Demo only: remove all records marked as sample data. */
  clearSampleData?(): Promise<void>;
  /** /demo area only: sign into the ready-made demo account. */
  enterDemo?(): Promise<void>;
}

export class BackendError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}
