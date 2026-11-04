import type { ComponentType } from 'react';
import { HAZARD_CATEGORIES } from '@/lib/hazards';
import type { WalkingRoute } from '@/types';
import { NIGHT_LIGHTS_ATTRIBUTION } from '@/services/nightLights';
import { modeMeta } from '@/services/travelModes';
import {
  IconAccessibility, IconCone, IconCrossing, IconFlag, IconLightbulb, IconMoon, IconShield, IconStairs, IconStore, IconUsers, type IconProps,
} from '../icons';

export type FactorTone = 'good' | 'neutral' | 'caution' | 'unknown';

export interface Factor {
  key: string;
  icon: ComponentType<IconProps>;
  label: string;
  value: string;
  detail?: string;
  tone: FactorTone;
  source: string;
}

const OSM = 'OpenStreetMap (volunteer-mapped)';
const COMMUNITY = 'SafeRoute community reports';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The facts that apply to this route's travel mode. */
export function routeFactors(r: WalkingRoute, enrichmentLoading = false): Factor[] {
  const keys = modeMeta(r.mode).factors;
  const all = allFactors(r, enrichmentLoading);
  return keys ? all.filter((f) => keys.includes(f.key)) : all;
}

/** Human-readable facts for one route. Unknown values are always shown as unknown, never guessed. */
function allFactors(r: WalkingRoute, enrichmentLoading: boolean): Factor[] {
  const m = r.metrics;
  const unknown = enrichmentLoading ? 'Checking...' : 'No data';
  const source = r.isSample ? 'Sample data (fictional)' : OSM;
  const communitySource = r.isSample ? 'Sample data (fictional)' : COMMUNITY;
  const hazardsByCat = m.hazards.reduce<Record<string, number>>((acc, h) => ({ ...acc, [h.category]: (acc[h.category] ?? 0) + 1 }), {});
  const constructionReports = hazardsByCat.construction ?? 0;
  const otherHazards = m.hazards.length - constructionReports;

  const city = m.cityLighting;
  const osmLighting = m.litPct === null ? 'OpenStreetMap has no lighting mapped along this route.' : `OpenStreetMap records ${pct(m.litPct)} as lit.`;
  const crime = m.crime;
  // undefined = still loading; null = no source covers the route or it didn't respond.
  const crimeUnknown = crime === undefined && !r.isSample ? 'Checking...' : 'No data';
  const night = m.nightBrightness;

  return [
    city
      ? {
        key: 'lighting', icon: IconLightbulb, label: 'Street lighting', source: r.isSample ? source : `${city.source}; ${OSM}`,
        value: `${pct(city.nearLightPct)} near a streetlight`,
        detail: `${city.poles} city light pole${city.poles === 1 ? '' : 's'} within 35 m of the route. A recorded pole doesn't guarantee the light is working. ${osmLighting}`,
        tone: city.nearLightPct >= 0.7 ? 'good' : city.nearLightPct < 0.4 ? 'caution' : 'neutral',
      }
      : {
        key: 'lighting', icon: IconLightbulb, label: 'Street lighting', source,
        value: m.litPct === null ? unknown : `${pct(m.litPct)} mapped as lit`,
        detail: m.litPct === null
          ? 'Lighting is not mapped along this route. Unknown does not mean unlit.'
          : `Lighting is recorded for ${pct(m.lightingCoveragePct ?? 0)} of the route${m.unlitPct ? `, and ${pct(m.unlitPct)} is mapped as unlit` : ''}. The rest is unknown.`,
        tone: m.litPct === null ? 'unknown' : m.litPct >= 0.6 ? 'good' : m.unlitPct && m.unlitPct > 0.2 ? 'caution' : 'neutral',
      },
    {
      key: 'crime', icon: IconShield, label: 'Reported crime', source: crime ? crime.source : 'Police open data (Toronto, Ottawa, Montréal, UK)',
      value: !crime ? crimeUnknown : `${crime.byGroup.personal} against people`,
      detail: !crime
        ? (crime === null ? 'Police crime data is not available for this route: SafeRoute currently covers Toronto, Ottawa, Montréal and England, Wales and Northern Ireland. No data does not mean no crime.' : undefined)
        : `${crime.total} incident${crime.total === 1 ? '' : 's'} reported within ${crime.bufferM} m of the route, ${crime.periodLabel}`
          + `${crime.topCategories.length ? `: ${crime.topCategories.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ')}` : ''}.`
          + ` ${crime.caveat ?? ''}${crime.truncated ? ' This area has more incidents than SafeRoute loads, so counts are incomplete.' : ''}`,
      tone: !crime ? 'unknown' : crime.byGroup.personal === 0 ? 'good' : 'neutral',
    },
    {
      key: 'night', icon: IconMoon, label: 'Area brightness at night', source: `${NIGHT_LIGHTS_ATTRIBUTION} (satellite, about 500 m per pixel)`,
      value: !night ? (night === undefined && !r.isSample ? 'Checking...' : 'No data')
        : night.brightPct >= 0.8 ? 'Bright urban area' : night.darkPct >= 0.3 ? `${pct(night.darkPct)} in dark areas` : 'Mostly lit area',
      detail: night
        ? `From satellite images of recent nights: ${pct(night.brightPct)} bright, ${pct(night.dimPct)} dim, ${pct(night.darkPct)} dark. This shows the surrounding area, not individual streets, and is not used to rank routes.`
        : 'Satellite night-time brightness could not be loaded for this route.',
      tone: !night ? 'unknown' : night.darkPct >= 0.3 ? 'caution' : 'neutral',
    },
    {
      key: 'hazards', icon: IconFlag, label: 'Community reports', source: communitySource,
      value: otherHazards === 0 ? 'None active' : `${otherHazards} active`,
      detail: otherHazards === 0 ? 'No active reports within 30 m of this route.' : Object.entries(hazardsByCat).filter(([c]) => c !== 'construction').map(([c, n]) => `${n} ${HAZARD_CATEGORIES[c as keyof typeof HAZARD_CATEGORIES].short.toLowerCase()}`).join(', '),
      tone: otherHazards === 0 ? 'good' : 'caution',
    },
    {
      key: 'construction', icon: IconCone, label: 'Construction', source: `${communitySource} and ${source}`,
      value: constructionReports + (m.osmConstruction ?? 0) === 0 ? 'None known' : `${constructionReports + (m.osmConstruction ?? 0)} known`,
      detail: m.osmConstruction === null ? 'Only community reports were checked; mapped construction data was unavailable.' : undefined,
      tone: constructionReports + (m.osmConstruction ?? 0) === 0 ? 'good' : 'caution',
    },
    {
      key: 'activity', icon: IconUsers, label: 'Pedestrian activity', source: 'No data source connected',
      value: 'Not available',
      detail: 'SafeRoute does not have live pedestrian data, so it never estimates how busy a street is.',
      tone: 'unknown',
    },
    {
      key: 'places', icon: IconStore, label: 'Shops and public places', source,
      value: m.publicPlaces === null ? unknown : `${m.publicPlaces} along the route`,
      detail: m.publicPlaces === null ? undefined : `Mapped shops, cafés, pharmacies, libraries and similar places within 40 m. Opening hours are not considered.${m.isolatedPct ? ` About ${pct(m.isolatedPct)} of the route is on paths with no mapped lighting or nearby places.` : ''}`,
      tone: m.publicPlaces === null ? 'unknown' : 'neutral',
    },
    {
      key: 'access', icon: IconAccessibility, label: 'Accessibility', source: `${source} and ${communitySource}`,
      value: m.stairs === null ? unknown : accessSummary(r),
      detail: m.stairs === null ? undefined : `${m.stairs} mapped set${m.stairs === 1 ? '' : 's'} of stairs, ${pct(m.unpavedPct ?? 0)} unpaved surface, ${pct(m.noSidewalkPct ?? 0)} on roads mapped without sidewalks, ${hazardsByCat.accessibility ?? 0} accessibility report${hazardsByCat.accessibility === 1 ? '' : 's'}. Curb ramps are rarely mapped.`,
      tone: m.stairs === null ? 'unknown' : accessSummary(r) === 'No known barriers' ? 'good' : 'caution',
    },
    {
      key: 'stairs', icon: IconStairs, label: 'Stairs', source,
      value: m.stairs === null ? unknown : m.stairs === 0 ? 'None mapped' : `${m.stairs} mapped`,
      tone: m.stairs === null ? 'unknown' : m.stairs === 0 ? 'good' : 'caution',
    },
    {
      key: 'crossings', icon: IconCrossing, label: 'Mapped crossings', source,
      value: m.crossings === null ? unknown : `${m.crossings}`,
      detail: 'Marked pedestrian crossings along the route. Unmarked crossings may not be counted.',
      tone: m.crossings === null ? 'unknown' : 'neutral',
    },
  ];
}

function accessSummary(r: WalkingRoute): string {
  const m = r.metrics;
  const issues = (m.stairs ?? 0) + ((m.unpavedPct ?? 0) > 0.05 ? 1 : 0) + ((m.noSidewalkPct ?? 0) > 0.05 ? 1 : 0) + m.hazards.filter((h) => h.category === 'accessibility').length;
  return issues === 0 ? 'No known barriers' : `${issues} possible barrier${issues === 1 ? '' : 's'}`;
}

export const TONE_STYLES: Record<FactorTone, string> = {
  good: 'text-teal-700',
  neutral: 'text-navy',
  caution: 'text-amber-700',
  unknown: 'text-slate-400',
};
