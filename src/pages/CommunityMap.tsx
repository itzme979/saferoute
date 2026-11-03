import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HazardDetails } from '@/components/hazards/HazardDetails';
import { ReportHazardDialog } from '@/components/hazards/ReportHazardDialog';
import { IconCrosshair, IconFilter, IconFlag, IconPin, IconSos, IconX } from '@/components/icons';
import { LazyMap, type MapBBox, type MapMarker, type MapOverlays } from '@/components/map/LazyMap';
import { MapLayers, type LayerStatus } from '@/components/safety/MapLayers';
import { Button, ButtonLink, Notice, SampleBadge, Spinner, Toggle } from '@/components/ui';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { cx, timeAgo } from '@/lib/format';
import { FILTER_GROUPS, HAZARD_CATEGORIES, type FilterGroup } from '@/lib/hazards';
import { getCurrentPosition } from '@/lib/location';
import { backend, errorMessage } from '@/services';
import { loadCrimeOverlay, type CrimeOverlay } from '@/services/crime';
import { nightLightDates, nightLightTileUrl } from '@/services/nightLights';
import { loadStreetlightOverlay, STREETLIGHT_COVERAGE, type StreetlightOverlay } from '@/services/streetlights';
import type { HazardCategory, HazardReport, LatLng } from '@/types';

/** Below this zoom the visible area is too large to load individual crime reports. */
const CRIME_MIN_ZOOM = 12.5;
/** Below this zoom the visible area holds too many light poles to draw. */
const LIGHTS_MIN_ZOOM = 13.5;

