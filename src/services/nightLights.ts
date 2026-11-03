import { samplePoints } from '@/lib/geo';
import type { LatLng, NightBrightnessMetrics } from '@/types';

/**
 * Night-time brightness seen from space: NASA Black Marble (VIIRS day/night
 * band, BRDF-corrected and gap-filled) served by NASA GIBS.
 *
 * Each pixel is roughly 500 m across, so this describes the surrounding area,
 * not individual streets, and it saturates over most of a city centre. It is
 * shown as context and never used to rank routes.
 */

const LAYER = 'VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance';
const ZOOM = 8; // the layer's native maximum
export const NIGHT_LIGHTS_ATTRIBUTION = 'NASA Black Marble (VIIRS) via NASA GIBS';

/** Grey levels from the GIBS colour map: grey 98 is about 3 nW/cm²/sr, grey 193 about 15. */
const DIM_FROM = 98;
const BRIGHT_FROM = 193;

export type BrightnessClass = 'dark' | 'dim' | 'bright';

export function classifyGray(g: number): BrightnessClass {
  return g >= BRIGHT_FROM ? 'bright' : g >= DIM_FROM ? 'dim' : 'dark';
}

/** Recent dates to sample (the newest few days are often not processed yet). */
export function nightLightDates(now = new Date()): string[] {
  return [4, 11, 18].map((d) => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10));
}

export function nightLightTileUrl(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/${date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}

/** Tile and pixel for a point in Web Mercator at the given zoom. */
export function tilePixel(p: LatLng, z = ZOOM): { tx: number; ty: number; px: number; py: number } {
  const n = 2 ** z;
  const x = ((p.lng + 180) / 360) * n;
  const r = (p.lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return { tx, ty, px: Math.min(255, Math.floor((x - tx) * 256)), py: Math.min(255, Math.floor((y - ty) * 256)) };
}

const tileCache = new Map<string, Promise<ImageData | null>>();

function loadTile(date: string, tx: number, ty: number): Promise<ImageData | null> {
  const key = `${date}/${tx}/${ty}`;
  let p = tileCache.get(key);
  if (!p) {
    const url = nightLightTileUrl(date).replace('{z}', String(ZOOM)).replace('{y}', String(ty)).replace('{x}', String(tx));
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bmp = await createImageBitmap(await res.blob());
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    })().catch(() => null);
    tileCache.set(key, p);
  }
  return p;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Pure: summarise grey values (null = no data) for the sampled points. */
export function summariseBrightness(grays: (number | null)[], dates: string[]): NightBrightnessMetrics | null {
  const known = grays.filter((g): g is number => g !== null);
  if (!known.length) return null;
  const count = (c: BrightnessClass) => known.filter((g) => classifyGray(g) === c).length / known.length;
  return { brightPct: count('bright'), dimPct: count('dim'), darkPct: count('dark'), coveragePct: known.length / grays.length, dates };
}

export async function loadNightBrightness(routes: [number, number][][]): Promise<(NightBrightnessMetrics | null)[]> {
  const dates = nightLightDates();
  return Promise.all(routes.map(async (coords) => {
    const samples = samplePoints(coords, 100);
    const grays = await Promise.all(samples.map(async (s) => {
      const { tx, ty, px, py } = tilePixel(s);
      const values: number[] = [];
      for (const date of dates) {
        const img = await loadTile(date, tx, ty);
        if (!img) continue;
        const i = (py * img.width + px) * 4;
        if (img.data[i + 3] === 0) continue; // transparent = no data
        values.push(img.data[i]);
      }
      return values.length ? median(values) : null;
    }));
    return summariseBrightness(grays, dates);
  }));
}
