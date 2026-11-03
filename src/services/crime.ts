import { distanceToLine, decimate, haversine } from '@/lib/geo';
import type { CrimeGroup, LatLng, RouteCrimeMetrics } from '@/types';

/**
 * Police-reported crime from official open data.
 *
 * Every source publishes locations that are deliberately offset (usually to
 * the nearest intersection or block) to protect privacy, and each one only
 * covers certain offence types. Counts are therefore an indication of what
 * has been reported nearby, never a measure of how safe a street is.
 */

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export interface CrimeIncident {
  id: string;
  lat: number;
  lng: number;
  /** ISO date (day or month precision, depending on the source). */
  date: string;
  category: string;
  group: CrimeGroup;
}

export interface CrimePeriod {
  start: Date;
  end: Date;
  label: string;
}

export interface CrimeSourceInfo {
  id: string;
  name: string;
  url: string;
  /** What the dataset leaves out, shown wherever its numbers appear. */
  caveat?: string;
}

export interface CrimeSummary {
  total: number;
  byGroup: Record<CrimeGroup, number>;
  topCategories: { label: string; count: number }[];
}

export interface AreaCrimeSummary extends CrimeSummary {
  radiusM: number;
}

export interface CrimeContext {
  source: CrimeSourceInfo;
  period: CrimePeriod;
  routes: RouteCrimeMetrics[];
  origin: AreaCrimeSummary | null;
  destination: AreaCrimeSummary | null;
}

export interface CrimeOverlay {
  source: CrimeSourceInfo;
  period: CrimePeriod;
  incidents: CrimeIncident[];
  /** True when the area had more incidents than we load for the map. */
  truncated: boolean;
}

export const ROUTE_BUFFER_M = 75;
export const AREA_RADIUS_M = 400;
const OVERLAY_MAX = 6000;
const LOCAL_MAX = 20000;

export const CRIME_GROUP_LABELS: Record<CrimeGroup, string> = {
  personal: 'Against people',
  property: 'Property',
  vehicle: 'Vehicle',
  other: 'Other',
};

export const CRIME_GROUP_COLORS: Record<CrimeGroup, string> = { personal: '#D2604A', property: '#D69A2D', vehicle: '#7B6CB1', other: '#64748B' };

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

type Area = { kind: 'line'; coords: [number, number][]; bufferM: number } | { kind: 'circle'; center: LatLng; radiusM: number };

