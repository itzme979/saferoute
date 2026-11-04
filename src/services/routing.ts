import { config } from '@/lib/config';
import { decodePolyline, haversine, lineLength } from '@/lib/geo';
import { getSupabase } from '@/services/supabaseClient';
import { modeMeta } from '@/services/travelModes';
import type { LatLng, TransitLeg, TravelMode } from '@/types';

export interface RawRoute {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  turns: number;
  legs?: TransitLeg[];
  walkSegments?: [number, number][][];
  transfers?: number;
  arrivesAt?: string;
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

const OSRM_URLS: Partial<Record<TravelMode, string>> = { walk: config.osrmFootUrl, bike: config.osrmBikeUrl, car: config.osrmCarUrl };

async function fromOsrm(mode: TravelMode, o: LatLng, d: LatLng): Promise<RoutingResult> {
  const url = `${OSRM_URLS[mode]}/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('osrm_failed');
  const data = (await res.json()) as { code: string; routes?: OsrmRoute[] };
  if (data.code === 'NoRoute') throw new RoutingError(`No ${modeMeta(mode).routeNoun} could be found between these places.`, 'no_route');
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

interface MotisLeg {
  mode: string;
  from: { name: string };
  to: { name: string };
  startTime: string;
  endTime: string;
  duration: number;
  routeShortName?: string;
  headsign?: string;
  agencyName?: string;
  legGeometry?: { points: string; precision: number };
}

interface MotisItinerary {
  duration: number;
  endTime: string;
  transfers: number;
  legs: MotisLeg[];
}

const TRAIN_MODES = new Set(['SUBWAY', 'METRO', 'RAIL', 'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'SUBURBAN', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'TRAM', 'FUNICULAR']);
const MODE_NAMES: Record<string, string> = {
  BUS: 'Bus', COACH: 'Coach', SUBWAY: 'Subway', METRO: 'Subway', TRAM: 'Streetcar', FERRY: 'Ferry', FUNICULAR: 'Funicular', AERIAL_LIFT: 'Gondola',
};

function toLeg(l: MotisLeg): TransitLeg {
  const walk = l.mode === 'WALK';
  const kind = walk ? 'walk' : l.mode === 'BUS' || l.mode === 'COACH' ? 'bus' : TRAIN_MODES.has(l.mode) ? 'train' : 'other';
  const name = MODE_NAMES[l.mode] ?? (kind === 'train' ? 'Train' : 'Transit');
  return {
    kind,
    label: walk ? 'Walk' : [name, l.routeShortName].filter(Boolean).join(' '),
    from: l.from.name === 'START' ? 'Start' : l.from.name,
    to: l.to.name === 'END' ? 'Destination' : l.to.name,
    startTime: l.startTime,
    endTime: l.endTime,
    durationS: l.duration,
    headsign: l.headsign,
    agency: l.agencyName,
  };
}

async function fromTransitous(o: LatLng, d: LatLng): Promise<RoutingResult> {
  const url = `${config.transitUrl}?fromPlace=${o.lat},${o.lng}&toPlace=${d.lat},${d.lng}&numItineraries=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('transit_failed');
  const data = (await res.json()) as { itineraries?: MotisItinerary[] };
  const trips = (data.itineraries ?? []).slice(0, 3);
  if (!trips.length) throw new RoutingError('No transit trip was found for this journey right now. Service may have ended for the day, or this area may not be covered yet.', 'no_route');
  return {
    provider: 'Transitous',
    routes: trips.map((t) => {
      const lines = t.legs.map((l) => (l.legGeometry ? decodePolyline(l.legGeometry.points, l.legGeometry.precision) : []));
      const coordinates = lines.flat();
      return {
        coordinates,
        distanceM: lineLength(coordinates),
        durationS: t.duration,
        turns: 0,
        legs: t.legs.map(toLeg),
        walkSegments: lines.filter((line, i) => t.legs[i].mode === 'WALK' && line.length > 1),
        transfers: t.transfers,
        arrivesAt: t.endTime,
      };
    }),
  };
}

/**
 * Requests real routes for a travel mode. Walking uses OpenRouteService (via
 * the `routes` Edge Function, key kept server-side) when the backend is
 * configured, with the public FOSSGIS OSRM server as a backup. Bike and car
 * use FOSSGIS OSRM, and public transit uses Transitous.
 */
export async function getRoutes(mode: TravelMode, o: LatLng, d: LatLng): Promise<RoutingResult> {
  const meta = modeMeta(mode);
  const km = haversine(o, d) / 1000;
  if (km > meta.maxKm) throw new RoutingError(`These places are more than ${meta.maxKm} km apart, which is too far for a ${meta.routeNoun}.`, 'too_far');
  if (km < 0.03) throw new RoutingError('Your start and destination are the same place.', 'too_close');

  const unavailable = `${meta.label} routes could not be loaded. Check your connection and try again.`;
  if (mode === 'transit') {
    try {
      return await fromTransitous(o, d);
    } catch (e) {
      if (e instanceof RoutingError) throw e;
      throw new RoutingError(unavailable, 'unavailable');
    }
  }

  let notice: string | undefined;
  if (mode === 'walk' && !config.isDemo) {
    try {
      return await fromOpenRouteService(o, d);
    } catch {
      notice = 'Our primary routing service was unavailable, so these routes come from a backup service.';
    }
  }
  try {
    const r = await fromOsrm(mode, o, d);
    return { ...r, notice };
  } catch (e) {
    if (e instanceof RoutingError) throw e;
    throw new RoutingError(unavailable, 'unavailable');
  }
}
