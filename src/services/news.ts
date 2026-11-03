import type { LatLng } from '@/types';
import { reverseArea } from './geocode';

/**
 * Recent local news headlines about safety near a place, via /api/news.
 * Context only: headlines are never used to rank routes, and a story that
 * mentions a neighbourhood may have happened anywhere in it.
 */

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

export interface AreaNews {
  area: string;
  city: string | null;
  items: NewsItem[];
  provider: string;
}

export class NewsUnavailableError extends Error {}

export async function loadAreaNews(p: LatLng, signal?: AbortSignal): Promise<AreaNews | null> {
  const name = await reverseArea(p, signal);
  if (!name) return null;
  const params = new URLSearchParams({ place: name.area, country: name.countryCode ?? 'CA' });
  if (name.city) params.set('city', name.city);
  const res = await fetch(`/api/news?${params}`, { signal });
  // Without the serverless function (e.g. a plain static preview) the SPA fallback returns HTML.
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new NewsUnavailableError('Local news is not available right now.');
  }
  const data = (await res.json()) as { items: NewsItem[]; provider: string };
  return { area: name.area, city: name.city, items: data.items ?? [], provider: data.provider ?? 'Google News' };
}
