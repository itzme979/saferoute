import { cx, formatDistance, formatDuration } from '@/lib/format';
import type { RouteAssessment } from '@/services/routeAnalysis';
import type { WalkingRoute } from '@/types';
import { IconCheckCircle, IconChevronRight, IconClock, IconRuler, IconSparkle, IconTurn } from '../icons';
import { Badge, SampleBadge } from '../ui';
import { routeFactors, TONE_STYLES } from './factors';
import { TransitLegSummary } from './TransitLegs';

export const ROUTE_COLORS = ['#3A9487', '#3E7CB1', '#7B6CB1'];

export function RouteCard({ route, index, assessment, selected, fastest, enrichmentLoading, onSelect, onDetails }: {
  route: WalkingRoute;
  index: number;
  assessment?: RouteAssessment;
  selected: boolean;
  fastest: boolean;
  enrichmentLoading: boolean;
  onSelect: () => void;
  onDetails: () => void;
}) {
  const factors = routeFactors(route, enrichmentLoading).filter((f) => ['lighting', 'crime', 'hazards', 'access'].includes(f.key));
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];

  return (
    <article
      className={cx(
        'relative rounded-2xl border bg-white transition duration-200',
        selected ? 'border-transparent shadow-lift ring-2 ring-navy' : 'border-navy/[0.08] shadow-soft hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0',
      )}
      aria-label={`${route.name}${assessment?.rank === 1 ? ', best match for your priorities' : ''}`}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-8 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-bold text-navy">{route.name}</h3>
              {assessment?.rank === 1 && <Badge tone="teal" icon={<IconSparkle size={12} />}>Best match for your priorities</Badge>}
              {fastest && <Badge tone="sky">Fastest</Badge>}
              {route.isSample && <SampleBadge />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><IconClock size={16} className="text-slate-400" /><strong className="font-semibold text-navy">{formatDuration(route.durationS)}</strong></span>
              <span className="inline-flex items-center gap-1.5"><IconRuler size={16} className="text-slate-400" />{formatDistance(route.distanceM)}</span>
              {route.mode === 'transit' ? (
                <span className="inline-flex items-center gap-1.5"><IconTurn size={16} className="text-slate-400" />{route.transfers === 0 ? 'No transfers' : `${route.transfers} transfer${route.transfers === 1 ? '' : 's'}`}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><IconTurn size={16} className="text-slate-400" />{route.turns} turn{route.turns === 1 ? '' : 's'}</span>
              )}
            </div>
            {route.legs && <TransitLegSummary legs={route.legs} />}
          </div>
          {selected && <IconCheckCircle size={22} className="shrink-0 text-navy" />}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {factors.map((f) => (
            <div key={f.key} className="flex min-w-0 items-start gap-2">
              <f.icon size={16} className={cx('mt-0.5 shrink-0', TONE_STYLES[f.tone])} />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</dt>
                <dd className={cx('truncate text-[13px] font-semibold', f.tone === 'unknown' ? 'text-slate-500' : 'text-charcoal')}>{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {assessment && (assessment.strengths.length > 0 || assessment.tradeoffs.length > 0) && (
          <div className="mt-4 rounded-xl bg-mist/70 p-3 text-[13px] leading-relaxed text-slate-700">
            <p className="font-semibold text-navy">Why this ranking</p>
            {assessment.strengths.length > 0 && <p>Compared with the other options: {assessment.strengths.join('; ')}.</p>}
            {assessment.tradeoffs.length > 0 && <p className="text-slate-600">Trade-offs: {assessment.tradeoffs.join('; ')}.</p>}
          </div>
        )}
      </button>
      <div className="border-t border-mist px-4 py-2 sm:px-5">
        <button type="button" onClick={onDetails} className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
          View all details <IconChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}
