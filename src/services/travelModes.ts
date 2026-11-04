import type { TravelMode, WalkingPreferences } from '@/types';

export interface TravelModeMeta {
  id: TravelMode;
  label: string;
  /** "3 bike routes", "One transit option found". */
  routeNoun: string;
  /** Straight-line limit for one trip. */
  maxKm: number;
  /** Priorities that make sense for this mode. Null means all of them. */
  prefs: (keyof WalkingPreferences)[] | null;
  /** Comparison criteria used for this mode (see CRITERIA in routeAnalysis). */
  criteria: string[];
  /** Route facts shown for this mode (see routeFactors). Null means all of them. */
  factors: string[] | null;
  checks: { lighting: boolean; crime: boolean; night: boolean; osm: boolean };
  timeLabel: string;
  quickest: string;
  slowest: string;
  /** Shown with the results. */
  note?: string;
  timingNote: string;
}

const WALK_CRITERIA = ['time', 'hazards', 'lighting', 'crime', 'busy', 'isolated', 'construction', 'accessible', 'stairs', 'crossings'];

export const TRAVEL_MODES: TravelModeMeta[] = [
  {
    id: 'walk', label: 'Walk', routeNoun: 'walking route', maxKm: 30, prefs: null, criteria: WALK_CRITERIA, factors: null,
    checks: { lighting: true, crime: true, night: true, osm: true },
    timeLabel: 'Walking time', quickest: 'shortest walk', slowest: 'longest walk',
    timingNote: 'Walking time assumes an average pace and does not include waiting at crossings.',
  },
  {
    id: 'transit', label: 'Transit', routeNoun: 'transit option', maxKm: 300,
    prefs: ['preferLit', 'avoidCrime'],
    criteria: ['time', 'transfers', 'hazards', 'lighting', 'crime'],
    factors: ['lighting', 'crime', 'night', 'hazards'],
    checks: { lighting: true, crime: true, night: true, osm: false },
    timeLabel: 'Trip time', quickest: 'quickest trip', slowest: 'longest trip',
    note: 'Lighting, crime and community reports cover the walking parts of each trip. Times come from published schedules, so check with your transit agency for delays.',
    timingNote: 'Times come from published schedules and may not include delays.',
  },
  {
    id: 'bike', label: 'Bike', routeNoun: 'bike route', maxKm: 100,
    prefs: ['preferLit', 'avoidCrime', 'avoidIsolated', 'avoidConstruction'],
    criteria: ['time', 'hazards', 'lighting', 'crime', 'isolated', 'construction'],
    factors: ['lighting', 'crime', 'night', 'hazards', 'construction'],
    checks: { lighting: true, crime: true, night: true, osm: true },
    timeLabel: 'Riding time', quickest: 'quickest ride', slowest: 'longest ride',
    note: 'Bike routes come from OpenStreetMap and can include roads without bike lanes.',
    timingNote: 'Riding time assumes an average pace and does not include stops.',
  },
  {
    id: 'car', label: 'Car', routeNoun: 'driving route', maxKm: 300,
    prefs: ['avoidConstruction'],
    criteria: ['time', 'hazards', 'construction'],
    factors: ['hazards', 'construction'],
    checks: { lighting: false, crime: false, night: false, osm: false },
    timeLabel: 'Driving time', quickest: 'quickest drive', slowest: 'longest drive',
    note: "Driving times don't include live traffic. Set up your journey before you drive, and don't use SafeRoute behind the wheel.",
    timingNote: 'Driving time does not include live traffic.',
  },
];

export const modeMeta = (mode: TravelMode = 'walk'): TravelModeMeta => TRAVEL_MODES.find((m) => m.id === mode) ?? TRAVEL_MODES[0];

const MODE_KEY = 'saferoute-travel-mode';

/** The last mode used on this device, so regular trips don't start from walking. */
export function loadTravelMode(): TravelMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return TRAVEL_MODES.some((t) => t.id === m) ? (m as TravelMode) : 'walk';
  } catch {
    return 'walk';
  }
}

export function saveTravelMode(mode: TravelMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* Only a convenience: the choice just won't be remembered. */
  }
}
