import { distanceToLine } from '@/lib/geo';
import { formatDuration } from '@/lib/format';
import type { HazardReport, RouteMetrics, WalkingPreferences, WalkingRoute } from '@/types';
import type { OsmRouteMetrics } from './osmEnrichment';

export const HAZARD_ROUTE_BUFFER_M = 30;

export function hazardsOnRoute(coords: [number, number][], hazards: HazardReport[]): RouteMetrics['hazards'] {
  return hazards
    .filter((h) => h.status === 'active' && distanceToLine(h, coords) <= HAZARD_ROUTE_BUFFER_M)
    .map((h) => ({ id: h.id, category: h.category, isSample: h.isSample }));
}

export function buildMetrics(osm: OsmRouteMetrics | null, hazards: RouteMetrics['hazards']): RouteMetrics {
  // If almost none of the route matched mapped ways, the OSM data is not
  // trustworthy for this route: report everything as unknown.
  const usable = osm && osm.matchPct >= 0.3 ? osm : null;
  const lightingKnown = usable && usable.lightingCoveragePct > 0;
  return {
    litPct: lightingKnown ? usable.litPct : null,
    unlitPct: lightingKnown ? usable.unlitPct : null,
    lightingCoveragePct: usable ? usable.lightingCoveragePct : null,
    stairs: usable ? usable.stairs : null,
    crossings: usable ? usable.crossings : null,
    publicPlaces: usable ? usable.publicPlaces : null,
    isolatedPct: usable ? usable.isolatedPct : null,
    unpavedPct: usable ? usable.unpavedPct : null,
    noSidewalkPct: usable ? usable.noSidewalkPct : null,
    osmConstruction: usable ? usable.osmConstruction : null,
    hazards,
  };
}

// ---------------------------------------------------------------------------
// Preference-based comparison
// ---------------------------------------------------------------------------

export type CriterionKey =
  | 'time' | 'hazards' | 'lighting' | 'crime' | 'busy' | 'isolated' | 'construction' | 'accessible' | 'stairs' | 'crossings';

/** Official city light-pole data when the route is covered by it, otherwise OpenStreetMap. */
export const lightingValue = (r: WalkingRoute): number | null =>
  r.metrics.cityLighting ? r.metrics.cityLighting.nearLightPct : r.metrics.litPct;

interface Criterion {
  key: CriterionKey;
  label: string;
  /** Preference that enables this criterion; undefined = always considered. */
  pref?: keyof WalkingPreferences;
  weight: number;
  higherIsBetter: boolean;
  value: (r: WalkingRoute) => number | null;
  describe: (v: number) => string;
}

const constructionCount = (r: WalkingRoute) =>
  r.metrics.hazards.filter((h) => h.category === 'construction').length + (r.metrics.osmConstruction ?? 0);

export const CRITERIA: Criterion[] = [
  { key: 'time', label: 'Walking time', weight: 1, higherIsBetter: false, value: (r) => r.durationS, describe: (v) => `shortest walk (${formatDuration(v)})` },
  { key: 'hazards', label: 'Community reports', weight: 1, higherIsBetter: false, value: (r) => r.metrics.hazards.length, describe: (v) => (v === 0 ? 'no active community reports' : `fewest active reports (${v})`) },
  { key: 'lighting', label: 'Street lighting', pref: 'preferLit', weight: 2, higherIsBetter: true, value: lightingValue, describe: (v) => `most street lighting (${Math.round(v * 100)}% of route)` },
  { key: 'crime', label: 'Reported crime nearby', pref: 'avoidCrime', weight: 2, higherIsBetter: false,
    value: (r) => (r.metrics.crime ? r.metrics.crime.byGroup.personal : null),
    describe: (v) => (v === 0 ? 'no police-reported crimes against people nearby' : `fewest police-reported crimes against people nearby (${v})`) },
  { key: 'busy', label: 'Shops and public places', pref: 'preferBusy', weight: 2, higherIsBetter: true, value: (r) => (r.metrics.publicPlaces === null ? null : r.metrics.publicPlaces / Math.max(0.2, r.distanceM / 1000)), describe: (v) => `most shops and public places along the way (${v.toFixed(0)} per km)` },
  { key: 'isolated', label: 'Isolated paths', pref: 'avoidIsolated', weight: 2, higherIsBetter: false, value: (r) => r.metrics.isolatedPct, describe: (v) => (v === 0 ? 'no isolated path sections found' : `least time on isolated paths (${Math.round(v * 100)}%)`) },
  { key: 'construction', label: 'Construction', pref: 'avoidConstruction', weight: 2, higherIsBetter: false, value: (r) => (r.metrics.osmConstruction === null ? r.metrics.hazards.filter((h) => h.category === 'construction').length : constructionCount(r)), describe: (v) => (v === 0 ? 'no known construction' : `least known construction (${v})`) },
  { key: 'accessible', label: 'Accessibility', pref: 'preferAccessible', weight: 2, higherIsBetter: false,
    value: (r) => (r.metrics.unpavedPct === null || r.metrics.noSidewalkPct === null || r.metrics.stairs === null ? null
      : r.metrics.unpavedPct + r.metrics.noSidewalkPct + r.metrics.stairs * 0.1 + r.metrics.hazards.filter((h) => h.category === 'accessibility').length * 0.1),
    describe: () => 'fewest known accessibility barriers' },
  { key: 'stairs', label: 'Stairs', pref: 'avoidStairs', weight: 2, higherIsBetter: false, value: (r) => r.metrics.stairs, describe: (v) => (v === 0 ? 'no mapped stairs' : `fewest mapped stairs (${v})`) },
  { key: 'crossings', label: 'Road crossings', pref: 'fewerCrossings', weight: 2, higherIsBetter: false, value: (r) => r.metrics.crossings, describe: (v) => `fewest mapped crossings (${v})` },
];