interface Provider extends CrimeSourceInfo {
  bbox: BBox;
  /** Length of the reporting window, ending at the newest data the source has. */
  months: number;
  covers?: (p: LatLng, signal?: AbortSignal) => Promise<boolean>;
  latest: (signal?: AbortSignal) => Promise<Date>;
  incidents: (bbox: BBox, period: CrimePeriod, max: number, signal?: AbortSignal) => Promise<{ incidents: CrimeIncident[]; truncated: boolean }>;
  /** Server-side category counts within an area. Providers without it are counted locally. */
  countsIn?: (area: Area, period: CrimePeriod, signal?: AbortSignal) => Promise<Map<string, number>>;
  group: (category: string) => CrimeGroup;
  label?: (category: string) => string;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Crime data request failed (${res.status})`);
  return (await res.json()) as T;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// --- ArcGIS Feature Services (Toronto Police, Ottawa Police) ----------------

interface ArcGisConfig {
  url: string;
  dateField: string;
  categoryField: string;
}

interface ArcGisResponse {
  features?: { attributes: Record<string, unknown>; geometry?: { x: number; y: number } }[];
  count?: number;
  error?: { message?: string };
}

async function arcgis(cfg: ArcGisConfig, params: Record<string, string>, signal?: AbortSignal): Promise<ArcGisResponse> {
  // POST as a form keeps long route geometries out of the URL and stays a simple CORS request.
  const data = await getJson<ArcGisResponse>(`${cfg.url}/query`, { method: 'POST', body: new URLSearchParams({ f: 'json', ...params }), signal });
  if (data.error) throw new Error(data.error.message || 'Crime data query failed');
  return data;
}

// The period always ends at the newest record, so only the start needs a bound
// (an upper DATE bound would drop records timestamped later on the final day).
const arcWhere = (cfg: ArcGisConfig, period: CrimePeriod) => `${cfg.dateField} >= DATE '${isoDay(period.start)}'`;

function arcGeometry(area: Area | { kind: 'bbox'; bbox: BBox }): Record<string, string> {
  if (area.kind === 'bbox') {
    const [xmin, ymin, xmax, ymax] = area.bbox;
    return { geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' };
  }
  if (area.kind === 'circle') {
    return {
      geometry: JSON.stringify({ x: area.center.lng, y: area.center.lat, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', distance: String(area.radiusM), units: 'esriSRUnit_Meter',
    };
  }
  return {
    geometry: JSON.stringify({ paths: [decimate(area.coords, 80)], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolyline', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', distance: String(area.bufferM), units: 'esriSRUnit_Meter',
  };
}

function arcgisProvider(info: Omit<Provider, 'latest' | 'incidents' | 'countsIn'>, cfg: ArcGisConfig): Provider {
  return {
    ...info,
    async latest(signal) {
      const r = await arcgis(cfg, { where: '1=1', outStatistics: JSON.stringify([{ statisticType: 'max', onStatisticField: cfg.dateField, outStatisticFieldName: 'mx' }]) }, signal);
      const mx = Number(r.features?.[0]?.attributes.mx);
      if (!Number.isFinite(mx)) throw new Error('Crime data has no dates');
      return new Date(mx);
    },
    async countsIn(area, period, signal) {
      const r = await arcgis(cfg, {
        where: arcWhere(cfg, period), ...arcGeometry(area),
        groupByFieldsForStatistics: cfg.categoryField,
        outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: cfg.categoryField, outStatisticFieldName: 'n' }]),
      }, signal);
      const out = new Map<string, number>();
      for (const f of r.features ?? []) out.set(String(f.attributes[cfg.categoryField] ?? 'Other'), Number(f.attributes.n) || 0);
      return out;
    },
    async incidents(bbox, period, max, signal) {
      const base = { where: arcWhere(cfg, period), ...arcGeometry({ kind: 'bbox', bbox }) };
      const { count = 0 } = await arcgis(cfg, { ...base, returnCountOnly: 'true' }, signal);
      const page = 2000;
      const pages = Math.ceil(Math.min(count, max) / page);
      const results = await Promise.all(Array.from({ length: pages }, (_, i) => arcgis(cfg, {
        ...base, outFields: `OBJECTID,${cfg.dateField},${cfg.categoryField}`, returnGeometry: 'true', outSR: '4326',
        orderByFields: `${cfg.dateField} DESC`, resultOffset: String(i * page), resultRecordCount: String(page), geometryPrecision: '5',
      }, signal)));
      const incidents: CrimeIncident[] = [];
      for (const r of results) {
        for (const f of r.features ?? []) {
          if (!f.geometry || !Number.isFinite(f.geometry.x) || !Number.isFinite(f.geometry.y)) continue;
          const category = String(f.attributes[cfg.categoryField] ?? 'Other');
          incidents.push({
            id: `${info.id}-${f.attributes.OBJECTID}`, lat: f.geometry.y, lng: f.geometry.x,
            date: isoDay(new Date(Number(f.attributes[cfg.dateField]))), category: info.label?.(category) ?? category, group: info.group(category),
          });
        }
      }
      return { incidents, truncated: count > max };
    },
  };
}

const TORONTO = arcgisProvider({
  id: 'toronto',
  name: 'Toronto Police Service open data (Major Crime Indicators)',
  url: 'https://data.torontopolice.on.ca/',
  bbox: [-79.64, 43.58, -79.11, 43.86],
  months: 12,
  caveat: 'Covers assault, robbery, break and enter, auto theft and theft over $5,000. Sexual assaults are not included, and locations are offset to the nearest intersection.',
  group: (c) => (c === 'Assault' || c === 'Robbery' ? 'personal' : c === 'Auto Theft' ? 'vehicle' : 'property'),
}, {
  url: 'https://services.arcgis.com/S9th0jAJ7bqgIRjw/ArcGIS/rest/services/Major_Crime_Indicators_Open_Data/FeatureServer/0',
  dateField: 'REPORT_DATE',
  categoryField: 'CSI_CATEGORY',
});

const OTTAWA_PERSONAL = /Assault|Sexual|Violence|Causing Death|Weapons|Capital Crime|Deprivation Of Freedom|Robbery/i;
const OTTAWA = arcgisProvider({
  id: 'ottawa',
  name: 'Ottawa Police Service open data (Criminal Offences)',
  url: 'https://data.ottawapolice.ca/',
  bbox: [-76.36, 44.96, -75.24, 45.54],
  months: 12,
  caveat: 'Ottawa Police publish this data about once a year, so the newest months may be missing. Locations are offset to the nearest intersection.',
  group: (c) => (OTTAWA_PERSONAL.test(c) ? 'personal'
    : /Motor Vehicle/i.test(c) ? 'vehicle'
      : /Break and Enter|Theft|Mischief|Arson|Stolen Goods/i.test(c) ? 'property' : 'other'),
}, {
  url: 'https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Criminal_Offences_Open_Data/FeatureServer/0',
  dateField: 'REP_DATE',
  categoryField: 'OFF_CATEG',
});

// --- Montréal (SPVM via donnees.montreal.ca) --------------------------------

const MTL_RESOURCE = 'c6f482bf-bf0f-4960-8b2f-9982c211addd';
const MTL_LABELS: Record<string, string> = {
  'Vols qualifiés': 'Robbery',
  'Infractions entrainant la mort': 'Offences causing death',
  Introduction: 'Break and enter',
  'Méfait': 'Mischief',
  'Vol de véhicule à moteur': 'Vehicle theft',
  'Vol dans / sur véhicule à moteur': 'Theft from vehicle',
};

async function montrealSql<T>(sql: string, signal?: AbortSignal): Promise<T[]> {
  const data = await getJson<{ success: boolean; result?: { records: T[] } }>('https://donnees.montreal.ca/api/3/action/datastore_search_sql', {
    method: 'POST', body: new URLSearchParams({ sql }), signal,
  });
  if (!data.success || !data.result) throw new Error('Montréal crime data query failed');
  return data.result.records;
}

const MONTREAL: Provider = {
  id: 'montreal',
  name: 'Service de police de la Ville de Montréal (Actes criminels)',
  url: 'https://donnees.montreal.ca/dataset/actes-criminels',
  bbox: [-73.98, 45.40, -73.47, 45.71],
  months: 12,
  caveat: 'Montréal does not publish assaults or sexual offences, and some incidents have no published location, so counts are lower than the real total.',
  group: (c) => (c === 'Vols qualifiés' || c === 'Infractions entrainant la mort' ? 'personal' : c.startsWith('Vol') ? 'vehicle' : 'property'),
  label: (c) => MTL_LABELS[c] ?? c,
  async latest(signal) {
    const [r] = await montrealSql<{ mx: string }>(`SELECT MAX("DATE") mx FROM "${MTL_RESOURCE}"`, signal);
    if (!r?.mx) throw new Error('Montréal crime data has no dates');
    return new Date(`${r.mx}T12:00:00`);
  },
  async incidents([minLng, minLat, maxLng, maxLat], period, max, signal) {
    const n = (v: number) => v.toFixed(5);
    const rows = await montrealSql<{ _id: number; CATEGORIE: string; DATE: string; LATITUDE: string; LONGITUDE: string }>(
      `SELECT "_id","CATEGORIE","DATE","LATITUDE","LONGITUDE" FROM "${MTL_RESOURCE}" WHERE "DATE" >= '${isoDay(period.start)}'`
      + ` AND "LATITUDE" LIKE '45.%' AND "LATITUDE"::float BETWEEN ${n(minLat)} AND ${n(maxLat)} AND "LONGITUDE"::float BETWEEN ${n(minLng)} AND ${n(maxLng)}`
      + ` ORDER BY "DATE" DESC LIMIT ${max + 1}`,
      signal,
    );
    const incidents = rows.slice(0, max).map((r) => ({
      id: `montreal-${r._id}`, lat: Number(r.LATITUDE), lng: Number(r.LONGITUDE), date: r.DATE,
      category: MTL_LABELS[r.CATEGORIE] ?? r.CATEGORIE, group: MONTREAL.group(r.CATEGORIE),
    })).filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
    return { incidents, truncated: rows.length > max };
  },
};

// --- England, Wales and Northern Ireland (data.police.uk) -------------------

const UK_LABELS: Record<string, string> = {
  'anti-social-behaviour': 'Anti-social behaviour', 'bicycle-theft': 'Bicycle theft', burglary: 'Burglary', 'criminal-damage-arson': 'Criminal damage and arson',
  drugs: 'Drugs', 'other-theft': 'Other theft', 'possession-of-weapons': 'Possession of weapons', 'public-order': 'Public order', robbery: 'Robbery',
  shoplifting: 'Shoplifting', 'theft-from-the-person': 'Theft from the person', 'vehicle-crime': 'Vehicle crime', 'violent-crime': 'Violence and sexual offences', 'other-crime': 'Other crime',
};
const UK_GROUPS: Record<string, CrimeGroup> = {
  'violent-crime': 'personal', robbery: 'personal', 'theft-from-the-person': 'personal', 'possession-of-weapons': 'personal',
  burglary: 'property', shoplifting: 'property', 'other-theft': 'property', 'bicycle-theft': 'property', 'criminal-damage-arson': 'property',
  'vehicle-crime': 'vehicle',
};

const UK: Provider = {
  id: 'uk',
  name: 'data.police.uk (England, Wales and Northern Ireland)',
  url: 'https://data.police.uk/',
  bbox: [-8.2, 49.9, 1.8, 55.85],
  months: 3,
  caveat: 'Shows the latest 3 months published. Locations are snapped to nearby anonymous map points.',
  group: (c) => UK_GROUPS[c] ?? 'other',
  label: (c) => UK_LABELS[c] ?? c,
  async covers(p, signal) {
    // Scotland is not covered by data.police.uk; its neighbourhood lookup returns 404 there.
    const res = await fetch(`https://data.police.uk/api/locate-neighbourhood?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, { signal });
    return res.ok;
  },
  async latest(signal) {
    const dates = await getJson<{ date: string }[]>('https://data.police.uk/api/crimes-street-dates', { signal });
    if (!dates.length) throw new Error('No UK crime data available');
    const [y, m] = dates[0].date.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0, 12)); // last day of the newest month
  },
  async incidents([minLng, minLat, maxLng, maxLat], period, max, signal) {
    const poly = [[minLat, minLng], [minLat, maxLng], [maxLat, maxLng], [maxLat, minLng]].map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(':');
    const months: string[] = [];
    for (let d = new Date(period.end); d >= period.start && months.length < 12; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15))) {
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    let truncated = false;
    const lists = await Promise.all(months.map(async (month) => {
      const res = await fetch('https://data.police.uk/api/crimes-street/all-crime', { method: 'POST', body: new URLSearchParams({ poly, date: month }), signal });
      if (res.status === 503) { truncated = true; return []; } // more than 10,000 crimes in the area
      if (!res.ok) throw new Error(`UK crime data request failed (${res.status})`);
      return (await res.json()) as { id: number; category: string; month: string; location: { latitude: string; longitude: string } }[];
    }));
    const incidents = lists.flat().map((c) => ({
      id: `uk-${c.id}`, lat: Number(c.location.latitude), lng: Number(c.location.longitude), date: `${c.month}-01`,
      category: UK_LABELS[c.category] ?? c.category, group: UK.group(c.category),
    })).filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
    return { incidents: incidents.slice(0, max), truncated: truncated || incidents.length > max };
  },
};

