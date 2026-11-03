import type { NotificationPreferences, PrivacySettings, WalkingPreferences } from '@/types';

export const DEFAULT_WALKING_PREFS: WalkingPreferences = {
  preferLit: true,
  preferBusy: false,
  avoidIsolated: true,
  avoidConstruction: true,
  preferAccessible: false,
  avoidStairs: false,
  fewerCrossings: false,
  avoidCrime: true,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  browser: false,
  inApp: true,
  checkinReminderMinutes: 5,
  missedCheckinGraceMinutes: 15,
  notifyContactsOnMissedCheckin: true,
  hazardUpdates: true,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  saveJourneyHistory: true,
  defaultShareLiveLocation: false,
};

export const WALKING_PREF_META: { key: keyof WalkingPreferences; label: string; hint: string }[] = [
  { key: 'preferLit', label: 'Prefer well-lit streets', hint: 'Uses official city light-pole data where available (e.g. Toronto), otherwise lighting mapped in OpenStreetMap.' },
  { key: 'avoidCrime', label: 'Avoid reported crime', hint: 'Counts police-reported assaults, robberies and similar incidents near each route (Toronto, Ottawa, Montréal and the UK).' },
  { key: 'preferBusy', label: 'Prefer busier streets', hint: 'Uses shops and public places as a guide. Live pedestrian counts are not available.' },
  { key: 'avoidIsolated', label: 'Avoid isolated pathways', hint: 'Avoids footpaths and trails with no mapped lighting or nearby places.' },
  { key: 'avoidConstruction', label: 'Avoid construction areas', hint: 'Uses community reports and mapped construction.' },
  { key: 'preferAccessible', label: 'Prefer accessible sidewalks', hint: 'Avoids unpaved surfaces, roads without sidewalks and reported barriers.' },
  { key: 'avoidStairs', label: 'Avoid stairs', hint: 'Avoids paths mapped as steps.' },
  { key: 'fewerCrossings', label: 'Fewer road crossings', hint: 'Counts pedestrian crossings mapped along the route.' },
];
