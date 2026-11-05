export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  label: string;
}

export interface WalkingPreferences {
  preferLit: boolean;
  preferBusy: boolean;
  avoidIsolated: boolean;
  avoidConstruction: boolean;
  preferAccessible: boolean;
  avoidStairs: boolean;
  fewerCrossings: boolean;
  avoidCrime: boolean;
}

export interface NotificationPreferences {
  browser: boolean;
  inApp: boolean;
  checkinReminderMinutes: number;
  missedCheckinGraceMinutes: number;
  notifyContactsOnMissedCheckin: boolean;
  hazardUpdates: boolean;
}

export interface PrivacySettings {
  saveJourneyHistory: boolean;
  defaultShareLiveLocation: boolean;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  walkingPreferences: WalkingPreferences;
  notificationPreferences: NotificationPreferences;
  privacy: PrivacySettings;
  emergencyNumber: string;
  onboarded: boolean;
  isModerator: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export type InviteStatus = 'not_invited' | 'pending' | 'accepted' | 'declined';

export interface TrustedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  inviteStatus: InviteStatus;
  invitedAt: string | null;
  canReceiveJourneys: boolean;
  canReceiveCheckinAlerts: boolean;
  canReceiveSos: boolean;
  createdAt: string;
  isSample?: boolean;
}

export type ContactInput = Pick<TrustedContact, 'name' | 'email' | 'phone' | 'relationship'> &
  Partial<Pick<TrustedContact, 'canReceiveJourneys' | 'canReceiveCheckinAlerts' | 'canReceiveSos'>>;

/** Fact derived from a data source, or explicitly unknown. */
export type DataState = 'available' | 'partial' | 'unavailable';

export interface RouteMetrics {
  /** Share of route length where OSM reports lighting (lit=yes or street lamp nearby). Null if no data. */
  litPct: number | null;
  /** Share of route length mapped as unlit (lit=no). */
  unlitPct: number | null;
  /** Share of route length where lighting was recorded at all. */
  lightingCoveragePct: number | null;
  stairs: number | null;
  crossings: number | null;
  publicPlaces: number | null;
  /** Share of route on paths/tracks with no recorded lighting and no public places nearby. */
  isolatedPct: number | null;
  unpavedPct: number | null;
  noSidewalkPct: number | null;
  osmConstruction: number | null;
  hazards: { id: string; category: HazardCategory; isSample?: boolean }[];
  /** Official city light-pole data (e.g. City of Toronto). Undefined/null when no city dataset covers the route. */
  cityLighting?: CityLightingMetrics | null;
  /** Police-reported incidents near the route. Null when no police open data covers the area. */
  crime?: RouteCrimeMetrics | null;
  /** Satellite night-time brightness (NASA VIIRS, ~500 m pixels). Context only, never used for ranking. */
  nightBrightness?: NightBrightnessMetrics | null;
}

export interface CityLightingMetrics {
  /** Share of the route within 35 m of a mapped light pole. */
  nearLightPct: number;
  /** Light poles within 35 m of the route. */
  poles: number;
  source: string;
}

export type CrimeGroup = 'personal' | 'property' | 'vehicle' | 'other';

export interface RouteCrimeMetrics {
  /** Incidents within the route buffer during the source's period. */
  total: number;
  byGroup: Record<CrimeGroup, number>;
  /** Top categories as reported by the source, most frequent first. */
  topCategories: { label: string; count: number }[];
  bufferM: number;
  periodLabel: string;
  source: string;
  /** Some police services publish no data for certain crime types (e.g. Montréal has no assault data). */
  caveat?: string;
  truncated: boolean;
}

export interface NightBrightnessMetrics {
  brightPct: number;
  dimPct: number;
  darkPct: number;
  /** Share of sampled points with satellite data. */
  coveragePct: number;
  dates: string[];
}

export type TravelMode = 'walk' | 'transit' | 'bike' | 'car';

/** One step of a public transit trip. */
export type Maneuver = 'depart' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'uturn' | 'roundabout' | 'board' | 'alight' | 'arrive';

/** One spoken and on-screen direction. */
export interface NavStep {
  maneuver: Maneuver;
  instruction: string;
  /** [lng, lat] of the point where this direction applies. */
  at: [number, number];
}

