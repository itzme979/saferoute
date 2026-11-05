import { describe, expect, it } from 'vitest';
import { lineLength } from './geo';
import { nextCue, nextStepIndex, offRouteLimit, pointAt, spokenDistance, splitLine, stepPositions, stepsFromLine, trackAlong, turnInstruction, turnsFromLine, usableFix } from './navigation';
import { orsSteps, osrmSteps, transitSteps } from '@/services/routing';
import type { NavStep, TransitLeg } from '@/types';

// About 1.1 km east, then 1.1 km north.
const corner: [number, number][] = [[-79.4, 43.65], [-79.3863, 43.65], [-79.3863, 43.66]];
const steps: NavStep[] = stepsFromLine(corner, ['Queen St', 'Bay St'], 'Home');

describe('stepsFromLine', () => {
  it('reads a left turn from the shape of the line', () => {
    expect(steps.map((s) => s.instruction)).toEqual(['Start on Queen St', 'Turn left onto Bay St', 'Arrive at Home']);
  });

  it('ignores a small bend but keeps street names lined up', () => {
    const bend: [number, number][] = [[-79.4, 43.65], [-79.39, 43.6502], [-79.38, 43.6502], [-79.38, 43.66], [-79.38, 43.67]];
    expect(stepsFromLine(bend, ['A', 'B', 'C', 'D'], 'Home').map((s) => s.instruction)).toEqual(['Start on A', 'Turn left onto C', 'Arrive at Home']);
  });
});

describe('following the route', () => {
  it('places steps in order', () => {
    const at = stepPositions(corner, steps);
    expect(at[0]).toBe(0);
    expect(at[1]).toBeGreaterThan(1000);
    expect(at[2]).toBeCloseTo(lineLength(corner), 0);
  });

  it('keeps steps in order on an out-and-back route', () => {
    const back: [number, number][] = [[-79.4, 43.65], [-79.39, 43.65], [-79.4, 43.65], [-79.4, 43.66]];
    const at = stepPositions(back, [
      { maneuver: 'depart', instruction: 'a', at: back[0] },
      { maneuver: 'uturn', instruction: 'b', at: back[1] },
      { maneuver: 'right', instruction: 'c', at: back[2] },
      { maneuver: 'arrive', instruction: 'd', at: back[3] },
    ]);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at[2]).toBeGreaterThan(at[1]);
  });

  it('does not jump to the return leg while heading out', () => {
    const back: [number, number][] = [[-79.4, 43.65], [-79.39, 43.65], [-79.4, 43.65]];
    const t = trackAlong({ lat: 43.65, lng: -79.399 }, back, 80);
    expect(t.along).toBeLessThan(200);
  });

  it('measures how far someone has strayed', () => {
    expect(trackAlong({ lat: 43.651, lng: -79.395 }, corner, 300).offRoute).toBeGreaterThan(100);
  });

  it('finds the right spot on a long route when searching from partway along', () => {
    const line: [number, number][] = Array.from({ length: 3000 }, (_, i) => [-79.4 + i * 0.0001, 43.65]);
    const near = { lat: 43.65, lng: -79.4 + 1500 * 0.0001 };
    const whole = trackAlong(near, line, 0);
    const partway = trackAlong(near, line, whole.along - 200);
    expect(partway.along).toBeCloseTo(whole.along, 3);
    expect(partway.offRoute).toBeLessThan(1);
  });

  it('ignores a rough first fix, which could skip directions', () => {
    expect(usableFix(8)).toBe(true);
    expect(usableFix(100)).toBe(true);
    expect(usableFix(900)).toBe(false);
  });

  it('moves to the next step once one is passed, and ends after the last', () => {
    const at = [0, 500, 1000];
    expect(nextStepIndex(at, 0)).toBe(1);
    expect(nextStepIndex(at, 600)).toBe(2);
    expect(nextStepIndex(at, 1000)).toBeNull();
  });

  it('gives points and direction along the line', () => {
    const start = pointAt(corner, 0);
    expect(start.lat).toBeCloseTo(43.65);
    expect(start.heading).toBeCloseTo(90, 0);
    expect(pointAt(corner, 99999).heading).toBeCloseTo(0, 0);
  });

  it('splits a line into joined pieces of equal length', () => {
    const parts = splitLine(corner, 3);
    expect(parts).toHaveLength(3);
    expect(parts[1][0]).toEqual(parts[0][parts[0].length - 1]);
    expect(lineLength(parts[0])).toBeCloseTo(lineLength(parts[2]), 0);
  });
});

