import { describe, expect, it } from 'vitest';
import { DEFAULT_WALKING_PREFS } from './defaults';
import { buildMetrics, compareRoutes, hazardsOnRoute, mergeCityLighting, mergeCrime, routeHazards } from './routeAnalysis';
import type { HazardReport, RouteCrimeMetrics, WalkingPreferences, WalkingRoute } from '@/types';

const noPrefs: WalkingPreferences = { preferLit: false, preferBusy: false, avoidIsolated: false, avoidConstruction: false, preferAccessible: false, avoidStairs: false, fewerCrossings: false, avoidCrime: false };

const crime = (personal: number, total = personal): RouteCrimeMetrics => ({
  total, byGroup: { personal, property: total - personal, vehicle: 0, other: 0 }, topCategories: [], bufferM: 75, periodLabel: 'test', source: 'test', truncated: false,
});

function route(id: string, durationS: number, m: Partial<WalkingRoute['metrics']> = {}): WalkingRoute {
  return {
    id, name: id, coordinates: [[0, 0], [0, 0.01]], distanceM: durationS * 1.3, durationS, turns: 2, provider: 'test', enrichment: 'available',
    metrics: { litPct: null, unlitPct: null, lightingCoveragePct: null, stairs: null, crossings: null, publicPlaces: null, isolatedPct: null, unpavedPct: null, noSidewalkPct: null, osmConstruction: null, hazards: [], ...m },
  };
}

describe('travel modes', () => {
  const lit = { ...DEFAULT_WALKING_PREFS, preferLit: true };

  it('compares drives on time, ignoring lighting and sidewalks', () => {
    const slowLit = { ...route('slow', 900, { litPct: 0.9, stairs: 0 }), mode: 'car' as const };
    const fast = { ...route('fast', 600, { litPct: 0.1, stairs: 9 }), mode: 'car' as const };
    const c = compareRoutes([slowLit, fast], lit);
    expect(c.assessments.fast.rank).toBe(1);
    expect(c.considered.map((x) => x.label)).toContain('Driving time');
    expect(c.considered.map((x) => x.key)).not.toContain('lighting');
    expect(c.skipped.map((x) => x.key)).not.toContain('stairs');
    expect(c.assessments.fast.strengths.join()).toContain('quickest drive');
  });

  it('ignores stairs and crossings for bikes but keeps lighting', () => {
    const a = { ...route('a', 600, { litPct: 0.9, stairs: 5, crossings: 9 }), mode: 'bike' as const };
    const b = { ...route('b', 600, { litPct: 0.2, stairs: 0, crossings: 1 }), mode: 'bike' as const };
    const c = compareRoutes([a, b], { ...lit, avoidStairs: true, fewerCrossings: true });
    expect(c.considered.map((x) => x.key)).toContain('lighting');
    expect(c.considered.map((x) => x.key)).not.toContain('stairs');
    expect(c.assessments.a.rank).toBe(1);
  });

  it('counts transfers for transit', () => {
    const direct = { ...route('direct', 1800), mode: 'transit' as const, transfers: 0 };
    const change = { ...route('change', 1800), mode: 'transit' as const, transfers: 2 };
    const c = compareRoutes([change, direct], lit);
    expect(c.assessments.direct.rank).toBe(1);
    expect(c.assessments.direct.strengths.join()).toContain('no transfers');
  });

  it('keeps treating saved routes with no mode as walking', () => {
    const c = compareRoutes([route('a', 600), route('b', 900)], noPrefs);
    expect(c.considered.map((x) => x.label)).toContain('Walking time');
  });

  const hazard = (id: string, category: HazardReport['category'], lat: number): HazardReport => ({ id, category, description: 'x', lat, lng: 0, photoUrl: null, status: 'active', createdAt: '', statusChangedAt: null, isOwn: false, resolvedVotes: 0, stillThereVotes: 0, myVote: null });

  it('checks only the walking parts of a transit trip', () => {
    const r = { mode: 'transit' as const, coordinates: [[0, 0], [0, 0.1]] as [number, number][], walkSegments: [[[0, 0], [0, 0.001]]] as [number, number][][] };
    const onWalk = hazard('walk', 'sidewalk', 0.0005);
    const onRide = hazard('ride', 'sidewalk', 0.05);
    expect(routeHazards(r, [onWalk, onRide]).map((h) => h.id)).toEqual(['walk']);
  });

  it('skips pedestrian-only reports for drivers', () => {
    const r = { mode: 'car' as const, coordinates: [[0, 0], [0, 0.01]] as [number, number][] };
    const list = routeHazards(r, [hazard('curb', 'accessibility', 0.005), hazard('works', 'construction', 0.005)]);
    expect(list.map((h) => h.id)).toEqual(['works']);
  });

  it('weights lighting by the length of each walking stretch', () => {
    const merged = mergeCityLighting([{ nearLightPct: 1, poles: 3, source: 's' }, { nearLightPct: 0, poles: 0, source: 's' }], [300, 100]);
    expect(merged?.nearLightPct).toBeCloseTo(0.75);
    expect(merged?.poles).toBe(3);
  });

  it('leaves lighting unknown when any walking stretch has no data', () => {
    expect(mergeCityLighting([{ nearLightPct: 1, poles: 3, source: 's' }, null], [300, 100])).toBeNull();
    expect(mergeCityLighting([], [])).toBeNull();
  });

  it('adds crime counts across walking stretches', () => {
    const merged = mergeCrime([crime(2, 3), crime(1, 1)]);
    expect(merged?.byGroup.personal).toBe(3);
    expect(merged?.total).toBe(4);
    expect(mergeCrime([crime(2), null])).toBeNull();
  });
});

