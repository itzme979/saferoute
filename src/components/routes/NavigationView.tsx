import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { IconArrowRight, IconCheckCircle, IconNavigation, IconPin, IconRefresh, IconSos, IconVolume, IconVolumeOff, IconX } from '@/components/icons';
import { LazyMap, type MapMarker } from '@/components/map/LazyMap';
import { ImThereButton } from '@/components/TextButton';
import { Button, Notice } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { formatDistance, formatDuration, formatTime } from '@/lib/format';
import { lineLength } from '@/lib/geo';
import { nextCue, nextStepIndex, offRouteLimit, pointAt, stepPositions, trackAlong, usableFix, type Cue } from '@/lib/navigation';
import { canSpeak, speak, stopSpeaking } from '@/lib/speech';
import { errorMessage } from '@/services';
import { getRoutes } from '@/services/routing';
import type { Journey, LatLng, Maneuver, NavStep, TrustedContact } from '@/types';

const ARRIVED_WITHIN_M = 25;
/** Fixes in a row before leaving the route is called out, so one bad GPS reading stays quiet. */
const OFF_ROUTE_FIXES = 3;
const SIMULATED_TRIP_S = 60;
const MUTE_KEY = 'saferoute.directions.muted';
const ZOOM = { walk: 17, bike: 16.5, car: 16, transit: 16 };

const ROTATION: Partial<Record<Maneuver, number>> = {
  'slight-right': 45, right: 90, 'sharp-right': 135, uturn: 180, 'slight-left': -45, left: -90, 'sharp-left': -135,
};

export function ManeuverIcon({ maneuver, size = 20 }: { maneuver: Maneuver; size?: number }) {
  if (maneuver === 'arrive') return <IconPin size={size} />;
  if (maneuver === 'roundabout') return <IconRefresh size={size} />;
  if (maneuver === 'board' || maneuver === 'alight') return <IconNavigation size={size} />;
  return <IconArrowRight size={size} style={{ transform: `rotate(${(ROTATION[maneuver] ?? 0) - 90}deg)` }} />;
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(v: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* only a convenience */
  }
}

interface Props {
  journey: Journey;
  position: (LatLng & { accuracy: number }) | null;
  /** False when location was refused, so it won't come back by itself. */
  tracking: boolean;
  trackingError: string | null;
  simulated: boolean;
  /** Whether the device confirmed the screen will stay on. */
  awake: boolean;
  onRetryLocation: () => void;
  contacts: TrustedContact[];
  onArrived: () => void;
  onExit: () => void;
}

