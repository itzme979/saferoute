import { describe, expect, it } from 'vitest';
import { parseRss } from '../../api/news';
import { classifyGray, summariseBrightness, tilePixel } from './nightLights';
import { measureLighting } from './streetlights';

describe('measureLighting', () => {
  const route: [number, number][] = [[-79.38, 43.65], [-79.38, 43.652]]; // about 220 m north
  it('reports the share of the route near a light pole', () => {
    const poles = [{ lat: 43.6502, lng: -79.3801 }, { lat: 43.6505, lng: -79.3801 }];
    const m = measureLighting(route, poles, 'test');
    expect(m.poles).toBe(2);
    expect(m.nearLightPct).toBeGreaterThan(0.2);
    expect(m.nearLightPct).toBeLessThan(0.6);
  });

  it('ignores poles farther than 35 m', () => {
    expect(measureLighting(route, [{ lat: 43.651, lng: -79.3810 }], 'test').poles).toBe(0);
  });
});

describe('night lights', () => {
  it('finds the right z8 tile for Toronto', () => {
    const t = tilePixel({ lat: 43.6532, lng: -79.3832 });
    expect([t.tx, t.ty]).toEqual([71, 93]);
  });

  it('classifies grey levels by radiance', () => {
    expect(classifyGray(20)).toBe('dark');
    expect(classifyGray(150)).toBe('dim');
    expect(classifyGray(255)).toBe('bright');
  });

  it('summarises only points with data', () => {
    const s = summariseBrightness([255, 255, 50, null], ['2026-10-01']);
    expect(s?.brightPct).toBeCloseTo(2 / 3);
    expect(s?.darkPct).toBeCloseTo(1 / 3);
    expect(s?.coveragePct).toBe(0.75);
    expect(summariseBrightness([null], [])).toBeNull();
  });
});

describe('parseRss', () => {
  it('extracts headlines and strips the source suffix', () => {
    const xml = `<rss><channel><item><title>Two hurt in stabbing near Kensington Market - CTV News</title><link>https://news.example/a</link>
      <pubDate>Sun, 16 Aug 2026 07:00:00 GMT</pubDate><source url="https://ctv">CTV News</source></item>
      <item><title>Police &amp; residents meet</title><link>javascript:alert(1)</link></item></channel></rss>`;
    expect(parseRss(xml)).toEqual([{ title: 'Two hurt in stabbing near Kensington Market', url: 'https://news.example/a', source: 'CTV News', publishedAt: '2026-08-16T07:00:00.000Z' }]);
  });
});
