import type { LatLng } from '@/types';

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const toLatLng = ([lng, lat]: [number, number]): LatLng => ({ lat, lng });

export function lineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(toLatLng(coords[i - 1]), toLatLng(coords[i]));
  return total;
}

/** Local planar projection (metres) around a reference latitude; accurate at street scale. */
function project(p: LatLng, refLat: number): [number, number] {
  const k = Math.cos(toRad(refLat));
  return [toRad(p.lng) * R * k, toRad(p.lat) * R];
}

/** Distance from point p to segment ab, in metres, plus the fractional position t along ab. */
export function pointSegmentDistance(p: LatLng, a: LatLng, b: LatLng): { d: number; t: number } {
  const [px, py] = project(p, p.lat);
  const [ax, ay] = project(a, p.lat);
  const [bx, by] = project(b, p.lat);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { d: Math.hypot(px - cx, py - cy), t };
}

/** Minimum distance (m) from a point to a polyline of [lng, lat] pairs. */
export function distanceToLine(p: LatLng, coords: [number, number][]): number {
  if (coords.length === 1) return haversine(p, toLatLng(coords[0]));
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const { d } = pointSegmentDistance(p, toLatLng(coords[i - 1]), toLatLng(coords[i]));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Projects a point onto a route and returns how far along it is (m) and the
 * remaining distance (m). Used for progress on the active journey screen.
 */
export function progressAlong(p: LatLng, coords: [number, number][]): { along: number; remaining: number; offRoute: number } {
  const total = lineLength(coords);
  let bestD = Infinity;
  let bestAlong = 0;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = toLatLng(coords[i - 1]);
    const b = toLatLng(coords[i]);
    const seg = haversine(a, b);
    const { d, t } = pointSegmentDistance(p, a, b);
    if (d < bestD) {
      bestD = d;
      bestAlong = acc + seg * t;
    }
    acc += seg;
  }
  return { along: bestAlong, remaining: Math.max(0, total - bestAlong), offRoute: bestD };
}

/** Points every `step` metres along a polyline (includes endpoints). */
export function samplePoints(coords: [number, number][], step: number): LatLng[] {
  if (coords.length === 0) return [];
  const out: LatLng[] = [toLatLng(coords[0])];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = toLatLng(coords[i - 1]);
    const b = toLatLng(coords[i]);
    const seg = haversine(a, b);
    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
      pos += step;
    }
    carry = seg - (pos - step);
  }
  const last = toLatLng(coords[coords.length - 1]);
  const prev = out[out.length - 1];
  if (haversine(prev, last) > 1) out.push(last);
  return out;
}

/** Reduces a polyline to at most `max` points by uniform striding (keeps endpoints). */
export function decimate(coords: [number, number][], max: number): [number, number][] {
  if (coords.length <= max) return coords;
  const stride = (coords.length - 1) / (max - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.round(i * stride)]);
  return out;
}

export function bounds(coords: [number, number][]): [[number, number], [number, number]] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

/** Rounds coordinates to reduce precision (4 decimals is roughly 11 m). */
export function approximate(p: LatLng, decimals = 4): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}
