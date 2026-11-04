import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowRight, IconCrosshair, IconInfo, IconLayers, IconPin, IconPlay, IconRefresh, IconRoute, IconSwap,
} from '@/components/icons';
import { LocationSearch } from '@/components/LocationSearch';
import { LazyMap, type MapMarker, type MapOverlays, type MapRoute } from '@/components/map/LazyMap';
import { PreferenceChips } from '@/components/PreferenceChips';
import { RouteCard, ROUTE_COLORS } from '@/components/routes/RouteCard';
import { TravelModePicker } from '@/components/routes/TravelModePicker';
import { CompareTable, HowComparisonWorks, RouteDetails } from '@/components/routes/RouteDetails';
import { StartJourneyDialog, type StartOptions } from '@/components/routes/StartJourneyDialog';
import { AreaSafetyCard, type Loadable } from '@/components/safety/AreaSafetyCard';
import { MapLayers, type LayerStatus } from '@/components/safety/MapLayers';
import { Button, ButtonLink, Card, EmptyState, Modal, Notice, Skeleton, Spinner } from '@/components/ui';
import { useAuth, useProfile } from '@/context/AuthContext';
import { useJourney } from '@/context/JourneyContext';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { SAMPLE_DESTINATION, SAMPLE_ORIGIN, sampleRoutesFor } from '@/demo/sampleData';
import { config } from '@/lib/config';
import { formatDuration, formatTime } from '@/lib/format';
import { lineLength } from '@/lib/geo';
import { getCurrentPosition, LocationError } from '@/lib/location';
import { backend, errorMessage } from '@/services';
import { AREA_RADIUS_M, bboxOf, loadCrimeContext, loadCrimeOverlay, type CrimeContext, type CrimeOverlay } from '@/services/crime';
import { reverseGeocode } from '@/services/geocode';
import { loadAreaNews, type AreaNews } from '@/services/news';
import { loadNightBrightness, nightLightDates, nightLightTileUrl } from '@/services/nightLights';
import { analyzeRouteWithOsm, fetchOsmContext } from '@/services/osmEnrichment';
import { buildMetrics, compareRoutes, mergeCityLighting, mergeCrime, mergeNightBrightness, routeHazards, routeSummary, safetySegments } from '@/services/routeAnalysis';
import { getRoutes, RoutingError } from '@/services/routing';
import { loadCityLighting } from '@/services/streetlights';
import { loadTravelMode, modeMeta, saveTravelMode } from '@/services/travelModes';
import type { HazardReport, Place, RouteMetrics, TravelMode, WalkingRoute } from '@/types';

const NEWS_ERROR = 'Local news could not be loaded right now.';
/** Street details come from Overpass, which times out on very long routes. */
const OSM_MAX_M = 30000;

type Status = 'idle' | 'loading' | 'error' | 'ready';

