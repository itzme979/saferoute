import { cx, formatDistance, formatDuration } from '@/lib/format';
import type { Comparison } from '@/services/routeAnalysis';
import { modeMeta } from '@/services/travelModes';
import type { WalkingRoute } from '@/types';
import { Notice } from '../ui';
import { routeFactors, TONE_STYLES } from './factors';
import { ROUTE_COLORS } from './RouteCard';
import { TransitLegList } from './TransitLegs';

export function RouteDetails({ route, enrichmentLoading }: { route: WalkingRoute; enrichmentLoading: boolean }) {
  const factors = routeFactors(route, enrichmentLoading);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-mist/70 p-3 text-center">
        <div><p className="text-[11px] font-semibold uppercase text-slate-500">Time</p><p className="font-bold text-navy">{formatDuration(route.durationS)}</p></div>
        <div><p className="text-[11px] font-semibold uppercase text-slate-500">Distance</p><p className="font-bold text-navy">{formatDistance(route.distanceM)}</p></div>
        <div><p className="text-[11px] font-semibold uppercase text-slate-500">{route.mode === 'transit' ? 'Transfers' : 'Turns'}</p><p className="font-bold text-navy">{route.mode === 'transit' ? route.transfers : route.turns}</p></div>
      </div>
      {route.legs && <TransitLegList legs={route.legs} />}
      <ul className="divide-y divide-mist">
        {factors.map((f) => (
          <li key={f.key} className="flex gap-3 py-3">
            <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mist', TONE_STYLES[f.tone])}><f.icon size={18} /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">{f.label}: <span className={f.tone === 'unknown' ? 'text-slate-500' : 'text-charcoal'}>{f.value}</span></p>
              {f.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{f.detail}</p>}
              <p className="mt-1 text-[11px] text-slate-400">Source: {f.source}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-slate-500">Route geometry and timing: {route.provider}. {modeMeta(route.mode).timingNote}</p>
    </div>
  );
}

export function HowComparisonWorks({ comparison }: { comparison: Comparison }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      <p>
        SafeRoute does <strong>not</strong> give routes a safety score. It ranks the routes on screen <em>against each other</em>, using only the information that is available for all of them.
      </p>
      <p>
        For each factor, the best route gets full marks and the others are scaled in between. Your chosen priorities count twice as much as travel time and community reports, which are always included. Factors without data for every route are left out rather than guessed.
      </p>
      <div>
        <p className="font-semibold text-navy">Compared this time</p>
        <p>{comparison.considered.map((c) => c.label).join(', ') || 'Travel time only'}</p>
      </div>
      {comparison.skipped.length > 0 && (
        <div>
          <p className="font-semibold text-navy">Not compared (not enough data)</p>
          <p>{comparison.skipped.map((s) => s.label).join(', ')}</p>
        </div>
      )}
      <Notice tone="neutral">Data can be incomplete or out of date. Use your own judgement, especially on routes you don't know.</Notice>
    </div>
  );
}

export function CompareTable({ routes, comparison, enrichmentLoading }: { routes: WalkingRoute[]; comparison: Comparison; enrichmentLoading: boolean }) {
  const rows = routes.map((r) => routeFactors(r, enrichmentLoading));
  const labels = rows[0]?.map((f) => f.label) ?? [];
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Side-by-side route comparison</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-white p-2 text-left text-xs font-semibold uppercase text-slate-500">Factor</th>
            {routes.map((r, i) => (
              <th key={r.id} scope="col" className="p-2 text-left">
                <span className="flex items-center gap-2 font-bold text-navy"><span className="h-2.5 w-5 rounded-full" style={{ background: ROUTE_COLORS[i] }} aria-hidden="true" />{r.name}</span>
                {comparison.assessments[r.id]?.rank === 1 && <span className="text-[11px] font-semibold text-teal-700">Best match</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="sticky left-0 border-t border-mist bg-white p-2 text-left font-semibold text-slate-600">Time</th>
            {routes.map((r) => <td key={r.id} className="border-t border-mist p-2 font-semibold text-navy">{formatDuration(r.durationS)}</td>)}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 border-t border-mist bg-white p-2 text-left font-semibold text-slate-600">Distance</th>
            {routes.map((r) => <td key={r.id} className="border-t border-mist p-2">{formatDistance(r.distanceM)}</td>)}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 border-t border-mist bg-white p-2 text-left font-semibold text-slate-600">Turns</th>
            {routes.map((r) => <td key={r.id} className="border-t border-mist p-2">{r.turns}</td>)}
          </tr>
          {labels.map((label, li) => (
            <tr key={label}>
              <th scope="row" className="sticky left-0 border-t border-mist bg-white p-2 text-left font-semibold text-slate-600">{label}</th>
              {rows.map((fs, ri) => (
                <td key={routes[ri].id} className={cx('border-t border-mist p-2', fs[li].tone === 'unknown' ? 'text-slate-400' : TONE_STYLES[fs[li].tone])}>{fs[li].value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
