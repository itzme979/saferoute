// Proxies walking-route requests to OpenRouteService so the API key never
// reaches the browser. Returns ORS GeoJSON (with alternative routes).
import { json, preflight, requireUser } from '../_shared/common.ts';

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const { user } = await requireUser(req);
  if (!user) return json({ error: 'Not signed in' }, 401);

  const key = Deno.env.get('ORS_API_KEY');
  if (!key) return json({ error: 'Routing service is not configured', code: 'not_configured' }, 503);

  let body: { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number } };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const o = body.origin, d = body.destination;
  const valid = (p?: { lat: number; lng: number }) =>
    !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  if (!valid(o) || !valid(d)) return json({ error: 'Invalid coordinates' }, 400);

  const start: [number, number] = [o!.lng, o!.lat];
  const end: [number, number] = [d!.lng, d!.lat];
  const km = haversineKm(start, end);
  if (km > 30) return json({ error: 'Walking routes are limited to 30 km', code: 'too_far' }, 422);

  const payload: Record<string, unknown> = {
    coordinates: [start, end],
    instructions: true,
    elevation: false,
    extra_info: ['surface', 'waytype', 'steepness'],
  };
  // ORS only supports alternatives for routes under 100 km; ask for up to 3.
  if (km > 0.15) payload.alternative_routes = { target_count: 3, share_factor: 0.6, weight_factor: 1.6 };

  const res = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    return json({ error: 'Routing service error', status: res.status, detail: text.slice(0, 300) }, 502);
  }
  return json(await res.json());
});
