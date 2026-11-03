import { useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { CRIME_GROUP_COLORS, CRIME_GROUP_LABELS } from '@/services/crime';
import { NIGHT_LIGHTS_ATTRIBUTION } from '@/services/nightLights';
import type { CrimeGroup } from '@/types';
import { IconLayers, IconMoon, IconShield, IconStreetlight, IconX } from '../icons';
import { Spinner } from '../ui';

export type LayerStatus =
  | { state: 'off' | 'loading' }
  | { state: 'ready'; note: string }
  | { state: 'unavailable'; note: string };

/**
 * Floating "Layers" control for the map: reported-crime heatmap, city
 * streetlights and satellite night-time brightness, each with its status,
 * source and a short legend.
 */
export function MapLayers({ crime, night, onCrime, onNight, crimeStatus, lights, onLights, lightsStatus, className }: {
  crime: boolean;
  night: boolean;
  onCrime: (v: boolean) => void;
  onNight: (v: boolean) => void;
  crimeStatus: LayerStatus;
  /** The streetlight row appears only when its handler is passed. */
  lights?: boolean;
  onLights?: (v: boolean) => void;
  lightsStatus?: LayerStatus;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = (crime ? 1 : 0) + (night ? 1 : 0) + (lights ? 1 : 0);
  return (
    <div className={cx('pointer-events-auto', className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex h-10 items-center gap-2 rounded-xl bg-white/95 px-3 text-[13px] font-semibold text-navy shadow-soft backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <IconLayers size={18} /> Layers{active > 0 && <span className="rounded-full bg-teal-600 px-1.5 text-[11px] text-white">{active}</span>}
        </button>
      ) : (
        <div className="w-[min(320px,calc(100vw-2rem))] animate-slide-in rounded-2xl bg-white/95 p-3 shadow-lift backdrop-blur" role="group" aria-label="Map layers">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold text-navy">Map layers</p>
            <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Close map layers"><IconX size={16} /></button>
          </div>

          <LayerRow icon={<IconShield size={16} />} label="Reported crime" checked={crime} onChange={onCrime}>
            {crime && crimeStatus.state === 'loading' && <p className="flex items-center gap-1.5"><Spinner size={12} /> Loading police data...</p>}
            {crime && (crimeStatus.state === 'ready' || crimeStatus.state === 'unavailable') && <p>{crimeStatus.note}</p>}
            {crime && crimeStatus.state === 'ready' && (
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" aria-label="Legend">
                {(Object.keys(CRIME_GROUP_LABELS) as CrimeGroup[]).map((g) => (
                  <li key={g} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CRIME_GROUP_COLORS[g] }} aria-hidden="true" />{CRIME_GROUP_LABELS[g]}</li>
                ))}
              </ul>
            )}
            {crime && crimeStatus.state === 'ready' && <p className="mt-1">Shown as a heatmap; zoom in to see individual reports.</p>}
          </LayerRow>

          {onLights && (
            <LayerRow icon={<IconStreetlight size={16} />} label="Streetlights" checked={!!lights} onChange={onLights}>
              {lights && lightsStatus?.state === 'loading' && <p className="flex items-center gap-1.5"><Spinner size={12} /> Loading city data...</p>}
              {lights && (lightsStatus?.state === 'ready' || lightsStatus?.state === 'unavailable') && <p>{lightsStatus.note}</p>}
            </LayerRow>
          )}

          <LayerRow icon={<IconMoon size={16} />} label="Night-time brightness" checked={night} onChange={onNight}>
            {night && (
              <>
                <div className="mt-1 h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg,#070707,#787878,#ffffff)' }} aria-hidden="true" />
                <p className="mt-0.5 flex justify-between"><span>Dark</span><span>Bright</span></p>
                <p className="mt-1">{NIGHT_LIGHTS_ATTRIBUTION}, recent nights. About 500 m per pixel: shows how lit an area is, not individual streets.</p>
              </>
            )}
          </LayerRow>
        </div>
      )}
    </div>
  );
}

function LayerRow({ icon, label, checked, onChange, children }: { icon: ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div className="border-t border-mist py-2 first-of-type:border-t-0">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#3A9487]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-slate-500">{icon}</span>
        <span className="text-[14px] font-semibold text-navy">{label}</span>
      </label>
      {children && <div className="ml-[30px] mt-1 text-[12px] leading-relaxed text-slate-600">{children}</div>}
    </div>
  );
}
