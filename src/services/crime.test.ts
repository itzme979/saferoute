import { describe, expect, it } from 'vitest';
import { bboxOf, countLocal, periodEnding, summarize, type CrimeIncident } from './crime';

const inc = (id: string, lat: number, lng: number, category = 'Assault', group: CrimeIncident['group'] = 'personal'): CrimeIncident =>
  ({ id, lat, lng, date: '2026-01-01', category, group });

describe('countLocal', () => {
  const line: [number, number][] = [[-79.38, 43.65], [-79.38, 43.66]];
  it('counts only incidents within the buffer of the route', () => {
    const counts = countLocal([
      inc('on', 43.655, -79.3801),
      inc('near', 43.655, -79.3808), // about 65 m east-west
      inc('far', 43.655, -79.3830), // about 240 m away
      inc('past-end', 43.67, -79.38),
    ], { kind: 'line', coords: line, bufferM: 75 });
    expect(counts.get('Assault')).toBe(2);
  });

  it('counts incidents within a radius of a point', () => {
    const counts = countLocal([inc('a', 43.65, -79.38), inc('b', 43.6535, -79.38, 'Robbery'), inc('c', 43.66, -79.38)],
      { kind: 'circle', center: { lat: 43.65, lng: -79.38 }, radiusM: 400 });
    expect([...counts.entries()]).toEqual([['Assault', 1], ['Robbery', 1]]);
  });
});

describe('summarize', () => {
  it('totals by group and lists the most common categories first', () => {
    const s = summarize(new Map([['Assault', 5], ['Auto Theft', 9], ['Robbery', 2]]), (c) => (c === 'Auto Theft' ? 'vehicle' : 'personal'));
    expect(s.total).toBe(16);
    expect(s.byGroup).toEqual({ personal: 7, property: 0, vehicle: 9, other: 0 });
    expect(s.topCategories[0]).toEqual({ label: 'Auto Theft', count: 9 });
  });
});

describe('periodEnding', () => {
  it('covers whole months ending at the newest data', () => {
    const p = periodEnding(new Date(Date.UTC(2026, 8, 30, 4)), 12);
    expect(p.start.toISOString().slice(0, 10)).toBe('2025-10-01');
    expect(p.label).toMatch(/Oct\.? 2025 to Sep\.? 2026/);
  });
});

describe('bboxOf', () => {
  it('pads by roughly the requested distance', () => {
    const [minX, minY, maxX, maxY] = bboxOf([[-79.38, 43.65]], 111);
    expect(maxY - minY).toBeCloseTo(0.002, 3);
    expect(maxX - minX).toBeGreaterThan(maxY - minY); // longitude degrees are shorter at 43°N
  });
});
