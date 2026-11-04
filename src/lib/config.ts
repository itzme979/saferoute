const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

/** Set while someone is exploring the /demo area. Kept in localStorage so preview links opened in new tabs stay in the demo. */
export const DEMO_SESSION_KEY = 'saferoute-demo-session';

function readDemoSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.pathname === '/demo') localStorage.setItem(DEMO_SESSION_KEY, '1');
    return localStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return window.location.pathname === '/demo';
  }
}

const hasBackend = !!url && !!anonKey;
const isSampleDemo = readDemoSession();

export const config = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  /** A Supabase project is configured for real accounts. */
  hasBackend,
  /** The /demo area: fictional sample contacts, journeys and hazard reports. */
  isSampleDemo,
  /** Data stays in this browser and nothing is sent (the /demo area, or no backend configured). */
  isDemo: isSampleDemo || !hasBackend,
  mapStyleUrl: (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim() || 'https://tiles.openfreemap.org/styles/positron',
  mapStyleDarkUrl: (import.meta.env.VITE_MAP_STYLE_DARK_URL as string | undefined)?.trim() || 'https://tiles.openfreemap.org/styles/dark',
  overpassUrl: (import.meta.env.VITE_OVERPASS_URL as string | undefined)?.trim() || 'https://overpass-api.de/api/interpreter',
  /** Email invitations need the notify function and Resend. Share links always work. */
  emailInvites: isSampleDemo || !hasBackend || (import.meta.env.VITE_EMAIL_ENABLED as string | undefined)?.trim() === 'true',
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || '',
  geocoderUrl: 'https://photon.komoot.io',
  osrmFootUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  osrmBikeUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  osrmCarUrl: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  transitUrl: 'https://api.transitous.org/api/v5/plan',
  /** Default map centre when location is not shared (Toronto). */
  defaultCenter: { lat: 43.6532, lng: -79.3832 },
};

/** Leave the /demo area and return to the real app. */
export function exitDemo() {
  try {
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
  window.location.assign('/');
}