export default function CommunityMap() {
  const toast = useToast();
  const { notify } = useNotifications();
  const [params, setParams] = useSearchParams();
  const hazards = useAsync(() => backend.listHazards(), []);
  const [filters, setFilters] = useState<Set<FilterGroup>>(new Set(FILTER_GROUPS.map((f) => f.id)));
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<LatLng | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [center, setCenter] = useState<LatLng>(config.defaultCenter);
  const [locating, setLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // On by default so police open data is visible straight away in covered cities.
  const [showCrime, setShowCrime] = useState(true);
  const [showNight, setShowNight] = useState(false);
  const [view, setView] = useState<{ bbox: MapBBox; zoom: number } | null>(null);
  const [crime, setCrime] = useState<{ state: 'loading' } | { state: 'ready'; data: CrimeOverlay | null } | { state: 'error' } | null>(null);
  const loadedBox = useRef<MapBBox | null>(null);
  const [showLights, setShowLights] = useState(true);
  const [lights, setLights] = useState<{ state: 'loading' } | { state: 'ready'; data: StreetlightOverlay | null } | { state: 'error' } | null>(null);
  // Set once someone starts using the map, so a late location fix doesn't pull it away.
  const engaged = useRef(false);

  // Open on the person's own area rather than downtown Toronto.
  useEffect(() => {
    if (config.isSampleDemo || params.get('report')) return;
    let cancelled = false;
    getCurrentPosition()
      .then((p) => { if (!cancelled && !engaged.current) setCenter({ lat: p.lat, lng: p.lng }); })
      .catch(() => { /* Keep the default centre; "Near me" explains any problem. */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poles come from cached static tiles, so reloading on every move is cheap.
  useEffect(() => {
    if (!showLights || !view || view.zoom < LIGHTS_MIN_ZOOM) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLights((prev) => (prev?.state === 'ready' ? prev : { state: 'loading' }));
      loadStreetlightOverlay(view.bbox)
        .then((data) => !cancelled && setLights({ state: 'ready', data }))
        .catch(() => !cancelled && setLights({ state: 'error' }));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showLights, view]);

  const lightsStatus: LayerStatus = useMemo(() => {
    if (view && view.zoom < LIGHTS_MIN_ZOOM) return { state: 'unavailable', note: 'Zoom in to see streetlights.' };
    if (!lights || lights.state === 'loading') return { state: 'loading' };
    if (lights.state === 'error') return { state: 'unavailable', note: 'Streetlight data could not be loaded right now.' };
    if (!lights.data) return { state: 'unavailable', note: `No open streetlight data for this area. Covered: ${STREETLIGHT_COVERAGE}.` };
    const d = lights.data;
    return { state: 'ready', note: `${d.poles.length.toLocaleString()} light poles nearby. A recorded pole doesn't guarantee the light is working. Source: ${d.sources.join('; ')}.` };
  }, [lights, view]);

  // Reload crime reports when the layer is on and the map moves outside what's loaded.
  useEffect(() => {
    if (!showCrime || !view || view.zoom < CRIME_MIN_ZOOM) return;
    const [a, b, c, d] = view.bbox;
    const have = loadedBox.current;
    if (have && a >= have[0] && b >= have[1] && c <= have[2] && d <= have[3]) return;
    // Load a margin around the view so small pans don't trigger new requests.
    const w = (c - a) * 0.25;
    const h = (d - b) * 0.25;
    const box: MapBBox = [a - w, b - h, c + w, d + h];
    let cancelled = false;
    const t = setTimeout(() => {
      setCrime({ state: 'loading' });
      loadCrimeOverlay(box)
        .then((data) => {
          if (cancelled) return;
          loadedBox.current = box;
          setCrime({ state: 'ready', data });
        })
        .catch(() => !cancelled && setCrime({ state: 'error' }));
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showCrime, view]);

  const crimeStatus: LayerStatus = useMemo(() => {
    if (view && view.zoom < CRIME_MIN_ZOOM && !(crime?.state === 'ready' && crime.data)) return { state: 'unavailable', note: 'Zoom in to see reported crime.' };
    if (!crime || crime.state === 'loading') return { state: 'loading' };
    if (crime.state === 'error') return { state: 'unavailable', note: 'Police crime data could not be loaded right now.' };
    if (!crime.data) return { state: 'unavailable', note: 'No police open data for this area. Covered: Toronto, Ottawa, Montréal, England, Wales and Northern Ireland.' };
    const o = crime.data;
    return { state: 'ready', note: `${o.incidents.length.toLocaleString()} reports, ${o.period.label}.${o.truncated ? ' Busy area: showing the most recent reports only.' : ''} Source: ${o.source.name}.` };
  }, [crime, view]);

  const overlays: MapOverlays = useMemo(() => ({
    crime: showCrime && crime?.state === 'ready' ? crime.data?.incidents ?? null : null,
    streetlights: showLights && lights?.state === 'ready' && view && view.zoom >= LIGHTS_MIN_ZOOM ? lights.data?.poles ?? null : null,
    nightLights: showNight ? nightLightTileUrl(nightLightDates()[0]) : null,
  }), [showCrime, showNight, crime, showLights, lights, view]);

  // Deep links: ?report=new or ?report=<id>
  useEffect(() => {
    const r = params.get('report');
    if (!r) return;
    if (r === 'new') startReport();
    else setSelectedId(r);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sel = hazards.data?.find((h) => h.id === selectedId);
    if (sel) setCenter({ lat: sel.lat, lng: sel.lng });
  }, [selectedId, hazards.data]);

  const visible = useMemo(() => (hazards.data ?? []).filter((h) =>
    filters.has(HAZARD_CATEGORIES[h.category].filter) && (showInactive || h.status === 'active')), [hazards.data, filters, showInactive]);
  const selected = (hazards.data ?? []).find((h) => h.id === selectedId) ?? null;

  const markers: MapMarker[] = useMemo(() => [
    ...visible.map((h) => ({
      id: h.id, lat: h.lat, lng: h.lng, kind: 'hazard' as const, category: h.category, status: h.status, active: h.id === selectedId,
      label: `${HAZARD_CATEGORIES[h.category].label}, ${h.status}, reported ${timeAgo(h.createdAt)}. Open details.`,
      onClick: () => { engaged.current = true; setSelectedId(h.id); },
    })),
    ...(pick ? [{ id: 'pick', lat: pick.lat, lng: pick.lng, kind: 'pick' as const, label: 'Chosen report location' }] : []),
  ], [visible, selectedId, pick]);

  function startReport() {
    engaged.current = true;
    setSelectedId(null);
    setPick(null);
    setPicking(true);
  }

  const useMyLocation = async (forReport: boolean) => {
    engaged.current = true;
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setCenter({ lat: p.lat, lng: p.lng });
      if (forReport) {
        setPick({ lat: p.lat, lng: p.lng });
        setPicking(false);
        setReportOpen(true);
      }
    } catch (e) {
      toast.info('Location unavailable', `${(e as Error).message}${forReport ? ' You can tap the map to choose a spot instead.' : ''}`);
    } finally {
      setLocating(false);
    }
  };

  const toggleFilter = (f: FilterGroup) => setFilters((prev) => {
    const n = new Set(prev);
    if (n.has(f)) n.delete(f);
    else n.add(f);
    return n;
  });

  const update = (id: string, patch: Partial<HazardReport>) => hazards.setData((list) => list?.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const submitReport = async (input: { category: HazardCategory; description: string; photo: Blob | null }) => {
    if (!pick) throw new Error('Choose a location on the map.');
    try {
      const created = await backend.createHazard({ ...input, ...pick });
      hazards.setData((list) => [created, ...(list ?? [])]);
      setPick(null);
      setSelectedId(created.id);
      notify({ type: 'hazard', title: 'Hazard report published', body: `${HAZARD_CATEGORIES[created.category].label}: thank you for helping your community.`, link: `/community?report=${created.id}` });
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  };

  return (
    <div className="relative h-[calc(100dvh-4rem-64px-var(--banner-h,0px))] lg:h-[calc(100dvh-4rem-var(--banner-h,0px))]">
      <LazyMap
        className="absolute inset-0"
        center={center}
        zoom={14}
        markers={markers}
        onMapClick={(p) => {
          if (picking) {
            setPick(p);
            setPicking(false);
            setReportOpen(true);
          } else {
            setSelectedId(null);
          }
        }}
        overlays={overlays}
        onViewChange={(bbox, zoom) => setView({ bbox, zoom })}
        ariaLabel="Community hazard map"
      />

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-start gap-2">
          <div className="rounded-2xl bg-white/95 px-4 py-2.5 shadow-soft backdrop-blur">
            <h1 className="text-[17px] font-extrabold text-navy">Community Map</h1>
            <p className="text-[12px] text-slate-500">{hazards.loading ? 'Loading reports...' : hazards.data?.length === 0 ? 'No community reports yet. Be the first to add one.' : `${visible.length} report${visible.length === 1 ? '' : 's'} shown`}</p>
          </div>
          <Button variant="secondary" className="shadow-soft sm:hidden" icon={<IconFilter size={18} />} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>Filters</Button>
          <div className="ml-auto flex items-start gap-2 mr-12">
            <MapLayers crime={showCrime} night={showNight} onCrime={(v) => { setShowCrime(v); if (!v) { setCrime(null); loadedBox.current = null; } }} onNight={setShowNight} crimeStatus={crimeStatus} lights={showLights} onLights={(v) => { setShowLights(v); if (!v) setLights(null); }} lightsStatus={lightsStatus} />
            <Button variant="secondary" className="shadow-soft" icon={locating ? <Spinner size={16} /> : <IconCrosshair size={18} />} onClick={() => useMyLocation(false)} aria-label="Centre map on my location"><span className="hidden sm:inline">Near me</span></Button>
          </div>
        </div>
        <div className={cx('pointer-events-auto mt-2 max-w-3xl rounded-2xl bg-white/95 p-3 shadow-soft backdrop-blur sm:block', filtersOpen ? 'block animate-slide-in' : 'hidden')}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter reports by type">
            {FILTER_GROUPS.map((f) => {
              const on = filters.has(f.id);
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => toggleFilter(f.id)}
                  className={cx('min-h-[36px] rounded-full border px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', on ? 'border-navy bg-navy text-white' : 'border-navy-100 bg-white text-slate-600 hover:text-navy')}>
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="-mb-2 mt-1"><Toggle checked={showInactive} onChange={setShowInactive} label="Show resolved and outdated reports" /></div>
        </div>
        {hazards.error && <Notice tone="warning" className="pointer-events-auto mt-2 max-w-md" action={<Button size="sm" variant="secondary" onClick={hazards.reload}>Try again</Button>}>{hazards.error}</Notice>}
      </div>

      {/* Picking banner */}
      {picking && (
        <div className="absolute inset-x-3 top-24 z-20 mx-auto max-w-md animate-slide-in rounded-2xl bg-navy p-4 text-white shadow-lift sm:top-28" role="status">
          <div className="flex items-start gap-3">
            <IconPin size={22} className="mt-0.5 shrink-0 text-teal-200" />
            <div className="flex-1">
              <p className="font-semibold">Tap the map where the hazard is</p>
              <p className="text-[13px] text-sky-100">Or use your current location. Avoid reporting at your own home address.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="teal" icon={<IconCrosshair size={16} />} loading={locating} onClick={() => useMyLocation(true)}>Use my location</Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setPicking(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details panel */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[70%] animate-slide-in overflow-hidden rounded-t-3xl bg-white shadow-lift sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:max-h-[calc(100%-2rem)] sm:w-[400px] sm:rounded-3xl" role="dialog" aria-label="Report details">
          <HazardDetails
            report={selected}
            onClose={() => setSelectedId(null)}
            onVote={async (v) => {
              try {
                await backend.voteHazard(selected.id, v);
                await hazards.reload();
                toast.success('Thanks for the update');
              } catch (e) {
                toast.error('Could not save', errorMessage(e));
              }
            }}
            onFlag={async (r) => {
              try {
                await backend.flagHazard(selected.id, r);
                update(selected.id, {});
                toast.success('Report flagged', 'Thank you. Moderators review flagged reports.');
              } catch (e) {
                toast.error('Could not flag', errorMessage(e));
              }
            }}
            onDelete={async () => {
              try {
                await backend.deleteHazard(selected.id);
                hazards.setData((list) => list?.filter((h) => h.id !== selected.id));
                setSelectedId(null);
                toast.success('Report deleted');
              } catch (e) {
                toast.error('Could not delete', errorMessage(e));
              }
            }}
          />
        </div>
      )}

      {/* Accessible list of visible reports */}
      <details className="absolute bottom-4 left-4 z-10 hidden max-h-[45%] w-80 overflow-hidden rounded-2xl bg-white/95 shadow-soft backdrop-blur lg:block">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">List of reports ({visible.length})</summary>
        <ul className="max-h-72 overflow-y-auto px-2 pb-2">
          {visible.map((h) => {
            const m = HAZARD_CATEGORIES[h.category];
            return (
              <li key={h.id}>
                <button type="button" onClick={() => setSelectedId(h.id)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: m.color }}><m.icon size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-navy">{m.short}{h.isSample && <SampleBadge />}</span>
                    <span className="block truncate text-[12px] text-slate-500">{h.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </details>

      {/* Primary actions */}
      {!selected && !picking && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
          <ButtonLink to="/sos" variant="secondary" size="sm" className="border-coral-100 text-coral-700 shadow-soft" icon={<IconSos size={16} />}>SafeSOS</ButtonLink>
          <Button variant="teal" size="lg" className="shadow-lift" icon={<IconFlag size={20} />} onClick={startReport}>Report a Hazard</Button>
        </div>
      )}
      {picking && (
        <button type="button" onClick={() => setPicking(false)} className="absolute bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-navy shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Cancel choosing a location"><IconX /></button>
      )}

      <ReportHazardDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        location={pick}
        onPickAgain={() => { setReportOpen(false); setPicking(true); }}
        onSubmit={submitReport}
      />
    </div>
  );
}
