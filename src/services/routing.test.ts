import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodePolyline } from '@/lib/geo';
import { getRoutes, RoutingError } from './routing';
import type { TravelMode } from '@/types';

const a = { lat: 43.65, lng: -79.38 };
const b = { lat: 43.67, lng: -79.4 };

const osrm = { code: 'Ok', routes: [{ distance: 3000, duration: 900, geometry: { coordinates: [[-79.38, 43.65], [-79.4, 43.67]] }, legs: [{ steps: [] }] }] };

const leg = (mode: string, from: string, to: string, startTime: string, endTime: string, extra = {}) => ({
  mode, from: { name: from }, to: { name: to }, startTime, endTime, duration: (Date.parse(endTime) - Date.parse(startTime)) / 1000,
  // [-120.2, 38.5], [-120.95, 40.7] at precision 5.
  legGeometry: { points: '_p~iF~ps|U_ulLnnqC', precision: 5 }, ...extra,
});

const plan = {
  itineraries: [{
    duration: 1800, startTime: '2026-11-04T22:00:00Z', endTime: '2026-11-04T22:30:00Z', transfers: 0,
    legs: [
      leg('WALK', 'START', 'King St', '2026-11-04T22:00:00Z', '2026-11-04T22:05:00Z'),
      leg('SUBWAY', 'King St', 'Bloor St', '2026-11-04T22:05:00Z', '2026-11-04T22:25:00Z', { routeShortName: '1', headsign: 'Finch', agencyName: 'TTC' }),
      leg('WALK', 'Bloor St', 'END', '2026-11-04T22:25:00Z', '2026-11-04T22:30:00Z'),
    ],
  }],
};

function stub(body: unknown) {
  const f = vi.fn(async (_url: string) => ({ ok: true, json: async () => body }));
  vi.stubGlobal('fetch', f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe('getRoutes', () => {
  it.each([['bike', 'routed-bike'], ['car', 'routed-car']] as [TravelMode, string][])('asks for %s routes from the matching profile', async (mode, profile) => {
    const f = stub(osrm);
    const r = await getRoutes(mode, a, b);
    expect(f.mock.calls[0][0]).toContain(profile);
    expect(r.routes[0].durationS).toBe(900);
  });

  it('turns a transit plan into a route with named steps', async () => {
    stub(plan);
    const { routes, provider } = await getRoutes('transit', a, b);
    expect(provider).toBe('Transitous');
    expect(routes[0].transfers).toBe(0);
    expect(routes[0].arrivesAt).toBe('2026-11-04T22:30:00Z');
    expect(routes[0].legs?.map((l) => l.kind)).toEqual(['walk', 'train', 'walk']);
    expect(routes[0].legs?.[1].label).toBe('Subway 1');
    expect(routes[0].legs?.[0].from).toBe('Start');
    expect(routes[0].legs?.[2].to).toBe('Destination');
    expect(routes[0].coordinates).toHaveLength(6);
    expect(routes[0].coordinates[0]).toEqual([-120.2, 38.5]);
  });

  it('explains when no transit trip exists', async () => {
    stub({ itineraries: [] });
    await expect(getRoutes('transit', a, b)).rejects.toMatchObject({ code: 'no_route' });
  });

  it('reports a failed transit service as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    await expect(getRoutes('transit', a, b)).rejects.toBeInstanceOf(RoutingError);
    await expect(getRoutes('transit', a, b)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('applies a distance limit for each mode', async () => {
    const far = { lat: 43.65, lng: -77.9 }; // about 120 km east
    await expect(getRoutes('walk', a, far)).rejects.toMatchObject({ code: 'too_far' });
    await expect(getRoutes('bike', a, far)).rejects.toMatchObject({ code: 'too_far' });
    stub(osrm);
    await expect(getRoutes('car', a, far)).resolves.toBeTruthy();
  });
});

describe('decodePolyline', () => {
  it('decodes the reference example', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  });
});