export const CRIME_PROVIDERS: Provider[] = [TORONTO, OTTAWA, MONTREAL, UK];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inBox = (p: LatLng, [a, b, c, d]: BBox) => p.lng >= a && p.lng <= c && p.lat >= b && p.lat <= d;

/** The provider whose coverage includes this point, if any. */
export async function crimeProviderFor(p: LatLng, signal?: AbortSignal): Promise<Provider | null> {
  const candidate = CRIME_PROVIDERS.find((pr) => inBox(p, pr.bbox));
  if (!candidate) return null;
  if (candidate.covers && !(await candidate.covers(p, signal).catch(() => false))) return null;
  return candidate;
}

const latestCache = new Map<string, Promise<Date>>();

export function periodEnding(end: Date, months: number): CrimePeriod {
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label: `${fmt(start)} to ${fmt(end)}` };
}

async function providerPeriod(p: Provider, signal?: AbortSignal): Promise<CrimePeriod> {
  let latest = latestCache.get(p.id);
  if (!latest) {
    latest = p.latest(signal);
    latestCache.set(p.id, latest);
    latest.catch(() => latestCache.delete(p.id));
  }
  return periodEnding(await latest, p.months);
}

const info = (p: Provider): CrimeSourceInfo => ({ id: p.id, name: p.name, url: p.url, caveat: p.caveat });

