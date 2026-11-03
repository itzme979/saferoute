import { describe, expect, it } from 'vitest';
import { approximate, decimate, distanceToLine, haversine, lineLength, progressAlong, samplePoints } from './geo';

const line: [number, number][] = [[-79.38, 43.65], [-79.38, 43.66], [-79.37, 43.66]];

describe('geo', () => {
  it('computes haversine distance for ~1.11 km of latitude', () => {
    const d = haversine({ lat: 43.65, lng: -79.38 }, { lat: 43.66, lng: -79.38 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });

  it('measures polyline length', () => {
    expect(lineLength(line)).toBeCloseTo(1112 + 805, -2);
  });

  it('measures distance to a line', () => {
    expect(distanceToLine({ lat: 43.655, lng: -79.38 }, line)).toBeLessThan(1);
    const off = distanceToLine({ lat: 43.655, lng: -79.379 }, line);
    expect(off).toBeGreaterThan(70);
    expect(off).toBeLessThan(90);
  });

  it('computes progress and remaining distance', () => {
    const p = progressAlong({ lat: 43.66, lng: -79.38 }, line);
    expect(p.along).toBeGreaterThan(1100);
    expect(p.remaining).toBeGreaterThan(780);
    expect(p.remaining).toBeLessThan(830);
  });

  it('samples points along a route at a fixed step', () => {
    const pts = samplePoints(line, 100);
    expect(pts.length).toBeGreaterThan(18);
    expect(pts.length).toBeLessThan(22);
  });

  it('decimates while keeping endpoints', () => {
    const many = Array.from({ length: 500 }, (_, i) => [i, i] as [number, number]);
    const d = decimate(many, 50);
    expect(d).toHaveLength(50);
    expect(d[0]).toEqual([0, 0]);
    expect(d[49]).toEqual([499, 499]);
  });

  it('approximates coordinates to ~11 m', () => {
    expect(approximate({ lat: 43.123456, lng: -79.987654 })).toEqual({ lat: 43.1235, lng: -79.9877 });
  });
});
