import { lazy, Suspense } from 'react';
import { cx } from '@/lib/format';
import type { MapViewProps } from './MapView';

/** Shown when the map's code can't be downloaded, so a bad connection can't take down the page around it. */
function MapUnavailable({ className }: MapViewProps) {
  return <div className={cx('flex items-center justify-center bg-mist p-4 text-center text-sm text-slate-600', className)} role="status">The map could not be loaded. Check your connection.</div>;
}

const MapView = lazy(() => import('./MapView').catch(() => ({ default: MapUnavailable })));

/** Map loaded on demand so public pages stay fast. */
export function LazyMap(props: MapViewProps) {
  return (
    <Suspense fallback={<div className={cx('animate-pulse bg-mist motion-reduce:animate-none', props.className)} aria-label="Loading map" />}>
      <MapView {...props} />
    </Suspense>
  );
}

export type { MapBBox, MapCrimePoint, MapMarker, MapOverlays, MapRoute } from './MapView';
