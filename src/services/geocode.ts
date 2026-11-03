import { config } from '@/lib/config';
import type { LatLng, Place } from '@/types';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function labelFor(p: Record<string, string | undefined>): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const primary = p.name && p.name !== p.street ? p.name : street || p.name;
  const parts = [primary, primary === street ? undefined : street, p.city ?? p.town ?? p.village ?? p.district, p.state]
    .filter((x, i, arr) => x && arr.indexOf(x) === i);
  return parts.slice(0, 3).join(', ') || 'Unnamed location';
}

/** Address search via Photon (OpenStreetMap data, komoot). No key required. */
export async function searchPlaces(query: string, near?: LatLng, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
  if (near) {
    params.set('lat', near.lat.toFixed(4));
    params.set('lon', near.lng.toFixed(4));
  }
  const res = await fetch(`${config.geocoderUrl}/api/?${params}`, { signal });
  if (!res.ok) throw new Error('Address search is unavailable right now.');
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features.map((f) => ({
    label: labelFor(f.properties),
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

export interface AreaName {
  /** Neighbourhood or district, falling back to the city. */
  area: string;
  city: string | null;
  countryCode: string | null;
}

/** Neighbourhood-level name for a point (used to look up local news). */
export async function reverseArea(p: LatLng, signal?: AbortSignal): Promise<AreaName | null> {
  const res = await fetch(`${config.geocoderUrl}/reverse?lat=${p.lat}&lon=${p.lng}&limit=1&lang=en`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { features: PhotonFeature[] };
  const props = data.features[0]?.properties;
  if (!props) return null;
  const city = props.city ?? props.town ?? props.village ?? null;
  const area = props.locality ?? props.district ?? city;
  return area ? { area, city, countryCode: props.countrycode?.toUpperCase() ?? null } : null;
}

export async function reverseGeocode(p: LatLng): Promise<string> {
  try {
    const res = await fetch(`${config.geocoderUrl}/reverse?lat=${p.lat}&lon=${p.lng}&limit=1&lang=en`);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { features: PhotonFeature[] };
    if (!data.features.length) throw new Error();
    return labelFor(data.features[0].properties);
  } catch {
    return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
  }
}
