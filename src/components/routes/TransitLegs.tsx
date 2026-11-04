import { cx, formatDuration, formatTime } from '@/lib/format';
import type { TransitLeg } from '@/types';
import { IconBus, IconChevronRight, IconTrain, IconWalk, type IconProps } from '../icons';
import type { ComponentType } from 'react';

function legIcon(leg: Pick<TransitLeg, 'kind'>): ComponentType<IconProps> {
  if (leg.kind === 'walk') return IconWalk;
  return leg.kind === 'bus' ? IconBus : IconTrain;
}

/** One line for a route card: Walk 6 min > Bus 7 > Line 1. */
export function TransitLegSummary({ legs }: { legs: TransitLeg[] }) {
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-navy" aria-label="Trip steps">
      {legs.map((leg, i) => {
        const Icon = legIcon(leg);
        return (
          <li key={i} className="inline-flex items-center gap-1">
            {i > 0 && <IconChevronRight size={12} className="text-slate-400" />}
            <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5', leg.kind === 'walk' ? 'text-slate-600' : 'bg-sky-100')}>
              <Icon size={13} />{leg.kind === 'walk' ? formatDuration(leg.durationS) : leg.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Each step of a transit trip with its times and stops. */
export function TransitLegList({ legs }: { legs: TransitLeg[] }) {
  return (
    <ol className="space-y-2.5">
      {legs.map((leg, i) => {
        const Icon = legIcon(leg);
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mist text-navy"><Icon size={16} /></span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-navy">{leg.label}{leg.headsign ? `: ${leg.headsign}` : ''}</p>
              <p className="text-[13px] text-slate-600">{formatTime(leg.startTime)} {leg.from} to {formatTime(leg.endTime)} {leg.to}</p>
              <p className="text-[12px] text-slate-500">{formatDuration(leg.durationS)}{leg.agency ? ` · ${leg.agency}` : ''}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