export default function PlanJourney() {
  const profile = useProfile();
  const { updateProfile } = useAuth();
  const { journey: activeJourney, refresh: refreshJourney } = useJourney();
  const { notify } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<TravelMode>(loadTravelMode);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const meta = modeMeta(mode);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [prefs, setPrefs] = useState(profile.walkingPreferences);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);
  const [provider, setProvider] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const [crimeCtx, setCrimeCtx] = useState<Loadable<CrimeContext | null> | null>(null);
  const [originNews, setOriginNews] = useState<Loadable<AreaNews | null> | null>(null);
  const [destNews, setDestNews] = useState<Loadable<AreaNews | null> | null>(null);
  const [showCrimeLayer, setShowCrimeLayer] = useState(false);
  const [showNightLayer, setShowNightLayer] = useState(false);
  const [crimeOverlay, setCrimeOverlay] = useState<Loadable<CrimeOverlay | null> | null>(null);
  const runId = useRef(0);

  const hazards = useAsync(() => backend.listHazards(), []);
  const contacts = useAsync(() => backend.listContacts(), []);

  const prefsChanged = JSON.stringify(prefs) !== JSON.stringify(profile.walkingPreferences);

  const plan = useCallback(async (o: Place, d: Place, hz: HazardReport[]) => {
    const id = ++runId.current;
    const travel = modeRef.current;
    const checks = modeMeta(travel).checks;
    setStatus('loading');
    setError(null);
    setNotice(null);
    setRoutes([]);
    setSelectedId(null);
    setEnrichment('idle');
    setUsingSample(false);
    setCrimeCtx(null);
    setCrimeOverlay(null);
    setOriginNews({ state: 'loading' });
    setDestNews({ state: 'loading' });
    const news = (p: Place, set: typeof setOriginNews) => loadAreaNews(p)
      .then((data) => id === runId.current && set({ state: 'ready', data }))
      .catch(() => id === runId.current && set({ state: 'error', message: NEWS_ERROR }));
    news(o, setOriginNews);
    news(d, setDestNews);
    try {
      const res = await getRoutes(travel, o, d);
      if (id !== runId.current) return;
      const built: WalkingRoute[] = res.routes.map((r, i) => ({
        mode: travel,
        legs: r.legs,
        walkSegments: r.walkSegments,
        transfers: r.transfers,
        arrivesAt: r.arrivesAt,
        id: `r${i}`,
        name: r.legs ? `Leave ${formatTime(r.legs[0].startTime)}` : `Route ${String.fromCharCode(65 + i)}`,
        coordinates: r.coordinates,
        distanceM: r.distanceM,
        durationS: r.durationS,
        turns: r.turns,
        provider: res.provider,
        enrichment: 'partial',
        metrics: buildMetrics(null, routeHazards({ ...r, mode: travel }, hz)),
      }));
      setRoutes(built);
      setProvider(res.provider);
      setNotice(res.notice ?? null);
      setStatus('ready');
      const useOsm = checks.osm && built.every((r) => r.distanceM <= OSM_MAX_M);
      setEnrichment(useOsm ? 'loading' : 'done');

      // City streetlights, police-reported crime and satellite night lights load
      // alongside OpenStreetMap; each fills in its own metrics when it arrives.
      // A transit trip has several walking stretches: each is measured on its
      // own, then combined per route.
      const segments = built.map(safetySegments);
      const coords = segments.flat();
      const offsets = segments.map((_, i) => segments.slice(0, i).reduce((n, s) => n + s.length, 0));
      const partsOf = <T,>(res: T[], i: number) => res.slice(offsets[i], offsets[i] + segments[i].length);
      const lengthsOf = (i: number) => segments[i].map(lineLength);
      const index = new Map(built.map((r, i) => [r.id, i]));
      const patch = (fn: (i: number) => Partial<RouteMetrics>) => {
        if (id !== runId.current) return;
        setRoutes((prev) => prev.map((r) => (index.has(r.id) ? { ...r, metrics: { ...r.metrics, ...fn(index.get(r.id)!) } } : r)));
      };
      if (checks.lighting) {
        loadCityLighting(coords)
          .then((res) => patch((i) => ({ cityLighting: mergeCityLighting(partsOf(res, i), lengthsOf(i)) })))
          .catch(() => patch(() => ({ cityLighting: null })));
      }
      if (checks.night) {
        loadNightBrightness(coords)
          .then((res) => patch((i) => ({ nightBrightness: mergeNightBrightness(partsOf(res, i), lengthsOf(i)) })))
          .catch(() => patch(() => ({ nightBrightness: null })));
      }
      if (checks.crime) {
        setCrimeCtx({ state: 'loading' });
        loadCrimeContext(coords, o, d)
          .then((ctx) => {
            if (id !== runId.current) return;
            setCrimeCtx({ state: 'ready', data: ctx });
            patch((i) => ({ crime: ctx ? mergeCrime(partsOf(ctx.routes, i)) : null }));
          })
          .catch(() => {
            if (id !== runId.current) return;
            setCrimeCtx({ state: 'error', message: 'Police crime data could not be loaded right now.' });
            patch(() => ({ crime: null }));
          });
      }

      if (!useOsm) return;
      try {
        const ctx = await fetchOsmContext(coords);
        if (id !== runId.current) return;
        // Spread existing metrics so data that arrived first (crime, city lights) is kept.
        setRoutes((prev) => prev.map((r) => ({ ...r, enrichment: 'available', metrics: { ...r.metrics, ...buildMetrics(analyzeRouteWithOsm(r.coordinates, ctx), r.metrics.hazards) } })));
        setEnrichment('done');
      } catch {
        if (id !== runId.current) return;
        setRoutes((prev) => prev.map((r) => ({ ...r, enrichment: 'unavailable' })));
        setEnrichment('failed');
      }
    } catch (e) {
      if (id !== runId.current) return;
      setStatus('error');
      setError(e instanceof RoutingError ? e.message : `${modeMeta(travel).label} routes could not be loaded. Check your connection and try again.`);
    }
  }, []);

  useEffect(() => {
    if (origin && destination && !usingSample) plan(origin, destination, hazards.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, mode, plan]);

  // When community reports finish loading after routes, attach them.
  useEffect(() => {
    if (!hazards.data || usingSample) return;
    setRoutes((prev) => prev.map((r) => ({ ...r, metrics: { ...r.metrics, hazards: routeHazards(r, hazards.data!) } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazards.data]);

  const comparison = useMemo(() => compareRoutes(routes, prefs), [routes, prefs]);

  // Select the best match by default (until the user picks one).
  useEffect(() => {
    if (routes.length && !selectedId) {
      const best = Object.values(comparison.assessments).find((a) => a.rank === 1);
      setSelectedId(best?.routeId ?? routes[0].id);
    }
  }, [routes, comparison, selectedId]);

  const orderedRoutes = useMemo(() => [...routes].sort((a, b) => (comparison.assessments[a.id]?.rank ?? 9) - (comparison.assessments[b.id]?.rank ?? 9)), [routes, comparison]);
  const fastestId = useMemo(() => (routes.length > 1 ? routes.reduce((a, b) => (a.durationS <= b.durationS ? a : b)).id : null), [routes]);
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const detailsRoute = routes.find((r) => r.id === detailsId) ?? null;

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const p = await getCurrentPosition();
      const label = await reverseGeocode(p);
      setUsingSample(false);
      setOrigin({ label: `Current location (${label})`, lat: p.lat, lng: p.lng });
    } catch (e) {
      setLocationError(e instanceof LocationError ? e.message : 'We could not get your location. Type an address instead.');
    } finally {
      setLocating(false);
    }
  };

  const loadSample = () => {
    runId.current++;
    setUsingSample(true);
    setOrigin(SAMPLE_ORIGIN);
    setDestination(SAMPLE_DESTINATION);
    setRoutes(sampleRoutesFor(mode));
    setProvider('Sample data');
    setNotice(null);
    setError(null);
    setStatus('ready');
    setEnrichment('done');
    setSelectedId(null);
    setCrimeCtx(null);
    setCrimeOverlay(null);
    setOriginNews(null);
    setDestNews(null);
  };

  const changeMode = (m: TravelMode) => {
    saveTravelMode(m);
    setMode(m);
    // Stay on the examples rather than replacing them with real routes.
    if (usingSample) {
      setRoutes(sampleRoutesFor(m));
      setSelectedId(null);
    }
  };

  const swap = () => {
    setUsingSample(false);
    setOrigin(destination);
    setDestination(origin);
  };

  const start = async (o: StartOptions) => {
    if (!selected || !origin || !destination || starting) return;
    setStarting(true);
    try {
      const j = await backend.startJourney({
        origin, destination,
        route: { mode: selected.mode, legs: selected.legs, name: selected.name, coordinates: selected.coordinates, distanceM: selected.distanceM, durationS: selected.durationS, turns: selected.turns, provider: selected.provider, summary: routeSummary(selected) },
        expectedArrival: o.expectedArrival, share: o.share, checkin: o.checkin,
      });
      if (o.share.enabled && o.share.contactIds.length) {
        try {
          const r = await backend.notifyJourneyShare(j.id, o.share.contactIds);
          notify({
            type: 'share',
            title: 'Journey shared',
            body: r.simulated ? 'Your journey link is active. No emails were sent.' : `${r.sent} contact${r.sent === 1 ? '' : 's'} received a private link. Sharing stops when the journey ends.`,
            link: '/journey',
          });
          if (r.simulated) toast.info('Journey shared (no messages sent)', r.message);
          else if (r.failed) toast.info('Journey shared', `${r.sent} contact${r.sent === 1 ? '' : 's'} emailed. ${r.failed} could not be reached; you can copy the link on the journey screen.`);
          else toast.success('Journey shared', `${r.sent} contact${r.sent === 1 ? '' : 's'} received a private link.`);
        } catch (e) {
          toast.error('Journey started, but sharing emails failed', `${errorMessage(e)} You can copy the link on the journey screen.`);
        }
      } else {
        toast.success('Journey started', 'Have a safe trip.');
      }
      await refreshJourney();
      navigate('/journey');
    } catch (e) {
      toast.error('Could not start journey', errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  // Crime map layer: incidents around the routes, loaded only when switched on.
  const routesKey = usingSample ? 'sample' : routes.map((r) => r.id).join(',') + `|${origin?.lat}|${destination?.lat}`;
  useEffect(() => {
    if (!showCrimeLayer || usingSample || !routes.length) return;
    let cancelled = false;
    setCrimeOverlay({ state: 'loading' });
    const pts = routes.flatMap((r) => r.coordinates);
    loadCrimeOverlay(bboxOf(pts, AREA_RADIUS_M))
      .then((data) => !cancelled && setCrimeOverlay({ state: 'ready', data }))
      .catch(() => !cancelled && setCrimeOverlay({ state: 'error', message: 'Police crime data could not be loaded right now.' }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCrimeLayer, routesKey]);

  const crimeStatus: LayerStatus = useMemo(() => {
    if (!routes.length || usingSample) return { state: 'unavailable', note: usingSample ? 'Not shown for sample routes.' : 'Plan a route to see reported crime around it.' };
    if (!crimeOverlay || crimeOverlay.state === 'loading') return { state: 'loading' };
    if (crimeOverlay.state === 'error') return { state: 'unavailable', note: crimeOverlay.message };
    const o = crimeOverlay.data;
    if (!o) return { state: 'unavailable', note: 'No police open data for this area. Covered: Toronto, Ottawa, Montréal, England, Wales and Northern Ireland.' };
    return { state: 'ready', note: `${o.incidents.length.toLocaleString()} reports, ${o.period.label}.${o.truncated ? ' Busy area: showing the most recent reports only.' : ''} Source: ${o.source.name}.` };
  }, [routes.length, usingSample, crimeOverlay]);

  const overlays: MapOverlays = useMemo(() => ({
    crime: showCrimeLayer && crimeOverlay?.state === 'ready' ? crimeOverlay.data?.incidents ?? null : null,
    nightLights: showNightLayer ? nightLightTileUrl(nightLightDates()[0]) : null,
  }), [showCrimeLayer, showNightLayer, crimeOverlay]);

  const mapRoutes: MapRoute[] = useMemo(() => routes.map((r, i) => ({ id: r.id, coordinates: r.coordinates, selected: r.id === selectedId, color: ROUTE_COLORS[i] })), [routes, selectedId]);
  const routeHazardIds = useMemo(() => new Set(routes.flatMap((r) => r.metrics.hazards.map((h) => h.id))), [routes]);
  const markers: MapMarker[] = useMemo(() => [
    ...(origin ? [{ id: 'origin', lat: origin.lat, lng: origin.lng, kind: 'origin' as const, label: `Start: ${origin.label}` }] : []),
    ...(destination ? [{ id: 'dest', lat: destination.lat, lng: destination.lng, kind: 'destination' as const, label: `Destination: ${destination.label}` }] : []),
    ...(hazards.data ?? []).filter((h) => routeHazardIds.has(h.id)).map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, kind: 'hazard' as const, category: h.category, label: `Community report: ${h.description}` })),
  ], [origin, destination, hazards.data, routeHazardIds]);

  if (activeJourney) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-2">
          <EmptyState
            icon={<IconRoute />}
            title="You have a journey in progress"
            description={`End your current journey to ${activeJourney.destination.label} before planning a new one.`}
            action={<ButtonLink to="/journey" className="flex-row-reverse" icon={<IconArrowRight size={18} />}>Go to active journey</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:h-[calc(100dvh-4rem-var(--banner-h,0px))] lg:grid-cols-[minmax(380px,460px)_1fr]">
      {/* Controls + results */}
      <div className="lg:overflow-y-auto lg:border-r lg:border-navy/[0.06]">
        <div className="space-y-5 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-navy">Plan a Journey</h1>
            <p className="mt-1 text-[15px] text-slate-600">Compare routes using the information that's available.</p>
          </div>

          <Card className="p-4">
            <div className="mb-4"><TravelModePicker value={mode} onChange={changeMode} /></div>
            <div className="relative space-y-3">
              <LocationSearch
                label="Starting location"
                placeholder="Search for an address or place"
                value={origin}
                onChange={(p) => { setUsingSample(false); setOrigin(p); }}
                near={destination ?? config.defaultCenter}
                leading={<span className="block h-3 w-3 rounded-full border-[3px] border-navy" />}
                trailing={
                  <button type="button" onClick={useCurrentLocation} disabled={locating} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-sky-100 px-2.5 text-[13px] font-semibold text-navy hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60" aria-label="Use my current location as the start">
                    {locating ? <Spinner size={14} /> : <IconCrosshair size={16} />}
                    <span className="hidden sm:inline">Current</span>
                  </button>
                }
              />
              <div className="flex justify-end">
                <button type="button" onClick={swap} disabled={!origin && !destination} className="-my-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-slate-500 hover:bg-mist hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-40" aria-label="Swap start and destination">
                  <IconSwap size={16} /> Swap
                </button>
              </div>
              <LocationSearch
                label="Destination"
                placeholder="Where are you going?"
                value={destination}
                onChange={(p) => { setUsingSample(false); setDestination(p); }}
                near={origin ?? config.defaultCenter}
                leading={<IconPin size={18} className="text-navy" />}
              />
            </div>
            {locationError && (
              <Notice tone="info" className="mt-3" title="Location not available">
                {locationError}
              </Notice>
            )}
            <p className="mt-3 text-[12px] text-slate-500">
              Your location is used only to set your starting point. It is not saved or shared unless you start a journey and choose to share it.
            </p>
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">Your priorities</h2>
              {prefsChanged && (
                <button type="button" className="text-[13px] font-semibold text-teal-700 hover:underline" onClick={async () => {
                  try {
                    await updateProfile({ walkingPreferences: prefs });
                    toast.success('Saved as your default priorities');
                  } catch (e) {
                    toast.error('Could not save', errorMessage(e));
                  }
                }}>Save as default</button>
              )}
            </div>
            <PreferenceChips value={prefs} onChange={setPrefs} only={meta.prefs} />
          </div>

          {/* Results */}
          <section aria-live="polite" aria-busy={status === 'loading'} className="space-y-3">
            {status === 'idle' && (
              <Card className="p-2">
                <EmptyState
                  icon={<IconRoute />}
                  title="Enter a start and destination"
                  description={`We'll find up to three options and compare them for you.`}
                  action={config.isSampleDemo ? <Button variant="subtle" size="sm" onClick={loadSample}>View sample {meta.label.toLowerCase()} routes (demonstration)</Button> : undefined}
                />
              </Card>
            )}
            {status === 'loading' && (
              <>
                <p className="flex items-center gap-2 text-sm text-slate-600"><Spinner size={16} /> Finding {meta.routeNoun}s...</p>
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
              </>
            )}
            {status === 'error' && (
              <Notice
                tone="warning"
                title="Routes unavailable"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={<IconRefresh size={16} />} onClick={() => origin && destination && plan(origin, destination, hazards.data ?? [])}>Try again</Button>
                    <Button size="sm" variant="ghost" onClick={loadSample}>View sample {meta.label.toLowerCase()} routes (demonstration)</Button>
                  </div>
                }
              >
                {error}
              </Notice>
            )}
            {status === 'ready' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold text-navy">
                    {routes.length === 1 ? `One ${meta.routeNoun} found` : `${routes.length} ${meta.routeNoun}s`}
                  </h2>
                  <div className="flex gap-1">
                    {routes.length > 1 && <Button size="sm" variant="ghost" icon={<IconLayers size={16} />} onClick={() => setShowCompare(true)}>Compare</Button>}
                    <Button size="sm" variant="ghost" icon={<IconInfo size={16} />} onClick={() => setShowHow(true)}>How it works</Button>
                  </div>
                </div>
                {usingSample && <Notice tone="info" title="Sample routes">These routes and their details are fictional demonstration data. They are not real information about these streets.</Notice>}
                {notice && <Notice tone="info">{notice}</Notice>}
                {meta.note && !usingSample && <Notice tone="neutral">{meta.note}</Notice>}
                {routes.length === 1 && <Notice tone="neutral">The routing service returned only one sensible {meta.routeNoun} for this trip.</Notice>}
                {enrichment === 'loading' && <p className="flex items-center gap-2 text-[13px] text-slate-500"><Spinner size={14} /> Checking street details from OpenStreetMap...</p>}
                {enrichment === 'failed' && (
                  <Notice tone="info" action={<Button size="sm" variant="secondary" onClick={() => origin && destination && plan(origin, destination, hazards.data ?? [])}>Retry</Button>}>
                    Street details (lighting, stairs, crossings) couldn't be loaded right now, so routes are compared by time and community reports only.
                  </Notice>
                )}
                {hazards.error && <Notice tone="info">Community reports couldn't be loaded, so they are not included.</Notice>}
                <ul className="space-y-3">
                  {orderedRoutes.map((r) => (
                    <li key={r.id}>
                      <RouteCard
                        route={r}
                        index={routes.indexOf(r)}
                        assessment={comparison.assessments[r.id]}
                        selected={r.id === selectedId}
                        fastest={r.id === fastestId}
                        enrichmentLoading={enrichment === 'loading'}
                        onSelect={() => setSelectedId(r.id)}
                        onDetails={() => setDetailsId(r.id)}
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-slate-500">
                  Routes by {provider === 'Transitous' ? <><a href="https://transitous.org/sources/" target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:underline">Transitous and its data sources</a>, with OpenStreetMap contributors</> : provider}. SafeRoute does not provide turn-by-turn navigation.
                </p>
                {!usingSample && origin && destination && crimeCtx && originNews && destNews && (
                  <AreaSafetyCard originLabel={origin.label} destinationLabel={destination.label} crime={crimeCtx} originNews={originNews} destinationNews={destNews} />
                )}
                <div className="hidden lg:block">
                  <Button variant="teal" size="lg" block disabled={!selected} onClick={() => setStartOpen(true)} icon={<IconPlay size={18} />}>Start Journey</Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Map */}
      <div className="relative order-first h-72 sm:h-96 lg:sticky lg:top-16 lg:order-none lg:h-[calc(100dvh-4rem-var(--banner-h,0px))]">
        <LazyMap
          className="absolute inset-0"
          routes={mapRoutes}
          markers={markers}
          fitKey={`${routes.map((r) => r.id).join(',')}|${origin?.lat}|${destination?.lat}`}
          onRouteClick={(id) => setSelectedId(id)}
          overlays={overlays}
          ariaLabel="Map of route options"
        />
        <MapLayers
          className="absolute left-3 top-3 z-10"
          crime={showCrimeLayer}
          night={showNightLayer}
          onCrime={setShowCrimeLayer}
          onNight={setShowNightLayer}
          crimeStatus={crimeStatus}
        />
      </div>

      {/* Mobile sticky start bar */}
      {status === 'ready' && selected && (
        <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-navy/[0.06] bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-navy">{selected.name}</p>
              <p className="text-[13px] text-slate-500">{formatDuration(selected.durationS)}</p>
            </div>
            <Button variant="teal" onClick={() => setStartOpen(true)} icon={<IconPlay size={18} />}>Start Journey</Button>
          </div>
        </div>
      )}

      <Modal open={!!detailsRoute} onClose={() => setDetailsId(null)} title={detailsRoute ? `${detailsRoute.name} details` : ''} size="md"
        footer={detailsRoute && (
          <>
            <Button variant="secondary" onClick={() => setDetailsId(null)}>Close</Button>
            <Button variant="teal" onClick={() => { setSelectedId(detailsRoute.id); setDetailsId(null); setStartOpen(true); }} icon={<IconPlay size={18} />}>Choose this route</Button>
          </>
        )}
      >
        {detailsRoute && <RouteDetails route={detailsRoute} enrichmentLoading={enrichment === 'loading'} />}
      </Modal>
      <Modal open={showHow} onClose={() => setShowHow(false)} title="How routes are compared">
        <HowComparisonWorks comparison={comparison} />
      </Modal>
      <Modal open={showCompare} onClose={() => setShowCompare(false)} title="Compare routes" size="lg">
        <CompareTable routes={routes} comparison={comparison} enrichmentLoading={enrichment === 'loading'} />
      </Modal>
      {selected && destination && (
        <StartJourneyDialog
          open={startOpen}
          onClose={() => setStartOpen(false)}
          route={selected}
          destinationLabel={destination.label}
          contacts={contacts.data ?? []}
          contactsLoading={contacts.loading}
          profile={profile}
          onConfirm={start}
          busy={starting}
        />
      )}
    </div>
  );
}