describe('compareRoutes', () => {
  it('ranks by walking time when no priorities are selected', () => {
    const c = compareRoutes([route('slow', 900), route('fast', 600)], noPrefs);
    expect(c.assessments.fast.rank).toBe(1);
    expect(c.assessments.slow.rank).toBe(2);
  });

  it('lets a strong preference outweigh a small time difference', () => {
    const lit = route('lit', 660, { litPct: 0.9 });
    const dark = route('dark', 600, { litPct: 0.1 });
    const c = compareRoutes([lit, dark], { ...noPrefs, preferLit: true });
    expect(c.assessments.lit.rank).toBe(1);
    expect(c.assessments.lit.strengths.join(' ')).toMatch(/lighting/);
  });

  it('skips criteria that lack data for any route instead of guessing', () => {
    const c = compareRoutes([route('a', 600, { litPct: 0.8 }), route('b', 700)], { ...noPrefs, preferLit: true });
    expect(c.skipped.map((s) => s.key)).toContain('lighting');
    expect(c.considered.map((s) => s.key)).not.toContain('lighting');
    expect(c.assessments.a.rank).toBe(1);
  });

  it('counts community reports against a route', () => {
    const c = compareRoutes([route('a', 600, { hazards: [{ id: 'h', category: 'sidewalk' }] }), route('b', 610)], noPrefs);
    expect(c.assessments.b.strengths.join(' ')).toMatch(/report/);
  });

  it('prefers the route with fewer reported crimes against people when asked', () => {
    const busy = route('busy', 600, { crime: crime(12, 30) });
    const quiet = route('quiet', 650, { crime: crime(2, 40) });
    const c = compareRoutes([busy, quiet], { ...noPrefs, avoidCrime: true });
    expect(c.assessments.quiet.rank).toBe(1);
    expect(c.assessments.quiet.strengths.join(' ')).toMatch(/crimes against people/);
  });

  it('ignores crime when the priority is off', () => {
    const c = compareRoutes([route('busy', 600, { crime: crime(12) }), route('quiet', 650, { crime: crime(2) })], noPrefs);
    expect(c.assessments.busy.rank).toBe(1);
  });

  it('skips crime when a route has no crime data (unknown is not zero)', () => {
    const c = compareRoutes([route('a', 600, { crime: crime(5) }), route('b', 650, { crime: null })], { ...noPrefs, avoidCrime: true });
    expect(c.skipped.map((s) => s.key)).toContain('crime');
  });

  it('uses official city light-pole data over OpenStreetMap lighting', () => {
    const city = (nearLightPct: number) => ({ nearLightPct, poles: 10, source: 'city' });
    // OSM says A is better lit, but the city's pole data says B is.
    const a = route('a', 600, { litPct: 0.9, cityLighting: city(0.3) });
    const b = route('b', 610, { litPct: 0.2, cityLighting: city(0.95) });
    const c = compareRoutes([a, b], { ...noPrefs, preferLit: true });
    expect(c.assessments.b.rank).toBe(1);
  });

  it('works with a single route', () => {
    const c = compareRoutes([route('only', 600)], DEFAULT_WALKING_PREFS);
    expect(c.assessments.only.rank).toBe(1);
  });
});

describe('hazardsOnRoute', () => {
  const base: Omit<HazardReport, 'id' | 'lat' | 'lng' | 'status'> = {
    category: 'lighting', description: 'x', photoUrl: null, createdAt: '', statusChangedAt: null, isOwn: false, resolvedVotes: 0, stillThereVotes: 0, myVote: null,
  };
  it('includes only active reports within 30 m', () => {
    const coords: [number, number][] = [[-79.38, 43.65], [-79.38, 43.66]];
    const hz: HazardReport[] = [
      { ...base, id: 'near', lat: 43.655, lng: -79.3801, status: 'active' },
      { ...base, id: 'far', lat: 43.655, lng: -79.375, status: 'active' },
      { ...base, id: 'resolved', lat: 43.655, lng: -79.38, status: 'resolved' },
    ];
    expect(hazardsOnRoute(coords, hz).map((h) => h.id)).toEqual(['near']);
  });
});

describe('buildMetrics', () => {
  it('reports unknown when OSM data barely matches the route', () => {
    const m = buildMetrics({ litPct: 0.9, unlitPct: 0, lightingCoveragePct: 0.9, stairs: 0, crossings: 1, publicPlaces: 2, isolatedPct: 0, unpavedPct: 0, noSidewalkPct: 0, osmConstruction: 0, matchPct: 0.1 }, []);
    expect(m.litPct).toBeNull();
    expect(m.stairs).toBeNull();
  });

  it('reports lighting as unknown (not zero) when no lighting is mapped', () => {
    const m = buildMetrics({ litPct: 0, unlitPct: 0, lightingCoveragePct: 0, stairs: 1, crossings: 3, publicPlaces: 0, isolatedPct: 0, unpavedPct: 0, noSidewalkPct: 0, osmConstruction: 0, matchPct: 0.9 }, []);
    expect(m.litPct).toBeNull();
    expect(m.stairs).toBe(1);
  });
});