export interface TransitLeg {
  kind: 'walk' | 'bus' | 'train' | 'other';
  /** "Walk", "Bus 7", "Subway 1". */
  label: string;
  from: string;
  to: string;
  startTime: string;
  endTime: string;
  durationS: number;
  headsign?: string;
  agency?: string;
}

export interface WalkingRoute {
  /** Absent on routes saved before other modes existed: those are walking routes. */
  mode?: TravelMode;
  /** Transit only: the steps of the trip. */
  legs?: TransitLeg[];
  /** Directions. Absent on routes saved before directions existed. */
  steps?: NavStep[];
  /** Transit only: the walking stretches, each kept separate because the rides between them aren't walked. */
  walkSegments?: [number, number][][];
  transfers?: number;
  /** Transit only: scheduled arrival, since the first departure can be later than now. */
  arrivesAt?: string;
  id: string;
  name: string;
  coordinates: [number, number][]; // [lng, lat]
  distanceM: number;
  durationS: number;
  turns: number;
  provider: string;
  metrics: RouteMetrics;
  enrichment: DataState;
  isSample?: boolean;
}

export type JourneyStatus = 'active' | 'completed' | 'cancelled';

export interface RouteSnapshot {
  mode?: TravelMode;
  legs?: TransitLeg[];
  steps?: NavStep[];
  name: string;
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  turns: number;
  provider: string;
  summary: string[];
}

export interface Journey {
  id: string;
  origin: Place;
  destination: Place;
  route: RouteSnapshot;
  status: JourneyStatus;
  startedAt: string;
  expectedArrival: string;
  endedAt: string | null;
  shareEnabled: boolean;
  shareLiveLocation: boolean;
  sharedContactIds: string[];
  shareToken: string | null;
  lastLocation: LatLng | null;
  lastLocationAt: string | null;
  isSample?: boolean;
}

export type CheckinStatus = 'scheduled' | 'reminded' | 'confirmed' | 'missed' | 'cancelled';
export type CheckinNotificationStatus = 'none' | 'user_reminded' | 'contacts_notified' | 'contacts_notify_failed' | 'not_configured';

export interface Checkin {
  id: string;
  journeyId: string;
  expectedArrival: string;
  graceMinutes: number;
  notifyContacts: boolean;
  contactIds: string[];
  status: CheckinStatus;
  notificationStatus: CheckinNotificationStatus;
  confirmedAt: string | null;
}

export interface StartJourneyInput {
  origin: Place;
  destination: Place;
  route: RouteSnapshot;
  expectedArrival: string;
  share: { enabled: boolean; liveLocation: boolean; contactIds: string[] };
  checkin: { enabled: boolean; notifyContacts: boolean; contactIds: string[]; graceMinutes: number };
}

export type HazardCategory = 'lighting' | 'construction' | 'sidewalk' | 'accessibility' | 'intersection' | 'obstacle' | 'other';
export type HazardStatus = 'active' | 'resolved' | 'outdated' | 'hidden';
export type HazardVote = 'resolved' | 'outdated' | 'still_there';
export type FlagReason = 'spam' | 'inaccurate' | 'personal_info' | 'offensive' | 'other';

export interface HazardReport {
  id: string;
  category: HazardCategory;
  description: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  status: HazardStatus;
  createdAt: string;
  statusChangedAt: string | null;
  isOwn: boolean;
  resolvedVotes: number;
  stillThereVotes: number;
  myVote: HazardVote | null;
  flagCount?: number;
  isSample?: boolean;
}

export interface HazardInput {
  category: HazardCategory;
  description: string;
  lat: number;
  lng: number;
  photo: Blob | null;
}

export type NotificationType = 'journey' | 'checkin' | 'share' | 'invite' | 'hazard' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  /** True when no message left the device (demo mode / not configured). */
  simulated: boolean;
  message?: string;
}

export interface SharedJourneyView {
  ownerFirstName: string;
  status: JourneyStatus;
  endedAt?: string | null;
  origin?: Place;
  destination?: Place;
  route?: { coordinates: [number, number][]; distanceM: number; durationS: number };
  startedAt?: string;
  expectedArrival?: string;
  checkinStatus?: CheckinStatus | null;
  liveLocation?: LatLng | null;
  liveLocationAt?: string | null;
}

export interface InviteView {
  inviterFirstName: string;
  contactName: string;
  status: InviteStatus;
}
