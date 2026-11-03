import { describe, expect, it } from 'vitest';
import { analyzeRouteWithOsm, buildOverpassQuery, parseOverpass } from './osmEnrichment';

const route: [number, number][] = [[-79.38, 43.65], [-79.38, 43.652], [-79.378, 43.652]];

describe('osmEnrichment', () => {
  it('builds an Overpass query with lat,lon ordering', () => {
    const q = buildOverpassQuery([route]);
    expect(q).toContain('around:18,43.65000,-79.38000');
    expect(q).toContain('node.n0[highway~"^(crossing|street_lamp)$"]');
    expect(q.startsWith('[out:json]')).toBe(true);
  });

  it('derives lighting, stairs and crossings from mapped data', () => {
    const ctx = parseOverpass([
      { type: 'way', id: 1, tags: { highway: 'residential', lit: 'yes' }, geometry: [{ lat: 43.65, lon: -79.38 }, { lat: 43.652, lon: -79.38 }] },
      { type: 'way', id: 2, tags: { highway: 'steps' }, geometry: [{ lat: 43.652, lon: -79.38 }, { lat: 43.652, lon: -79.378 }] },
      { type: 'node', id: 3, lat: 43.651, lon: -79.38, tags: { highway: 'crossing' } },
      { type: 'node', id: 4, lat: 43.6511, lon: -79.3801, tags: { shop: 'convenience' } },
      { type: 'node', id: 5, lat: 43.70, lon: -79.30, tags: { highway: 'crossing' } },
    ]);
    const m = analyzeRouteWithOsm(route, ctx);
    expect(m.matchPct).toBeGreaterThan(0.9);
    expect(m.litPct).toBeGreaterThan(0.5);
    expect(m.litPct).toBeLessThan(0.75);
    expect(m.stairs).toBe(1);
    expect(m.crossings).toBe(1);
    expect(m.publicPlaces).toBe(1);
  });

  it('reports nothing matched when there is no mapped data', () => {
    const m = analyzeRouteWithOsm(route, { ways: [], points: [] });
    expect(m.matchPct).toBe(0);
    expect(m.lightingCoveragePct).toBe(0);
  });
});