describe('spoken directions', () => {
  const turn: NavStep = { maneuver: 'left', instruction: 'Turn left onto Bay St', at: [0, 0] };

  it('rounds distances the way a person says them', () => {
    expect(spokenDistance(43)).toBe('40 metres');
    expect(spokenDistance(312)).toBe('300 metres');
    expect(spokenDistance(1000)).toBe('1 kilometre');
    expect(spokenDistance(2340)).toBe('2.3 kilometres');
  });

  it('says each cue once, in order', () => {
    expect(nextCue(turn, 300, 'walk', null)).toEqual({ cue: 'ahead', text: 'In 300 metres, turn left onto Bay St' });
    expect(nextCue(turn, 280, 'walk', 'ahead')).toBeNull();
    expect(nextCue(turn, 50, 'walk', 'ahead')?.cue).toBe('early');
    expect(nextCue(turn, 40, 'walk', 'early')).toBeNull();
    expect(nextCue(turn, 10, 'walk', 'early')).toEqual({ cue: 'now', text: 'Turn left onto Bay St' });
    expect(nextCue(turn, 5, 'walk', 'now')).toBeNull();
  });

  it('speaks earlier when moving faster', () => {
    expect(nextCue(turn, 70, 'car', 'early')?.cue).toBe('now');
    expect(nextCue(turn, 70, 'walk', 'ahead')).toBeNull();
  });

  it('allows for poor GPS before calling someone off route', () => {
    expect(offRouteLimit('walk', 5)).toBe(40);
    expect(offRouteLimit('walk', 100)).toBe(150);
    expect(offRouteLimit('transit', 5)).toBe(150);
  });
});

describe('directions from each service', () => {
  it('writes OSRM maneuvers as sentences and drops plain renames', () => {
    const at: [number, number] = [-79.4, 43.65];
    expect(osrmSteps([
      { name: 'Front St', maneuver: { type: 'depart', location: at } },
      { name: 'Bay St', maneuver: { type: 'turn', modifier: 'slight right', location: at } },
      { name: 'Bay Street', maneuver: { type: 'new name', modifier: 'straight', location: at } },
      { name: '', maneuver: { type: 'turn', modifier: 'left', location: at } },
      { name: 'Ring Rd', maneuver: { type: 'roundabout', modifier: 'right', exit: 2, location: at } },
      { name: 'Ring Rd', maneuver: { type: 'exit roundabout', location: at } },
      { name: '', maneuver: { type: 'arrive', location: at } },
    ]).map((s) => s.instruction)).toEqual([
      'Start on Front St', 'Bear right onto Bay St', 'Turn left', 'At the roundabout, take the second exit onto Ring Rd', 'Arrive at your destination',
    ]);
  });

  it('uses OpenRouteService wording and finds each step on the line', () => {
    const out = orsSteps(corner, [
      { type: 11, instruction: 'Head east', way_points: [0, 1] },
      { type: 6, instruction: 'Continue straight', way_points: [1, 1] },
      { type: 0, instruction: 'Turn left onto Bay St', way_points: [1, 2] },
    ]);
    expect(out).toEqual([
      { maneuver: 'depart', instruction: 'Head east', at: corner[0] },
      { maneuver: 'left', instruction: 'Turn left onto Bay St', at: corner[1] },
    ]);
  });

  it('finds turns in a transit walking path from its shape', () => {
    const left: [number, number][] = [[-79.4, 43.65], [-79.399, 43.65], [-79.399, 43.651]];
    expect(turnsFromLine(left).map((s) => s.instruction)).toEqual(['Turn left']);
    const right: [number, number][] = [[-79.399, 43.651], [-79.399, 43.65], [-79.4, 43.65]];
    expect(turnsFromLine(right).map((s) => s.instruction)).toEqual(['Turn right']);
  });

  it('ignores small wobbles in a walking path', () => {
    const wobble: [number, number][] = [[-79.4, 43.65], [-79.3995, 43.65002], [-79.399, 43.65], [-79.3985, 43.65002], [-79.398, 43.65]];
    expect(turnsFromLine(wobble)).toEqual([]);
  });

  it('walks through a whole transit trip', () => {
    const base = { startTime: '', endTime: '', durationS: 60 };
    const leg = (over: Partial<TransitLeg> & Pick<TransitLeg, 'kind' | 'label' | 'from' | 'to'>): TransitLeg => ({ ...base, ...over });
    const line: [number, number][] = [[0, 0], [0, 1]];
    expect(transitSteps([
      { leg: leg({ kind: 'walk', label: 'Walk', from: 'Start', to: 'King Station - Northbound Platform' }), line },
      { leg: leg({ kind: 'train', label: 'Subway 1', from: 'King Station - Northbound Platform', to: 'Dupont Station - Northbound Platform', headsign: 'Line 1 (Yonge-University) towards Vaughan' }), line },
      { leg: leg({ kind: 'walk', label: 'Walk', from: 'Dupont Station - Northbound Platform', to: 'Destination' }), line },
    ]).map((s) => s.instruction)).toEqual([
      'Walk to King Station', 'Take Subway 1 toward Vaughan from King Station', 'Get off at Dupont Station', 'Walk to your destination', 'Arrive at your destination',
    ]);
  });

  it('builds a plain instruction without a street', () => {
    expect(turnInstruction('right')).toBe('Turn right');
  });
});
