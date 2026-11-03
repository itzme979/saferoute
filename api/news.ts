/**
 * GET /api/news?place=Kensington%20Market&city=Toronto&country=CA
 *
 * Recent safety-related local news headlines for an area, from the Google
 * News RSS search feed. The feed can't be read from the browser directly
 * (no CORS), so this edge function fetches it, keeps only headlines that
 * mention safety-related words, and caches the result at Vercel's edge.
 *
 * Headlines are context only: SafeRoute never uses them to rank routes.
 */
export const config = { runtime: 'edge' };

const SAFETY_QUERY = '(police OR stabbing OR shooting OR assault OR robbery OR "sexual assault" OR attack OR collision OR pedestrian OR arrested)';
const RELEVANT = /police|stab|shoot|shot|gun|knife|weapon|assault|robb|attack|arrest|charged|homicide|murder|kill|dead|death|collision|struck|pedestrian|crash|break-in|theft|carjack|harass|violen|missing|suspect|safety/i;
const EDITIONS: Record<string, string> = {
  CA: 'hl=en-CA&gl=CA&ceid=CA:en',
  GB: 'hl=en-GB&gl=GB&ceid=GB:en',
  US: 'hl=en-US&gl=US&ceid=US:en',
};
const SAFE_TEXT = /^[\p{L}\p{N} .,'’&()-]{2,80}$/u;
const MAX_ITEMS = 8;

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};

export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const source = tag(body, 'source');
    let title = tag(body, 'title');
    // Google appends " - Source Name" to every title.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = tag(body, 'link');
    const date = Date.parse(tag(body, 'pubDate'));
    if (!title || !/^https?:\/\//.test(url)) continue;
    items.push({ title, url, source, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null });
  }
  return items;
}

const json = (body: unknown, status = 200, cache = 'public, s-maxage=1800, stale-while-revalidate=3600') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

export default async function handler(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const place = (params.get('place') ?? '').trim();
  const city = (params.get('city') ?? '').trim();
  const country = (params.get('country') ?? 'CA').trim().toUpperCase();
  if (!SAFE_TEXT.test(place) || (city && !SAFE_TEXT.test(city))) return json({ error: 'Invalid place' }, 400, 'no-store');

  const where = city && city.toLowerCase() !== place.toLowerCase() ? `"${place}" ${city}` : `"${place}"`;
  const q = `${where} ${SAFETY_QUERY} when:60d`;
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${EDITIONS[country] ?? EDITIONS.CA}`;
  try {
    const res = await fetch(feed, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; SafeRoute/1.0)' } });
    if (!res.ok) return json({ error: `News feed unavailable (${res.status})` }, 502, 'no-store');
    const seen = new Set<string>();
    const items = parseRss(await res.text())
      .filter((i) => RELEVANT.test(i.title))
      .filter((i) => {
        const k = i.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, MAX_ITEMS);
    return json({ place, city, items, provider: 'Google News', fetchedAt: new Date().toISOString() });
  } catch {
    return json({ error: 'News feed unavailable' }, 502, 'no-store');
  }
}