export function NavigationView({ journey, position, tracking, trackingError, simulated, awake, onRetryLocation, contacts, onArrived, onExit }: Props) {
  const toast = useToast();
  const mode = journey.route.mode ?? 'walk';
  const placeName = journey.destination.label.split(',')[0];
  const [plan, setPlan] = useState({ coordinates: journey.route.coordinates, steps: journey.route.steps ?? [], durationS: journey.route.durationS, rerouted: false });
  const [simAlong, setSimAlong] = useState(0);
  const [along, setAlong] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  const [rerouting, setRerouting] = useState(false);
  const [roughFix, setRoughFix] = useState(false);
  const said = useRef<{ index: number | null; cue: Cue | null }>({ index: null, cue: null });
  const offFixes = useRef(0);
  const lastFix = useRef('');
  const voice = useRef(muted);
  voice.current = muted;
  const say = (text: string) => { if (!voice.current) speak(text); };

  useEffect(() => stopSpeaking, []);

  // Stops the page behind from sliding around under the directions on phones.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);

  const total = useMemo(() => lineLength(plan.coordinates), [plan.coordinates]);
  const positions = useMemo(() => stepPositions(plan.coordinates, plan.steps), [plan]);
  const mapRoutes = useMemo(() => [{ id: 'route', coordinates: plan.coordinates, selected: true }], [plan.coordinates]);

  useEffect(() => {
    if (!simulated) return;
    const id = setInterval(() => setSimAlong((a) => Math.min(total, a + total / SIMULATED_TRIP_S)), 1000);
    return () => clearInterval(id);
  }, [simulated, total]);

  const here = useMemo(() => {
    if (!simulated) return position;
    return { ...pointAt(plan.coordinates, simAlong), accuracy: 5 };
  }, [simulated, position, plan.coordinates, simAlong]);

  // Follow the position along the route. Only moves forward by small steps, so GPS noise can't replay old directions.
  const alongRef = useRef(0);
  useEffect(() => {
    if (!here || arrived) return;
    const rough = !usableFix(here.accuracy);
    setRoughFix(rough);
    if (rough) return;
    const t = trackAlong(here, plan.coordinates, alongRef.current);
    const off = t.offRoute > offRouteLimit(mode, here.accuracy);
    // A phone can repeat one reading, and that shouldn't count as being off route for longer.
    const fix = `${here.lat},${here.lng}`;
    const repeat = fix === lastFix.current;
    lastFix.current = fix;
    offFixes.current = off ? offFixes.current + (repeat ? 0 : 1) : 0;
    if (offFixes.current === OFF_ROUTE_FIXES) {
      setOffRoute(true);
      say("You've left the route.");
    }
    if (off) return;
    if (offRoute) {
      setOffRoute(false);
      say("You're back on the route.");
    }
    alongRef.current = t.along;
    setAlong(t.along);
    if (total - t.along <= ARRIVED_WITHIN_M) {
      setArrived(true);
      say(`You've arrived at ${placeName}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, plan.coordinates]);

  const index = nextStepIndex(positions, along);
  const step: NavStep | null = index === null ? null : plan.steps[index];
  const distance = index === null ? 0 : Math.max(0, positions[index] - along);
  const following = index === null ? null : plan.steps[index + 1] ?? null;

  useEffect(() => {
    if (!step || !here || offRoute || arrived) return;
    if (said.current.index !== index) said.current = { index, cue: null };
    const next = nextCue(step, distance, mode, said.current.cue);
    if (!next) return;
    said.current.cue = next.cue;
    say(next.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, distance, offRoute, arrived, !here]);

  const toggleVoice = () => {
    const v = !muted;
    setMuted(v);
    saveMuted(v);
    if (v) stopSpeaking();
    else speak('Voice directions on.');
  };

  const reroute = async () => {
    if (!here) return;
    setRerouting(true);
    try {
      const { routes } = await getRoutes(mode, here, journey.destination);
      const best = routes[0];
      if (!best?.steps?.length) throw new Error('Directions could not be loaded for this route.');
      alongRef.current = 0;
      offFixes.current = 0;
      said.current = { index: null, cue: null };
      setPlan({ coordinates: best.coordinates, steps: best.steps, durationS: best.durationS, rerouted: true });
      setAlong(0);
      setOffRoute(false);
    } catch (e) {
      toast.error('New directions could not be loaded', errorMessage(e));
    } finally {
      setRerouting(false);
    }
  };

  const remaining = Math.max(0, total - along);
  const secondsLeft = plan.durationS * (remaining / Math.max(1, total));
  const arrival = mode === 'transit' ? new Date(journey.expectedArrival) : new Date(Date.now() + secondsLeft * 1000);
  const heading = pointAt(plan.coordinates, along).heading;
  const follow = here ? { lat: here.lat, lng: here.lng, heading, zoom: ZOOM[mode] } : undefined;
  const markers: MapMarker[] = [
    { id: 'd', lat: journey.destination.lat, lng: journey.destination.lng, kind: 'destination', label: `Destination: ${journey.destination.label}` },
    ...(here ? [{ id: 'me', lat: here.lat, lng: here.lng, kind: 'user' as const, label: 'Your current position' }] : []),
  ];
  const textable = contacts.filter((c) => c.phone);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overscroll-none bg-white [@media(max-height:500px)]:flex-row" role="region" aria-label="Turn-by-turn directions">
      <div className="relative min-h-[40%] flex-1 [&_.maplibregl-ctrl-top-right]:hidden">
        <LazyMap className="absolute inset-0" center={here ?? journey.origin} zoom={ZOOM[mode]} follow={follow} routes={mapRoutes} markers={markers} ariaLabel="Map following your journey" />

        <div className="absolute left-[max(0.75rem,env(safe-area-inset-left))] right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] space-y-2 [@media(max-height:500px)]:top-2">
          <div className="rounded-2xl bg-navy p-4 text-white shadow-soft [@media(max-height:500px)]:p-2.5">
            {arrived ? (
              <div className="flex items-center gap-3"><IconPin size={32} className="shrink-0" /><p className="text-xl font-bold" aria-live="polite">You've arrived at {placeName}</p></div>
            ) : step ? (
              <div className="flex items-center gap-3">
                <span className="shrink-0"><ManeuverIcon maneuver={step.maneuver} size={36} /></span>
                <div className="min-w-0">
                  <p className="text-2xl font-extrabold">{here ? formatDistance(distance) : 'Finding you...'}</p>
                  <p className="text-base font-semibold leading-snug" aria-live="polite">{step.instruction}</p>
                </div>
              </div>
            ) : <p className="text-lg font-bold">Continue to your destination</p>}
            {!arrived && following && <p className="mt-2 border-t border-white/20 pt-2 text-[13px] text-white/80 [@media(max-height:500px)]:hidden">Then: {following.instruction}</p>}
          </div>
          {simulated && <p className="inline-block rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-soft [@media(max-height:500px)]:hidden">Simulated trip, sped up. Not using your location.</p>}
          {step?.maneuver === 'alight' && <p className="rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-soft">Location can drop out in tunnels and stations, so watch for your stop too.</p>}
          {plan.rerouted && <p className="rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-soft">New route from where you are. It hasn't had a safety check, and contacts still see your original plan.</p>}
        </div>
      </div>

      <div className="flex max-h-[60%] shrink-0 flex-col gap-3 rounded-t-2xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-soft [@media(max-height:500px)]:max-h-full [@media(max-height:500px)]:w-80 [@media(max-height:500px)]:rounded-none [@media(max-height:500px)]:pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        {!simulated && !tracking && (
          <Notice tone="warning" title="Location is off">
            <span className="block">Directions can't follow you without it. Allow location for this app or browser in your device settings, then try again.</span>
            <Button size="sm" variant="subtle" className="mt-2" onClick={onRetryLocation}>Try again</Button>
          </Notice>
        )}
        {trackingError && !simulated && tracking && <Notice tone="info">{trackingError.match(/^.*?\./)?.[0] ?? trackingError} Directions will continue when your location is back.</Notice>}
        {roughFix && !simulated && !trackingError && !arrived && <Notice tone="info">Your location is rough right now, so directions are waiting for a better signal. Moving outside can help.</Notice>}
        {offRoute && !arrived && (
          <Notice tone="warning" title="You've left the route">
            {mode === 'transit' ? 'Head back to the route, or check the trip steps on the journey screen.' : (
              <>
                <span className="block">Go back to the route, or get new directions from here. New directions won't have a safety check.</span>
                <Button size="sm" variant="subtle" className="mt-2" loading={rerouting} onClick={reroute}>Get new directions</Button>
              </>
            )}
          </Notice>
        )}

        {arrived ? (
          <>
            {textable.length > 0 && (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {textable.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{c.name}</span>
                    <ImThereButton phone={c.phone!} name={c.name} destination={placeName} />
                  </li>
                ))}
              </ul>
            )}
            <Button variant="teal" size="lg" block icon={<IconCheckCircle size={20} />} onClick={onArrived}>I've arrived</Button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-navy">{formatTime(arrival)}</p>
              <p className="text-[13px] text-slate-500">{formatDistance(remaining)} left{mode === 'transit' ? '' : ` · ${formatDuration(secondsLeft)}`}</p>
            </div>
            {canSpeak() && (
              <Button variant="secondary" icon={muted ? <IconVolumeOff size={18} /> : <IconVolume size={18} />} onClick={toggleVoice} aria-pressed={!muted}>
                {muted ? 'Voice off' : 'Voice on'}
              </Button>
            )}
          </div>
        )}

        {mode === 'car' && !arrived && <p className="text-[12px] text-slate-500">Mount your phone before you drive, and don't touch it while moving.</p>}
        {!arrived && (
          <p className="text-[12px] text-slate-500">
            {awake ? 'Keep SafeRoute open with your screen on. Directions stop if you lock your phone or switch apps.' : "This device may not keep the screen on by itself. If it dims, turn off auto-lock in your settings for this trip, because directions stop if your phone locks."}
          </p>
        )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Link to="/sos" className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-coral-100 bg-coral-50 font-semibold text-coral-700 transition hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500">
            <IconSos size={20} /> SafeSOS
          </Link>
          <Button variant="secondary" icon={<IconX size={18} />} onClick={onExit} aria-label="Exit directions">Exit</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
