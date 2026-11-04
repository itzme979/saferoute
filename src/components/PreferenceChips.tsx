import type { ComponentType } from 'react';
import { cx } from '@/lib/format';
import { WALKING_PREF_META } from '@/services/defaults';
import type { WalkingPreferences } from '@/types';
import {
  IconAccessibility, IconCheck, IconCone, IconCrossing, IconLightbulb, IconShield, IconStairs, IconStore, IconUsers, type IconProps,
} from './icons';

const ICONS: Record<keyof WalkingPreferences, ComponentType<IconProps>> = {
  preferLit: IconLightbulb,
  preferBusy: IconStore,
  avoidIsolated: IconUsers,
  avoidConstruction: IconCone,
  preferAccessible: IconAccessibility,
  avoidStairs: IconStairs,
  fewerCrossings: IconCrossing,
  avoidCrime: IconShield,
};

/** Toggleable route-priority chips (each is an accessible checkbox-style button). */
export function PreferenceChips({ value, onChange, layout = 'wrap', showHints, only }: {
  value: WalkingPreferences;
  onChange: (v: WalkingPreferences) => void;
  layout?: 'wrap' | 'grid';
  showHints?: boolean;
  /** Limits the chips to these priorities. */
  only?: (keyof WalkingPreferences)[] | null;
}) {
  return (
    <div className={cx(layout === 'grid' ? 'grid gap-2.5 sm:grid-cols-2' : 'flex flex-wrap gap-2')} role="group" aria-label="Route priorities">
      {WALKING_PREF_META.filter((m) => !only || only.includes(m.key)).map((m) => {
        const on = !!value[m.key]; // profiles saved before a priority existed lack its key
        const Icon = ICONS[m.key];
        return (
          <button
            key={m.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ ...value, [m.key]: !on })}
            className={cx(
              'group flex items-center gap-2.5 rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              layout === 'grid' ? 'p-3.5' : 'min-h-[40px] px-3 py-1.5',
              on ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-navy-100 bg-white text-slate-600 hover:border-navy/30 hover:text-navy',
            )}
          >
            <span className={cx('flex shrink-0 items-center justify-center rounded-lg', layout === 'grid' ? 'h-9 w-9' : 'h-6 w-6', on ? 'bg-teal-600 text-white' : 'bg-mist text-slate-500')}>
              {on ? <IconCheck size={layout === 'grid' ? 18 : 14} /> : <Icon size={layout === 'grid' ? 18 : 14} />}
            </span>
            <span className="min-w-0">
              <span className={cx('block font-semibold', layout === 'grid' ? 'text-[15px]' : 'text-[13px]')}>{m.label}</span>
              {showHints && <span className="mt-0.5 block text-[12.5px] font-normal leading-snug text-slate-500">{m.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
