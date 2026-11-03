import { lazy, Suspense } from 'react';
import { cx } from '@/lib/format';
import type { MapViewProps } from './MapView';

const MapView = lazy(() => import('./MapView'));

/** Map loaded on demand so public pages stay fast. */
export function LazyMap(props: MapViewProps) {
  return (
    <Suspense fallback={<div className={cx('animate-pulse bg-mist motion-reduce:animate-none', props.className)} aria-label="Loading map" />}>
      <MapView {...props} />
    </Suspense>
  );
}

export type { MapBBox, MapCrimePoint, MapMarker, MapOverlays, MapRoute } from './MapView';
