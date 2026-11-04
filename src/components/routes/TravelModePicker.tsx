import type { ComponentType } from 'react';
import { cx } from '@/lib/format';
import { TRAVEL_MODES } from '@/services/travelModes';
import type { TravelMode } from '@/types';
import { IconBike, IconBus, IconCar, IconWalk, type IconProps } from '../icons';

const ICONS: Record<TravelMode, ComponentType<IconProps>> = { walk: IconWalk, transit: IconBus, bike: IconBike, car: IconCar };

export function TravelModePicker({ value, onChange }: { value: TravelMode; onChange: (m: TravelMode) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-mist/70 p-1" role="radiogroup" aria-label="How are you travelling?">
      {TRAVEL_MODES.map((m) => {
        const Icon = ICONS[m.id];
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.id)}
            className={cx(
              'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              on ? 'bg-white text-navy shadow-soft' : 'text-slate-500 hover:text-navy',
            )}
          >
            <Icon size={20} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