export interface RouteAssessment {
  routeId: string;
  rank: number;
  /** 0–100 relative match against the user's priorities among these routes only. */
  match: number;
  strengths: string[];
  tradeoffs: string[];
}

export interface Comparison {
  assessments: Record<string, RouteAssessment>;
  considered: { key: CriterionKey; label: string }[];
  skipped: { key: CriterionKey; label: string; reason: string }[];
}

/**
 * Ranks routes relative to each other for the user's chosen priorities.
 * This is NOT a safety score: it only compares the routes on screen, using
 * the data actually available, and criteria with missing data are skipped.
 */
export function compareRoutes(routes: WalkingRoute[], prefs: WalkingPreferences): Comparison {
  const active = CRITERIA.filter((c) => !c.pref || prefs[c.pref]);
  const considered: Comparison['considered'] = [];
  const skipped: Comparison['skipped'] = [];
  const scores: Record<string, number> = {};
  const totals: Record<string, number> = {};
  const strengths: Record<string, string[]> = {};
  const tradeoffs: Record<string, string[]> = {};
  for (const r of routes) {
    scores[r.id] = 0;
    totals[r.id] = 0;
    strengths[r.id] = [];
    tradeoffs[r.id] = [];
  }

  for (const c of active) {
    const values = routes.map((r) => c.value(r));
    if (values.some((v) => v === null)) {
      skipped.push({ key: c.key, label: c.label, reason: 'Not enough mapped data for every route' });
      continue;
    }
    considered.push({ key: c.key, label: c.label });
    const nums = values as number[];
    const best = c.higherIsBetter ? Math.max(...nums) : Math.min(...nums);
    const worst = c.higherIsBetter ? Math.min(...nums) : Math.max(...nums);
    const range = Math.abs(best - worst);
    routes.forEach((r, i) => {
      const v = nums[i];
      const norm = range < 1e-9 ? 1 : 1 - Math.abs(best - v) / range;
      scores[r.id] += norm * c.weight;
      totals[r.id] += c.weight;
      if (routes.length > 1 && range > 1e-9) {
        if (v === best) strengths[r.id].push(c.describe(v));
        else if (v === worst && c.key !== 'time') tradeoffs[r.id].push(`${c.label.toLowerCase()}: weakest of the options`);
        else if (v === worst && c.key === 'time') tradeoffs[r.id].push(`longest walk (${formatDuration(v)})`);
      } else if (routes.length === 1 || range < 1e-9) {
        if ((c.key === 'hazards' || c.key === 'stairs' || c.key === 'construction' || c.key === 'crime') && v === 0) strengths[r.id].push(c.describe(v));
      }
    });
  }

  const ordered = [...routes].sort((a, b) => scores[b.id] / (totals[b.id] || 1) - scores[a.id] / (totals[a.id] || 1) || a.durationS - b.durationS);
  const assessments: Record<string, RouteAssessment> = {};
  ordered.forEach((r, i) => {
    assessments[r.id] = {
      routeId: r.id,
      rank: i + 1,
      match: Math.round((scores[r.id] / (totals[r.id] || 1)) * 100),
      strengths: strengths[r.id],
      tradeoffs: tradeoffs[r.id],
    };
  });
  return { assessments, considered, skipped };
}

export function routeSummary(r: WalkingRoute): string[] {
  const m = r.metrics;
  const out: string[] = [];
  if (m.cityLighting) out.push(`${Math.round(m.cityLighting.nearLightPct * 100)}% near a city streetlight`);
  else if (m.litPct !== null) out.push(`${Math.round(m.litPct * 100)}% mapped lighting`);
  if (m.crime) out.push(`${m.crime.byGroup.personal} police-reported crimes against people within ${m.crime.bufferM} m (${m.crime.periodLabel})`);
  if (m.hazards.length) out.push(`${m.hazards.length} community report${m.hazards.length === 1 ? '' : 's'} nearby`);
  if (m.stairs) out.push(`${m.stairs} set${m.stairs === 1 ? '' : 's'} of stairs`);
  if (m.crossings !== null) out.push(`${m.crossings} mapped crossings`);
  return out;
}
