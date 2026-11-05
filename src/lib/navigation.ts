import { bearing, haversine, lineLength, pointSegmentDistance, toLatLng } from '@/lib/geo';
import type { LatLng, Maneuver, NavStep, TravelMode } from '@/types';

/** How far behind the last known spot a new position may land, in metres. */
const WINDOW_BACK_M = 50;
/** Distance ahead of the last known spot before a closer match starts to cost more. Stops a loop or out-and-back from skipping ahead. */
const WINDOW_AHEAD_M = 300;

/** Where each step falls along the route, in metres from the start. Always increases, so routes that double back stay in order. */
export function stepPositions(coords: [number, number][], steps: NavStep[]): number[] {
  const lengths = segmentLengths(coords);
  const out: number[] = [];
  let last = 0;
  for (const s of steps) {
    last = Math.max(last, trackAlong(toLatLng(s.at), coords, last, lengths).along);
    out.push(last);
  }
  return out;
}

function segmentLengths(coords: [number, number][]): number[] {
  return coords.slice(1).map((c, i) => haversine(toLatLng(coords[i]), toLatLng(c)));
}

/** Finds a position on the route, preferring spots near where it was last seen. Long car routes have thousands of points, so it skips what can't match to stay quick on slow phones. */
export function trackAlong(p: LatLng, coords: [number, number][], last: number, lengths = segmentLengths(coords)): { along: number; offRoute: number } {
  let best = { along: last, offRoute: Infinity, cost: Infinity };
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = lengths[i - 1];
    if (acc + seg < last - WINDOW_BACK_M) {
      acc += seg;
      continue;
    }
    if ((acc - last - WINDOW_AHEAD_M) * 0.1 > best.cost) break;
    const a = toLatLng(coords[i - 1]);
    const b = toLatLng(coords[i]);
    const { d, t } = pointSegmentDistance(p, a, b);
    const along = acc + seg * t;
    acc += seg;
    if (along < last - WINDOW_BACK_M) continue;
    const cost = d + Math.max(0, along - last - WINDOW_AHEAD_M) * 0.1;
    if (cost < best.cost) best = { along, offRoute: d, cost };
  }
  return { along: best.along, offRoute: best.offRoute };
}

/** The first step still ahead. Null once every step has been passed. */
export function nextStepIndex(positions: number[], along: number): number | null {
  const i = positions.findIndex((p, n) => n > 0 && p > along + 3);
  return i === -1 ? null : i;
}

/** The point at a distance along the route, and the direction of travel there. */
export function pointAt(coords: [number, number][], along: number): LatLng & { heading: number } {
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = toLatLng(coords[i - 1]);
    const b = toLatLng(coords[i]);
    const seg = haversine(a, b);
    if (acc + seg >= along || i === coords.length - 1) {
      const t = seg ? Math.min(1, Math.max(0, (along - acc) / seg)) : 0;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b) };
    }
    acc += seg;
  }
  return { ...toLatLng(coords[0]), heading: 0 };
}

/** Evenly spaced cuts of a line. Only used to lay out the fictional sample trips. */
export function splitLine(coords: [number, number][], parts: number): [number, number][][] {
  const total = lineLength(coords);
  const point = (along: number): [number, number] => {
    const p = pointAt(coords, along);
    return [p.lng, p.lat];
  };
  return Array.from({ length: parts }, (_, n) => {
    const from = (total * n) / parts;
    const to = (total * (n + 1)) / parts;
    const inner: [number, number][] = [];
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      acc += haversine(toLatLng(coords[i - 1]), toLatLng(coords[i]));
      if (acc > from && acc < to) inner.push(coords[i]);
    }
    return [point(from), ...inner, point(to)];
  });
}

const TURN_WORDS: Partial<Record<Maneuver, string>> = {
  left: 'Turn left',
  right: 'Turn right',
  'slight-left': 'Bear left',
  'slight-right': 'Bear right',
  'sharp-left': 'Turn sharp left',
  'sharp-right': 'Turn sharp right',
  uturn: 'Make a U-turn',
  straight: 'Continue straight',
};

export function turnInstruction(maneuver: Maneuver, street?: string): string {
  const words = TURN_WORDS[maneuver] ?? 'Continue';
  return street ? `${words} onto ${street}` : words;
}

const turnAngle = (before: number, after: number) => ((after - before + 540) % 360) - 180;

