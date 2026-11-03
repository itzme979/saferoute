import { config } from '@/lib/config';
import { decimate, distanceToLine, haversine, pointSegmentDistance, samplePoints } from '@/lib/geo';
import type { LatLng } from '@/types';

/**
 * Street details from OpenStreetMap via the Overpass API.
 * Everything here is volunteer-mapped data: it can be incomplete or out of
 * date, so callers always report coverage alongside the values.
 */

export interface OsmWay {
  id: number;
  tags: Record<string, string>;
  geometry: LatLng[];
  bbox: [number, number, number, number]; // minLat, minLng, maxLat, maxLng
}

export interface OsmPoint {
  id: number;
  kind: 'crossing' | 'lamp' | 'place';
  lat: number;
  lng: number;
}

export interface OsmContext {
  ways: OsmWay[];
  points: OsmPoint[];
}

const PLACE_AMENITIES = 'cafe|restaurant|fast_food|pharmacy|library|community_centre|bank|post_office|police|hospital|clinic|fuel|bar|pub|cinema|theatre|townhall|marketplace|ice_cream|convenience';

/**
 * Two spatial lookups per route (ways within 18 m, nodes within 40 m), then
 * cheap tag filters on those sets. Exact distances are re-checked locally.
 */
export function buildOverpassQuery(routes: [number, number][][]): string {
  const lookups: string[] = [];
  const outputs: string[] = [];
  routes.forEach((r, i) => {
    const line = decimate(r, 60).map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
    lookups.push(`way(around:18,${line})[highway]->.w${i};`, `node(around:40,${line})->.n${i};`);
    outputs.push(
      `.w${i};`,
      `node.n${i}[highway~"^(crossing|street_lamp)$"];`,
      `node.n${i}[shop];`,
      `node.n${i}[amenity~"^(${PLACE_AMENITIES})$"];`,
    );
  });
  return `[out:json][timeout:30];${lookups.join('')}(${outputs.join('')});out tags geom qt;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export function parseOverpass(elements: OverpassElement[]): OsmContext {
  const ways: OsmWay[] = [];
  const points: OsmPoint[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === 'way' && el.geometry?.length) {
      const geometry = el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }));
      let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
      for (const g of geometry) {
        minLat = Math.min(minLat, g.lat); maxLat = Math.max(maxLat, g.lat);
        minLng = Math.min(minLng, g.lng); maxLng = Math.max(maxLng, g.lng);
      }
      ways.push({ id: el.id, tags, geometry, bbox: [minLat, minLng, maxLat, maxLng] });
    } else if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      const kind = tags.highway === 'crossing' ? 'crossing' : tags.highway === 'street_lamp' ? 'lamp' : 'place';
      points.push({ id: el.id, kind, lat: el.lat, lng: el.lon });
    }
  }
  return { ways, points };
}

/** Public Overpass servers are volunteer-run and can be slow; try a mirror if the first fails. */
const OVERPASS_ENDPOINTS = import.meta.env.VITE_OVERPASS_URL
  ? [config.overpassUrl]
  : [config.overpassUrl, 'https://overpass.private.coffee/api/interpreter'];
const ATTEMPT_TIMEOUT_MS = 40000;

export async function fetchOsmContext(routes: [number, number][][], signal?: AbortSignal): Promise<OsmContext> {
  const body = buildOverpassQuery(routes);
  let lastError: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: body }), signal: ctrl.signal });
      if (!res.ok) throw new Error(`Overpass error ${res.status}`);
      const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      // Overpass reports query timeouts as a 200 with a "remark" and partial data.
      if (data.remark && /timed out|out of memory/i.test(data.remark)) throw new Error(data.remark);
      return parseOverpass(data.elements ?? []);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Street details unavailable');
}

const LIT_YES = new Set(['yes', '24/7', 'automatic', 'limited', 'interval', 'sunset-sunrise', 'dusk-dawn']);
const UNPAVED = new Set(['unpaved', 'gravel', 'fine_gravel', 'dirt', 'earth', 'ground', 'grass', 'sand', 'mud', 'woodchips', 'pebblestone', 'rock']);
const PATH_TYPES = new Set(['path', 'track', 'bridleway', 'cycleway']);
const ROAD_TYPES = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'primary_link', 'secondary_link', 'tertiary_link', 'living_street', 'service']);

export interface OsmRouteMetrics {
  litPct: number;
  unlitPct: number;
  lightingCoveragePct: number;
  stairs: number;
  crossings: number;
  publicPlaces: number;
  isolatedPct: number;
  unpavedPct: number;
  noSidewalkPct: number;
  osmConstruction: number;
  /** Share of sampled points matched to any mapped way. */
  matchPct: number;
}

function nearestWay(p: LatLng, ways: OsmWay[], maxM: number): OsmWay | null {
  const pad = 0.0003;
  let best: OsmWay | null = null;
  let bestD = maxM;
  for (const w of ways) {
    const [a, b, c, d] = w.bbox;
    if (p.lat < a - pad || p.lat > c + pad || p.lng < b - pad || p.lng > d + pad) continue;
    for (let i = 1; i < w.geometry.length; i++) {
      const { d: dist } = pointSegmentDistance(p, w.geometry[i - 1], w.geometry[i]);
      if (dist < bestD) {
        bestD = dist;
        best = w;
      }
    }
  }
  return best;
}

function anyWithin(p: LatLng, pts: OsmPoint[], m: number): boolean {
  for (const q of pts) if (haversine(p, q) <= m) return true;
  return false;
}

/** Derives route-level facts from OSM data by sampling the route every 20 m. */
export function analyzeRouteWithOsm(coords: [number, number][], ctx: OsmContext): OsmRouteMetrics {
  const samples = samplePoints(coords, 20);
  const lamps = ctx.points.filter((p) => p.kind === 'lamp');
  const places = ctx.points.filter((p) => p.kind === 'place');
  const crossings = ctx.points.filter((p) => p.kind === 'crossing');

  let lit = 0, unlit = 0, isolated = 0, unpaved = 0, noSidewalk = 0, matched = 0;
  const stairWays = new Set<number>();
  const constructionWays = new Set<number>();

  for (const s of samples) {
    const w = nearestWay(s, ctx.ways, 20);
    if (w) matched++;
    const tags = w?.tags ?? {};
    const lampNear = anyWithin(s, lamps, 30);
    const isLit = (tags.lit && LIT_YES.has(tags.lit)) || lampNear;
    if (isLit) lit++;
    else if (tags.lit === 'no') unlit++;

    const hw = tags.highway;
    const isPath = !!hw && (PATH_TYPES.has(hw) || (hw === 'footway' && tags.footway !== 'sidewalk' && tags.footway !== 'crossing'));
    if (isPath && !isLit && !anyWithin(s, places, 60)) isolated++;
    if (tags.surface && UNPAVED.has(tags.surface)) unpaved++;
    if (hw && ROAD_TYPES.has(hw) && (['no', 'none'].includes(tags.sidewalk ?? '') || tags['sidewalk:both'] === 'no')) noSidewalk++;
    if (w && hw === 'steps') stairWays.add(w.id);
    if (w && (hw === 'construction' || tags.construction)) constructionWays.add(w.id);
  }

  const n = Math.max(1, samples.length);
  const near = (pts: OsmPoint[], m: number) => new Set(pts.filter((p) => distanceToLine(p, coords) <= m).map((p) => p.id)).size;

  return {
    litPct: lit / n,
    unlitPct: unlit / n,
    lightingCoveragePct: (lit + unlit) / n,
    stairs: stairWays.size,
    crossings: near(crossings, 15),
    publicPlaces: near(places, 40),
    isolatedPct: isolated / n,
    unpavedPct: unpaved / n,
    noSidewalkPct: noSidewalk / n,
    osmConstruction: constructionWays.size,
    matchPct: matched / n,
  };
}
