import { timeAgo } from '@/lib/format';
import { CRIME_GROUP_COLORS, CRIME_GROUP_LABELS, type AreaCrimeSummary, type CrimeContext } from '@/services/crime';
import type { AreaNews } from '@/services/news';
import type { CrimeGroup } from '@/types';
import { IconNews, IconPin, IconShield } from '../icons';
import { Card, Spinner } from '../ui';

export type Loadable<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string };

/**
 * Police-reported crime and recent local news around the start and the
 * destination. Purely informational: news never affects route ranking.
 */
export function AreaSafetyCard({ originLabel, destinationLabel, crime, originNews, destinationNews }: {
  originLabel: string;
  destinationLabel: string;
  crime: Loadable<CrimeContext | null>;
  originNews: Loadable<AreaNews | null>;
  destinationNews: Loadable<AreaNews | null>;
}) {
  const ctx = crime.state === 'ready' ? crime.data : null;
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-bold text-navy"><IconShield size={18} className="text-slate-500" /> About these areas</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">Police-reported crime and recent local news near your start and destination.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Place title="Start" label={originLabel} crime={crime} summary={ctx?.origin ?? null} news={originNews} />
        <Place title="Destination" label={destinationLabel} crime={crime} summary={ctx?.destination ?? null} news={destinationNews} />
      </div>

      {ctx && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Crime: <a className="underline hover:text-slate-600" href={ctx.source.url} target="_blank" rel="noreferrer">{ctx.source.name}</a>, {ctx.period.label}. {ctx.source.caveat}
        </p>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        Reported crime reflects what was reported to police, not how safe a street is right now. News headlines are context only and are not used to rank routes.
      </p>
    </Card>
  );
}

function Place({ title, label, crime, summary, news }: {
  title: string;
  label: string;
  crime: Loadable<CrimeContext | null>;
  summary: AreaCrimeSummary | null;
  news: Loadable<AreaNews | null>;
}) {
  return (
    <section className="min-w-0 rounded-xl bg-mist/70 p-3" aria-label={`${title}: ${label}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><IconPin size={12} /> {title}</p>
      <p className="truncate text-sm font-semibold text-navy" title={label}>{label}</p>

      <div className="mt-2">
        {crime.state === 'loading' && <p className="flex items-center gap-1.5 text-[13px] text-slate-500"><Spinner size={12} /> Loading police data...</p>}
        {crime.state === 'error' && <p className="text-[13px] text-slate-500">{crime.message}</p>}
        {crime.state === 'ready' && !crime.data && <p className="text-[13px] text-slate-500">No police open data for this area yet. SafeRoute covers Toronto, Ottawa, Montréal and England, Wales and Northern Ireland.</p>}
        {summary && <CrimeBreakdown s={summary} />}
      </div>

      <div className="mt-3 border-t border-white pt-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600"><IconNews size={14} /> Recent local news{news.state === 'ready' && news.data ? ` (${news.data.area})` : ''}</p>
        {news.state === 'loading' && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-500"><Spinner size={12} /> Searching news...</p>}
        {news.state === 'error' && <p className="mt-1 text-[13px] text-slate-500">{news.message}</p>}
        {news.state === 'ready' && (!news.data || news.data.items.length === 0) && <p className="mt-1 text-[13px] text-slate-500">No safety-related headlines found for this area in the last 60 days.</p>}
        {news.state === 'ready' && news.data && news.data.items.length > 0 && (
          <ul className="mt-1 space-y-1.5">
            {news.data.items.slice(0, 4).map((n) => (
              <li key={n.url} className="text-[13px] leading-snug">
                <a href={n.url} target="_blank" rel="noreferrer" className="font-medium text-navy hover:underline">{n.title}</a>
                <span className="block text-[11px] text-slate-500">{[n.source, n.publishedAt && timeAgo(n.publishedAt)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
        {news.state === 'ready' && news.data && news.data.items.length > 0 && <p className="mt-1.5 text-[11px] text-slate-400">Headlines via {news.data.provider}. A story may concern anywhere in this area.</p>}
      </div>
    </section>
  );
}

function CrimeBreakdown({ s }: { s: AreaCrimeSummary }) {
  const groups = (Object.keys(CRIME_GROUP_LABELS) as CrimeGroup[]).filter((g) => s.byGroup[g] > 0);
  const max = Math.max(1, ...groups.map((g) => s.byGroup[g]));
  return (
    <div>
      <p className="text-[13px] text-slate-700"><strong className="text-navy">{s.total}</strong> incident{s.total === 1 ? '' : 's'} reported within {s.radiusM} m</p>
      {groups.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {groups.map((g) => (
            <li key={g} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-[12px] text-slate-600">
              <span className="truncate">{CRIME_GROUP_LABELS[g]}</span>
              <span className="h-1.5 rounded-full bg-white" aria-hidden="true">
                <span className="block h-1.5 rounded-full" style={{ width: `${(s.byGroup[g] / max) * 100}%`, background: CRIME_GROUP_COLORS[g] }} />
              </span>
              <span className="tabular-nums font-semibold text-navy">{s.byGroup[g]}</span>
            </li>
          ))}
        </ul>
      )}
      {s.topCategories.length > 0 && <p className="mt-1.5 text-[12px] text-slate-500">Most common: {s.topCategories.slice(0, 3).map((c) => c.label.toLowerCase()).join(', ')}</p>}
    </div>
  );
}