function turnManeuver(angle: number): Maneuver {
  const side = angle < 0 ? 'left' : 'right';
  const size = Math.abs(angle);
  return size < 40 ? `slight-${side}` : size > 130 ? `sharp-${side}` : side;
}

/** How far to look either side of a corner, and the gap to keep from the ends and from the last turn, in metres. */
const CORNER_LOOK_M = 10;
const CORNER_GAP_M = 15;
const CORNER_MIN_DEG = 35;

/** Finds turns in a walking path that comes with no directions, looking a little either side of each corner to ignore GPS-like jitter. */
export function turnsFromLine(line: [number, number][]): NavStep[] {
  const total = lineLength(line);
  const out: NavStep[] = [];
  let along = 0;
  let lastTurn = -Infinity;
  for (let i = 1; i < line.length - 1; i++) {
    along += haversine(toLatLng(line[i - 1]), toLatLng(line[i]));
    if (along < CORNER_GAP_M || total - along < CORNER_GAP_M || along - lastTurn < CORNER_GAP_M) continue;
    const here = toLatLng(line[i]);
    const angle = turnAngle(bearing(pointAt(line, along - CORNER_LOOK_M), here), bearing(here, pointAt(line, along + CORNER_LOOK_M)));
    if (Math.abs(angle) < CORNER_MIN_DEG) continue;
    const maneuver = turnManeuver(angle);
    out.push({ maneuver, instruction: turnInstruction(maneuver), at: line[i] });
    lastTurn = along;
  }
  return out;
}

/** Reads turns from the line itself. Used for the fictional sample routes, which have no routing service behind them. */
export function stepsFromLine(coords: [number, number][], streets: string[], destination: string): NavStep[] {
  const steps: NavStep[] = [{ maneuver: 'depart', instruction: streets[0] ? `Start on ${streets[0]}` : 'Start along the route', at: coords[0] }];
  let street = 1;
  for (let i = 1; i < coords.length - 1; i++) {
    const before = bearing(toLatLng(coords[i - 1]), toLatLng(coords[i]));
    const after = bearing(toLatLng(coords[i]), toLatLng(coords[i + 1]));
    const turn = turnAngle(before, after);
    const name = streets[street++];
    if (Math.abs(turn) < 12) continue;
    const maneuver = turnManeuver(turn);
    steps.push({ maneuver, instruction: turnInstruction(maneuver, name), at: coords[i] });
  }
  steps.push({ maneuver: 'arrive', instruction: `Arrive at ${destination}`, at: coords[coords.length - 1] });
  return steps;
}

/** Distances read aloud: rounded so they sound natural, in metres under a kilometre. */
export function spokenDistance(m: number): string {
  if (m < 90) return `${Math.max(10, Math.round(m / 10) * 10)} metres`;
  if (m < 950) return `${Math.round(m / 50) * 50} metres`;
  if (m < 1050) return '1 kilometre';
  return `${(m / 1000).toFixed(m < 9950 ? 1 : 0)} kilometres`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** How early to speak, in metres, for each way of travelling. */
const CUES: Record<TravelMode, { early: number; now: number }> = {
  walk: { early: 60, now: 15 },
  bike: { early: 120, now: 30 },
  car: { early: 400, now: 80 },
  transit: { early: 60, now: 15 },
};

export type Cue = 'ahead' | 'early' | 'now';

/** Decides what to say next. `said` is the last cue given for this step, so nothing repeats. */
export function nextCue(step: NavStep, distanceM: number, mode: TravelMode, said: Cue | null): { cue: Cue; text: string } | null {
  const c = CUES[mode];
  const later = `In ${spokenDistance(distanceM)}, ${lowerFirst(step.instruction)}`;
  if (distanceM <= c.now) return said === 'now' ? null : { cue: 'now', text: step.instruction };
  if (distanceM <= c.early) return said === 'early' || said === 'now' ? null : { cue: 'early', text: later };
  return said === null ? { cue: 'ahead', text: later } : null;
}

/** Fixes rougher than this are ignored. A phone's first fix can come from cell towers, and following one could skip directions for good, since position only moves forward. */
export const usableFix = (accuracy: number): boolean => accuracy <= 100;

/** How far off the line counts as leaving the route. Transit gets more room, since GPS is poor in stations and vehicles. */
export const offRouteLimit = (mode: TravelMode, accuracy: number): number =>
  Math.max(mode === 'transit' ? 150 : mode === 'car' ? 60 : 40, accuracy * 1.5);
