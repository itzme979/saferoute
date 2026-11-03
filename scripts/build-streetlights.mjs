#!/usr/bin/env node
/**
 * Builds static streetlight tiles from official city open data so the app can
 * look up light poles near a route without a server. Only add datasets that
 * are published under an open licence.
 *
 *   node scripts/build-streetlights.mjs            # all cities
 *   node scripts/build-streetlights.mjs toronto    # one city
 *
 * Output: public/data/streetlights/<city>/index.json plus one JSON file per
 * 0.01° cell ("<lngCell>_<latCell>.json"). Each cell stores its poles as
 * integer offsets (1e-5°, about 1 m) from the cell's south-west corner.
 * Re-run when the city refreshes its dataset.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'streetlights');
const CELL = 100; // cells per degree (0.01°)
const UNIT = 1e5; // stored precision per degree

const CITIES = {
  toronto: {
    name: 'City of Toronto',
    dataset: 'Topographic Mapping - Poles',
    licence: 'Open Government Licence - Toronto',
    page: 'https://open.toronto.ca/dataset/topographic-mapping-poles/',
    csv: 'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/cdf46145-7a91-4f1c-9dd1-91cd58338238/resource/5ce5f150-f0be-4417-af94-d531594d61f4/download/poles-4326.csv',
    meta: 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=topographic-mapping-poles',
    // Only poles that carry a light. Traffic-signal-only and miscellaneous poles are excluded.
    keep: new Set(['Street Light Pole', 'Pedestrian Light Pole', 'Street Light and Traffic Signal Pole']),
  },
  brampton: {
    name: 'City of Brampton',
    dataset: 'Street Light Poles',
    licence: 'CC BY',
    page: 'https://geohub.brampton.ca/',
    arcgis: 'https://services3.arcgis.com/rl7ACuZkiFsmDA2g/ArcGIS/rest/services/Road_Maintenance_Ops_and_Fleet/FeatureServer/1',
  },
  burlington: {
    name: 'City of Burlington',
    dataset: 'All Streetlight Fixtures',
    licence: 'City of Burlington Open Data Terms',
    page: 'https://www.arcgis.com/home/item.html?id=a5f1913e23fd446a9db8df28411a9ba7',
    arcgis: 'https://mapping.burlington.ca/arcgisweb/rest/services/COB/Streetlights/MapServer/0',
  },
  whitby: {
    name: 'Town of Whitby',
    dataset: 'Streetlights',
    licence: 'Open Government Licence - Town of Whitby',
    page: 'https://www.arcgis.com/home/item.html?id=2ca8efaf4e784856acfd7354104add1d',
    arcgis: 'https://services5.arcgis.com/ATdLnvuMRJk8AGkQ/arcgis/rest/services/WhitbyStreetlights/FeatureServer/0',
  },
};

/** Minimal CSV line splitter that handles quoted fields with doubled quotes. */
function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Toronto: [lng, lat] of every light-carrying pole in the city's CSV. */
async function downloadCsv(id, c) {
  console.log(`[${id}] downloading ${c.csv}`);
  const res = await fetch(c.csv);
  if (!res.ok) throw new Error(`[${id}] download failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const header = splitCsv(lines[0]);
  const iType = header.indexOf('SUBTYPE_DESC');
  const iGeom = header.indexOf('geometry');
  if (iType < 0 || iGeom < 0) throw new Error(`[${id}] unexpected CSV columns: ${header.join(',')}`);

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = splitCsv(lines[i]);
    if (!c.keep.has(f[iType])) continue;
    try {
      const g = JSON.parse(f[iGeom]);
      for (const p of g.type === 'MultiPoint' ? g.coordinates : [g.coordinates]) points.push(p);
    } catch {
      continue;
    }
  }

  let refreshed = null;
  try {
    const meta = await (await fetch(c.meta)).json();
    refreshed = meta.result?.last_refreshed ?? null;
  } catch { /* optional */ }
  return { points, refreshed };
}

/** ArcGIS layers: pages through every point, in WGS84. */
async function downloadArcgis(id, c) {
  const info = await (await fetch(`${c.arcgis}?f=json`)).json();
  const pageSize = Math.min(info.maxRecordCount ?? 1000, 2000);
  const points = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = `${c.arcgis}/query?where=1%3D1&outFields=OBJECTID&orderByFields=OBJECTID&outSR=4326&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[${id}] download failed: ${res.status}`);
    const page = await res.json();
    if (page.error) throw new Error(`[${id}] ${JSON.stringify(page.error)}`);
    for (const f of page.features) if (f.geometry) points.push([f.geometry.x, f.geometry.y]);
    if (page.features.length < pageSize) break;
  }
  console.log(`[${id}] ${points.length} downloaded`);
  const edited = info.editingInfo?.lastEditDate;
  return { points, refreshed: edited ? new Date(edited).toISOString() : null };
}

async function build(id, c) {
  const { points, refreshed } = c.arcgis ? await downloadArcgis(id, c) : await downloadCsv(id, c);

  const cells = new Map();
  let kept = 0;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const cx = Math.floor(lng * CELL);
    const cy = Math.floor(lat * CELL);
    const key = `${cx}_${cy}`;
    let arr = cells.get(key);
    if (!arr) cells.set(key, (arr = []));
    arr.push(Math.round((lng - cx / CELL) * UNIT), Math.round((lat - cy / CELL) * UNIT));
    kept++;
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }

  const dir = join(ROOT, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [key, pts] of cells) await writeFile(join(dir, `${key}.json`), JSON.stringify(pts));
  const index = {
    version: 1,
    name: c.name,
    dataset: c.dataset,
    licence: c.licence,
    page: c.page,
    refreshed,
    built: new Date().toISOString(),
    cellsPerDegree: CELL,
    unitsPerDegree: UNIT,
    bbox: [minLng, minLat, maxLng, maxLat].map((v) => Math.round(v * 1e5) / 1e5),
    count: kept,
    cells: [...cells.keys()].sort(),
  };
  await writeFile(join(dir, 'index.json'), JSON.stringify(index));
  console.log(`[${id}] ${kept} light poles in ${cells.size} cells -> ${dir}`);
}

const only = process.argv[2];
for (const [id, c] of Object.entries(CITIES)) {
  if (!only || only === id) await build(id, c);
}
