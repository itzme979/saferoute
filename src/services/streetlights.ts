import { haversine, samplePoints } from '@/lib/geo';
import type { CityLightingMetrics, LatLng } from '@/types';

/**
 * Official light-pole locations published by cities, pre-processed into small
 * static tiles by scripts/build-streetlights.mjs. A pole on the map does not
 * guarantee the light is working, only that the city records one there.
 */

interface CityIndex {
  name: string;
  dataset: string;
  page: string;
  refreshed: string | null;
  cellsPerDegree: number;
  unitsPerDegree: number;
  bbox: [number, number, number, number];
  count: number;
  cells: string[];
}

const CITIES = ['toronto'];
const BASE = '/data/streetlights';
export const LIGHT_RADIUS_M = 35;

const indexCache = new Map<string, Promise<CityIndex | null>>();
const cellCache = new Map<string, Promise<LatLng[]>>();

function loadIndex(city: string): Promise<CityIndex | null> {
  let p = indexCache.get(city);
  if (!p) {
    p = fetch(`${BASE}/${city}/index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<CityIndex>) : null))
      .catch(() => null);
    indexCache.set(city, p);
    p.then((v) => { if (!v) indexCache.delete(city); });
  }
  return p;
}

function loadCell(city: string, idx: CityIndex, key: string): Promise<LatLng[]> {
  const id = `${city}/${key}`;
  let p = cellCache.get(id);
  if (!p) {
    const [cx, cy] = key.split('_').map(Number);
    p = fetch(`${BASE}/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Streetlight tile ${id} unavailable`);
        return r.json() as Promise<number[]>;
      })
      .then((flat) => {
        const pts: LatLng[] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          pts.push({ lng: cx / idx.cellsPerDegree + flat[i] / idx.unitsPerDegree, lat: cy / idx.cellsPerDegree + flat[i + 1] / idx.unitsPerDegree });
        }
        return pts;
      });
    cellCache.set(id, p);
    p.catch(() => cellCache.delete(id));
  }
  return p;
}

const insideBox = (p: LatLng, [a, b, c, d]: CityIndex['bbox']) => p.lng >= a && p.lng <= c && p.lat >= b && p.lat <= d;

export function sourceLabel(idx: Pick<CityIndex, 'name' | 'dataset' | 'refreshed'>): string {
  const when = idx.refreshed ? `, updated ${idx.refreshed.slice(0, 10)}` : '';
  return `${idx.name} open data (${idx.dataset}${when})`;
}

/** Pure: lighting metrics for one route given nearby light poles. */
export function measureLighting(coords: [number, number][], poles: LatLng[], source: string): CityLightingMetrics {
  const samples = samplePoints(coords, 20);
  // Bucket poles on a ~50 m grid so each sample only checks its neighbours.
  const G = 0.0005;
  const grid = new Map<string, LatLng[]>();
  for (const p of poles) {
    const k = `${Math.floor(p.lng / G)}_${Math.floor(p.lat / G)}`;
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(p);
  }
  const near = (s: LatLng, onHit?: (p: LatLng) => void) => {
    const gx = Math.floor(s.lng / G);
    const gy = Math.floor(s.lat / G);
    let hit = false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const p of grid.get(`${gx + dx}_${gy + dy}`) ?? []) {
          if (haversine(s, p) <= LIGHT_RADIUS_M) {
            hit = true;
            if (!onHit) return true;
            onHit(p);
          }
        }
      }
    }
    return hit;
  };
  let lit = 0;
  const used = new Set<LatLng>();
  for (const s of samples) if (near(s, (p) => used.add(p))) lit++;
  return { nearLightPct: lit / Math.max(1, samples.length), poles: used.size, source };
}

/**
 * City light-pole lighting for each route, or null for routes that are not
 * entirely inside a city that publishes pole data.
 */
export async function loadCityLighting(routes: [number, number][][]): Promise<(CityLightingMetrics | null)[]> {
  return Promise.all(routes.map(async (coords) => {
    for (const city of CITIES) {
      const idx = await loadIndex(city);
      if (!idx) continue;
      const pts = coords.map(([lng, lat]) => ({ lng, lat }));
      if (!pts.every((p) => insideBox(p, idx.bbox))) continue;
      const keys = new Set<string>();
      const known = new Set(idx.cells);
      const pad = 0.0005;
      // Sample along the line so long straight segments don't skip cells.
      for (const p of samplePoints(coords, 50)) {
        for (const dx of [-pad, 0, pad]) {
          for (const dy of [-pad, 0, pad]) {
            const k = `${Math.floor((p.lng + dx) * idx.cellsPerDegree)}_${Math.floor((p.lat + dy) * idx.cellsPerDegree)}`;
            // Cells missing from the index have no light poles; never request them
            // (the host would answer with the app's HTML page).
            if (known.has(k)) keys.add(k);
          }
        }
      }
      const poles = (await Promise.all([...keys].map((k) => loadCell(city, idx, k)))).flat();
      return measureLighting(coords, poles, sourceLabel(idx));
    }
    return null;
  }));
}