export function summarize(counts: Map<string, number>, group: (c: string) => CrimeGroup, label: (c: string) => string = (c) => c): CrimeSummary {
  const byGroup: Record<CrimeGroup, number> = { personal: 0, property: 0, vehicle: 0, other: 0 };
  let total = 0;
  const labelled = new Map<string, number>();
  for (const [cat, n] of counts) {
    byGroup[group(cat)] += n;
    total += n;
    const l = label(cat);
    labelled.set(l, (labelled.get(l) ?? 0) + n);
  }
  const topCategories = [...labelled.entries()].map(([l, count]) => ({ label: l, count })).sort((a, b) => b.count - a.count).slice(0, 4);
  return { total, byGroup, topCategories };
}

/** Counts incidents (already labelled) inside an area, locally. */
export function countLocal(incidents: CrimeIncident[], area: Area): Map<string, number> {
  const out = new Map<string, number>();
  const pad = (area.kind === 'line' ? area.bufferM : area.radiusM) / 90000; // metres to rough degrees, generous
  const box = area.kind === 'line' ? bboxOf(area.coords, 0) : ([area.center.lng, area.center.lat, area.center.lng, area.center.lat] as BBox);
  const [a, b, c, d] = [box[0] - pad * 1.5, box[1] - pad, box[2] + pad * 1.5, box[3] + pad];
  for (const i of incidents) {
    if (i.lng < a || i.lng > c || i.lat < b || i.lat > d) continue;
    const inside = area.kind === 'line' ? distanceToLine(i, area.coords) <= area.bufferM : haversine(i, area.center) <= area.radiusM;
    if (inside) out.set(i.category, (out.get(i.category) ?? 0) + 1);
  }
  return out;
}

