import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { config } from '@/lib/config';
import { cx } from '@/lib/format';
import { HAZARD_CATEGORIES } from '@/lib/hazards';
import { useResolvedTheme } from '@/lib/theme';
import { CRIME_GROUP_COLORS } from '@/services/crime';
import type { CrimeGroup, HazardCategory, HazardStatus, LatLng } from '@/types';
import { IconMap, IconPin } from '../icons';

export interface MapRoute {
  id: string;
  coordinates: [number, number][];
  selected?: boolean;
  color?: string;
  label?: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'origin' | 'destination' | 'user' | 'hazard' | 'pick' | 'live';
  label: string;
  category?: HazardCategory;
  status?: HazardStatus;
  active?: boolean;
  onClick?: () => void;
}

export interface MapCrimePoint {
  id: string;
  lat: number;
  lng: number;
  group: CrimeGroup;
}

export interface MapOverlays {
  /** Police-reported incidents, drawn as a heatmap that turns into dots when zoomed in. */
  crime?: MapCrimePoint[] | null;
  /** Raster tile URL template for satellite night lights. */
  nightLights?: string | null;
}

export type MapBBox = [number, number, number, number];

export interface MapViewProps {
  center?: LatLng;
  zoom?: number;
  routes?: MapRoute[];
  markers?: MapMarker[];
  overlays?: MapOverlays;
  /** Called after the map stops moving with the visible bounds [minLng, minLat, maxLng, maxLat]. */
  onViewChange?: (bbox: MapBBox, zoom: number) => void;
  /** Changing this value refits the map to the routes and markers. */
  fitKey?: string;
  onMapClick?: (p: LatLng) => void;
  onRouteClick?: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

const ROUTE_COLORS = ['#3A9487', '#3E7CB1', '#7B6CB1'];
const CRIME_COLORS = CRIME_GROUP_COLORS;

function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function MapView({ center = config.defaultCenter, zoom = 13, routes = [], markers = [], overlays, onViewChange, fitKey, onMapClick, onRouteClick, className, ariaLabel = 'Map' }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState<string | null>(webglSupported() ? null : 'Your browser does not support interactive maps (WebGL is unavailable).');
  const markerEls = useRef(new Map<string, { el: HTMLDivElement; marker: maplibregl.Marker }>());
  const [, force] = useState(0);
  const clickRef = useRef(onMapClick);
  const routeClickRef = useRef(onRouteClick);
  const viewRef = useRef(onViewChange);
  clickRef.current = onMapClick;
  routeClickRef.current = onRouteClick;
  viewRef.current = onViewChange;
  const dark = useResolvedTheme() === 'dark';
  // Keep the view when the map is rebuilt for a theme change.
  const lastView = useRef<{ center: [number, number]; zoom: number } | null>(null);

  // Initialise once per theme (a new style drops the custom layers, so the map is rebuilt).
  useEffect(() => {
    if (failed || !container.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const casing = dark ? '#0E1522' : '#ffffff';
    let m: MlMap;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: dark ? config.mapStyleDarkUrl : config.mapStyleUrl,
        center: lastView.current?.center ?? [center.lng, center.lat],
        zoom: lastView.current?.zoom ?? zoom,
        attributionControl: { compact: true },
        fadeDuration: reduced ? 0 : 200,
        cooperativeGestures: false,
      });
    } catch {
      setFailed('The map could not be started in this browser.');
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    let loaded = false;
    // Slow networks: show a note but keep waiting rather than tearing the map down.
    const timeout = setTimeout(() => {
      if (!loaded) setSlow(true);
    }, 12000);
    m.on('load', () => {
      loaded = true;
      clearTimeout(timeout);
      setSlow(false);
      // Overlays sit underneath routes and markers.
      m.addSource('crime', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'crime-heat', type: 'heatmap', source: 'crime', maxzoom: 16,
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 8, 15, 22],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.2],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(214,154,45,0)', 0.2, 'rgba(214,154,45,0.35)', 0.5, 'rgba(210,96,74,0.55)', 1, 'rgba(150,60,43,0.8)'],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 16, 0],
        },
      });
      m.addLayer({
        id: 'crime-dots', type: 'circle', source: 'crime', minzoom: 14.5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.5, 3, 18, 6],
          'circle-color': ['match', ['get', 'group'], 'personal', CRIME_COLORS.personal, 'property', CRIME_COLORS.property, 'vehicle', CRIME_COLORS.vehicle, CRIME_COLORS.other],
          'circle-stroke-color': casing, 'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 0.85],
        },
      });
      m.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'sort'] }, paint: { 'line-color': casing, 'line-width': ['case', ['get', 'selected'], 10, 7], 'line-opacity': ['case', ['get', 'selected'], 1, 0.8] } });
      m.addLayer({ id: 'routes-line', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'sort'] }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 6, 4], 'line-opacity': ['case', ['get', 'selected'], 1, 0.45] } });
      m.on('click', 'routes-line', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id && routeClickRef.current) {
          e.preventDefault();
          routeClickRef.current(id as string);
        }
      });
      m.on('mouseenter', 'routes-line', () => routeClickRef.current && (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'routes-line', () => (m.getCanvas().style.cursor = ''));
      setReady(true);
      emitView();
    });
    const emitView = () => {
      const b = m.getBounds();
      viewRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom());
    };
    m.on('moveend', emitView);
    m.on('click', (e) => {
      if (e.defaultPrevented) return;
      clickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    m.on('error', (e) => {
      if (!loaded && (e.error as { status?: number })?.status) setFailed('Map tiles could not be loaded. Check your connection; route details below still work.');
    });
    return () => {
      clearTimeout(timeout);
      const c = m.getCenter();
      lastView.current = { center: [c.lng, c.lat], zoom: m.getZoom() };
      markerEls.current.forEach(({ marker }) => marker.remove());
      markerEls.current.clear();
      m.remove();
      map.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, dark]);

  // Routes
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource('routes') as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: routes.map((r, i) => ({
        type: 'Feature',
        properties: { id: r.id, selected: !!r.selected, color: r.color ?? ROUTE_COLORS[i % ROUTE_COLORS.length], sort: r.selected ? 10 : i },
        geometry: { type: 'LineString', coordinates: r.coordinates },
      })),
    });
  }, [routes, ready]);

  // Crime overlay
  const crime = overlays?.crime;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('crime') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: (crime ?? []).map((c) => ({ type: 'Feature', properties: { group: c.group }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } })),
    });
  }, [crime, ready]);

  // Night-lights overlay (raster tiles, added and removed on demand)
  const nightLights = overlays?.nightLights ?? null;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (m.getLayer('night-lights')) m.removeLayer('night-lights');
    if (m.getSource('night-lights')) m.removeSource('night-lights');
    if (!nightLights) return;
    // The layer's native resolution stops at zoom 8; MapLibre scales it up beyond that.
    m.addSource('night-lights', { type: 'raster', tiles: [nightLights], tileSize: 256, maxzoom: 8, attribution: 'Night lights: NASA Black Marble / GIBS' });
    m.addLayer({ id: 'night-lights', type: 'raster', source: 'night-lights', paint: { 'raster-opacity': 0.7, 'raster-resampling': 'nearest' } }, 'crime-heat');
  }, [nightLights, ready]);

  // Markers (DOM elements rendered through React portals)
  const markerKey = markers.map((mk) => `${mk.id}:${mk.lat}:${mk.lng}`).join('|');
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const wanted = new Set(markers.map((mk) => mk.id));
    markerEls.current.forEach((v, id) => {
      if (!wanted.has(id)) {
        v.marker.remove();
        markerEls.current.delete(id);
      }
    });
    for (const mk of markers) {
      const existing = markerEls.current.get(mk.id);
      if (existing) {
        existing.marker.setLngLat([mk.lng, mk.lat]);
        continue;
      }
      const el = document.createElement('div');
      const marker = new maplibregl.Marker({ element: el, anchor: mk.kind === 'hazard' || mk.kind === 'pick' || mk.kind === 'destination' ? 'bottom' : 'center' })
        .setLngLat([mk.lng, mk.lat])
        .addTo(m);
      markerEls.current.set(mk.id, { el, marker });
    }
    force((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, ready]);

  // Fit to content
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || fitKey === undefined) return;
    const pts: [number, number][] = [...routes.flatMap((r) => r.coordinates), ...markers.filter((x) => x.kind !== 'hazard').map((x) => [x.lng, x.lat] as [number, number])];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      m.easeTo({ center: pts[0], zoom: 15, duration: 400 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const w = container.current?.clientWidth ?? 400;
    const pad = Math.min(60, Math.max(24, w * 0.08));
    m.fitBounds([[minX, minY], [maxX, maxY]] as LngLatBoundsLike, { padding: pad, maxZoom: 16, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  // Recentre when center prop changes significantly and no fitKey drives the view.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || fitKey !== undefined) return;
    m.easeTo({ center: [center.lng, center.lat], duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, ready]);

  const markerById = useMemo(() => new Map(markers.map((mk) => [mk.id, mk])), [markers]);

  if (failed) {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-2 bg-mist p-6 text-center', className)} role="img" aria-label="Map unavailable">
        <IconMap size={28} className="text-slate-400" />
        <p className="max-w-xs text-sm text-slate-600">{failed}</p>
      </div>
    );
  }

  const positioned = /(^|\s)(absolute|fixed)(\s|$)/.test(className ?? '');
  return (
    <div className={cx('overflow-hidden bg-mist', !positioned && 'relative', className)}>
      {/* Inline positioning: maplibre-gl.css sets .maplibregl-map { position: relative },
          which would otherwise override a utility class and collapse the map to 0px tall. */}
      <div ref={container} style={{ position: 'absolute', inset: 0 }} role="region" aria-label={ariaLabel} />
      {!ready && <div className="absolute inset-0 animate-pulse bg-mist motion-reduce:animate-none" aria-hidden="true" />}
      {!ready && slow && (
        <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-slate-600" role="status">
          The map is taking longer than usual to load. Everything else on this page still works.
        </p>
      )}
      {Array.from(markerEls.current.entries()).map(([id, { el }]) => {
        const mk = markerById.get(id);
        return mk ? createPortal(<MarkerContent marker={mk} />, el, id) : null;
      })}
    </div>
  );
}

function MarkerContent({ marker: mk }: { marker: MapMarker }) {
  if (mk.kind === 'user' || mk.kind === 'live') {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center" role="img" aria-label={mk.label}>
        <span className="absolute inset-0 rounded-full bg-[#3E7CB1]/40 animate-pulse-ring motion-reduce:hidden" />
        <span className="h-4 w-4 rounded-full border-[3px] border-white bg-[#3E7CB1] shadow" />
      </span>
    );
  }
  if (mk.kind === 'origin') {
    return <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-navy shadow" role="img" aria-label={mk.label} />;
  }
  if (mk.kind === 'destination' || mk.kind === 'pick') {
    return (
      <span className={cx('block drop-shadow', mk.kind === 'pick' ? 'text-teal-700' : 'text-navy')} role="img" aria-label={mk.label}>
        <svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true"><path d="M15 35s12-10.5 12-20.5a12 12 0 1 0-24 0C3 24.5 15 35 15 35z" fill="currentColor" stroke="#fff" strokeWidth="2" /><circle cx="15" cy="14.5" r="4.5" fill="#fff" /></svg>
      </span>
    );
  }
  const meta = mk.category ? HAZARD_CATEGORIES[mk.category] : null;
  const Icon = meta?.icon ?? IconPin;
  const inactive = mk.status && mk.status !== 'active';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        mk.onClick?.();
      }}
      aria-label={mk.label}
      aria-pressed={mk.active}
      className={cx(
        'group relative flex h-9 w-9 items-center justify-center rounded-full rounded-br-none rotate-45 border-2 border-white shadow-md transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/50 motion-reduce:hover:scale-100',
        mk.active && 'scale-110 ring-4 ring-navy/25',
        inactive && 'opacity-60',
      )}
      style={{ background: inactive ? '#94A3B8' : meta?.color ?? '#172B4D' }}
    >
      <span className="-rotate-45 text-white"><Icon size={17} strokeWidth={2.1} /></span>
    </button>
  );
}
