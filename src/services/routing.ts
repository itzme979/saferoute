import { config } from '@/lib/config';
import { haversine } from '@/lib/geo';
import { getSupabase } from '@/services/supabaseClient';
import type { LatLng } from '@/types';

export interface RawRoute {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  turns: number;
}

export interface RoutingResult {
  routes: RawRoute[];
  provider: string;
  notice?: string;
}

export class RoutingError extends Error {
  constructor(message: string, public code: 'too_far' | 'too_close' | 'no_route' | 'unavailable') {
    super(message);
  }
}

const ORS_TURN_TYPES = new Set([0, 1, 2, 3, 4, 5, 9]);

interface OrsFeature {
  geometry: { coordinates: [number, number][] };
  properties: { summary: { distance?: number; duration?: number }; segments: { steps: { type: number }[] }[] };
}

async function fromOpenRouteService(o: LatLng, d: LatLng): Promise<RoutingResult> {
  const sb = getSupabase();
  if (!sb) throw new Error('not_configured');
  const { data, error } = await sb.functions.invoke('routes', { body: { origin: o, destination: d } });
  if (error || !data?.features) throw new Error('ors_failed');
  const features = data.features as OrsFeature[];
  return {
    provider: 'OpenRouteService',
    routes: features.map((f) => ({
      coordinates: f.geometry.coordinates.map(([lng, lat]) => [lng, lat] as [number, number]),
      distanceM: f.properties.summary.distance ?? 0,
      durationS: f.properties.summary.duration ?? 0,
      turns: f.properties.segments.flatMap((s) => s.steps).filter((s) => ORS_TURN_TYPES.has(s.type)).length,
    })),
  };
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: { maneuver: { type: string; modifier?: string } }[] }[];
}

async function fromOsrm(o: LatLng, d: LatLng): Promise<RoutingResult> {
  const url = `${config.osrmFootUrl}/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('osrm_failed');
  const data = (await res.json()) as { code: string; routes?: OsrmRoute[] };
  if (data.code === 'NoRoute') throw new RoutingError('No walking route could be found between these places.', 'no_route');
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('osrm_failed');
  return {
    provider: 'OSRM (FOSSGIS public server)',
    routes: data.routes.slice(0, 3).map((r) => ({
      coordinates: r.geometry.coordinates,
      distanceM: r.distance,
      durationS: r.duration,
      turns: r.legs.flatMap((l) => l.steps).filter((s) =>
        ['turn', 'end of road', 'fork'].includes(s.maneuver.type) && s.maneuver.modifier !== 'straight').length,
    })),
  };
}

/**
 * Requests real walking routes. Uses OpenRouteService (via the `routes`
 * Edge Function, key kept server-side) when the backend is configured, and
 * falls back to the public FOSSGIS OSRM foot-routing server otherwise.
 */
export async function getWalkingRoutes(o: LatLng, d: LatLng): Promise<RoutingResult> {
  const km = haversine(o, d) / 1000;
  if (km > 30) throw new RoutingError('These places are more than 30 km apart. SafeRoute plans walking journeys only.', 'too_far');
  if (km < 0.03) throw new RoutingError('Your start and destination are the same place.', 'too_close');

  let notice: string | undefined;
  if (!config.isDemo) {
    try {
      return await fromOpenRouteService(o, d);
    } catch {
      notice = 'Our primary routing service was unavailable, so these routes come from a backup service.';
    }
  }
  try {
    const r = await fromOsrm(o, d);
    return { ...r, notice };
  } catch (e) {
    if (e instanceof RoutingError) throw e;
    throw new RoutingError('Walking routes could not be loaded. Check your connection and try again.', 'unavailable');
  }
}