export function bboxOf(coords: [number, number][], padM: number): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const dLat = padM / 111320;
  const dLng = padM / (111320 * Math.cos(((minY + maxY) / 2) * (Math.PI / 180)));
  return [minX - dLng, minY - dLat, maxX + dLng, maxY + dLat];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Crime near each route and around the start and destination.
 * Resolves to null when no police open data covers this trip.
 */
export async function loadCrimeContext(
  routes: [number, number][][],
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
): Promise<CrimeContext | null> {
  const all = routes.flat();
  const box = bboxOf(all.length ? all : [[origin.lng, origin.lat], [destination.lng, destination.lat]], 0);
  const centre = { lng: (box[0] + box[2]) / 2, lat: (box[1] + box[3]) / 2 };
  const p = await crimeProviderFor(centre, signal);
  if (!p) return null;
  const period = await providerPeriod(p, signal);
  const lineAreas: Area[] = routes.map((coords) => ({ kind: 'line', coords, bufferM: ROUTE_BUFFER_M }));
  const circles: Area[] = [
    { kind: 'circle', center: origin, radiusM: AREA_RADIUS_M },
    { kind: 'circle', center: destination, radiusM: AREA_RADIUS_M },
  ];

  let counts: Map<string, number>[];
  let truncated = false;
  let label: (c: string) => string;
  let group: (c: string) => CrimeGroup;
  if (p.countsIn) {
    counts = await Promise.all([...lineAreas, ...circles].map((a) => p.countsIn!(a, period, signal)));
    label = p.label ?? ((c) => c);
    group = p.group;
  } else {
    const pts: [number, number][] = [...all, [origin.lng, origin.lat], [destination.lng, destination.lat]];
    const res = await p.incidents(bboxOf(pts, AREA_RADIUS_M + 50), period, LOCAL_MAX, signal);
    truncated = res.truncated;
    counts = [...lineAreas, ...circles].map((a) => countLocal(res.incidents, a));
    // Local incidents already carry display labels; map them back to groups.
    const groups = new Map(res.incidents.map((i) => [i.category, i.group]));
    label = (c) => c;
    group = (c) => groups.get(c) ?? 'other';
  }

  const routeMetrics: RouteCrimeMetrics[] = lineAreas.map((_, i) => ({
    ...summarize(counts[i], group, label),
    bufferM: ROUTE_BUFFER_M,
    periodLabel: period.label,
    source: p.name,
    caveat: p.caveat,
    truncated,
  }));
  const area = (i: number): AreaCrimeSummary => ({ ...summarize(counts[i], group, label), radiusM: AREA_RADIUS_M });
  return { source: info(p), period, routes: routeMetrics, origin: area(routes.length), destination: area(routes.length + 1) };
}

/** Individual incidents for a map overlay. Null when no source covers the area. */
export async function loadCrimeOverlay(bbox: BBox, signal?: AbortSignal): Promise<CrimeOverlay | null> {
  const centre = { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
  const p = await crimeProviderFor(centre, signal);
  if (!p) return null;
  const period = await providerPeriod(p, signal);
  const { incidents, truncated } = await p.incidents(bbox, period, OVERLAY_MAX, signal);
  return { source: info(p), period, incidents, truncated };
}
