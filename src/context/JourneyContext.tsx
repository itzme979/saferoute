import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LateTextButtons } from '@/components/TextButton';
import { Button, Modal, Notice } from '@/components/ui';
import { IconCheckCircle, IconClock } from '@/components/icons';
import { config } from '@/lib/config';
import { formatTime } from '@/lib/format';
import { LocationError, watchPosition } from '@/lib/location';
import { backend, errorMessage } from '@/services';
import type { Checkin, Journey, LatLng } from '@/types';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useToast } from './ToastContext';

interface JourneyState {
  journey: Journey | null;
  checkin: Checkin | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Device position while tracking is on (never shared unless live sharing is enabled). */
  position: (LatLng & { accuracy: number }) | null;
  tracking: boolean;
  trackingError: string | null;
  setTracking: (on: boolean) => void;
  confirmArrival: () => Promise<void>;
  extend: (minutes: number) => Promise<void>;
  endJourney: (status: 'completed' | 'cancelled') => Promise<void>;
  setSharing: (patch: { enabled?: boolean; liveLocation?: boolean }) => Promise<void>;
}

const Ctx = createContext<JourneyState | null>(null);
const LIVE_PUSH_MS = 30000;

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { notify } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<(LatLng & { accuracy: number }) | null>(null);
  const [tracking, setTrackingState] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const snoozeUntil = useRef(0);
  const lastPush = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setJourney(null);
      setCheckin(null);
      setLoading(false);
      return;
    }
    try {
      const a = await backend.getActiveJourney();
      setJourney(a?.journey ?? null);
      setCheckin(a?.checkin ?? null);
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live sharing requires tracking.
  useEffect(() => {
    if (journey?.shareLiveLocation) setTrackingState(true);
    if (!journey) setTrackingState(false);
  }, [journey]);

  // Location watch (only while tracking is on and a journey is active). Keyed on the
  // id because each refresh makes a new journey object, and restarting would drop the GPS.
  const journeyId = journey?.id;
  useEffect(() => {
    if (!tracking || !journeyId) {
      setPosition(null);
      return;
    }
    setTrackingError(null);
    return watchPosition(
      (p) => {
        setPosition(p);
        setTrackingError(null);
      },
      (e: LocationError) => {
        setTrackingError(e.message);
        if (e.kind === 'denied') setTrackingState(false);
      },
    );
  }, [tracking, journeyId]);

  // Push approximate live location to the backend only if the user chose live sharing.
  useEffect(() => {
    if (!journey?.shareLiveLocation || !position) return;
    if (Date.now() - lastPush.current < LIVE_PUSH_MS) return;
    lastPush.current = Date.now();
    backend.updateJourneyLocation(journey.id, { lat: +position.lat.toFixed(5), lng: +position.lng.toFixed(5) }).catch(() => {});
  }, [journey, position]);

  // SafeArrival watcher. Runs while the app is open; the server-side monitor
  // handles missed check-ins when the browser is closed.
  useEffect(() => {
    if (!journey || !checkin || !profile) return;
    const tick = async () => {
      if (!['scheduled', 'reminded', 'missed'].includes(checkin.status)) return;
      const now = Date.now();
      const eta = new Date(checkin.expectedArrival).getTime();
      const reminderAt = eta - profile.notificationPreferences.checkinReminderMinutes * 60000;
      const graceEnd = eta + checkin.graceMinutes * 60000;

      if (checkin.status === 'scheduled' && now >= reminderAt) {
        try {
          const c = await backend.updateCheckin(checkin.id, { status: 'reminded', notificationStatus: 'user_reminded' });
          setCheckin(c);
          await notify({ type: 'checkin', title: 'Almost there?', body: `Your expected arrival is ${formatTime(checkin.expectedArrival)}. Confirm when you arrive.`, link: '/journey', tag: `remind-${checkin.id}` });
        } catch {
          /* retry on next tick */
        }
      }
      if (now >= eta && now >= snoozeUntil.current) setPromptOpen(true);

      // The server monitor only runs with email set up; otherwise the client records the miss.
      if ((config.isDemo || !config.emailInvites) && checkin.status !== 'missed' && now >= graceEnd) {
        const willNotify = checkin.notifyContacts && checkin.contactIds.length > 0;
        const c = await backend.updateCheckin(checkin.id, { status: 'missed', notificationStatus: 'not_configured' });
        setCheckin(c);
        await notify({
          type: 'checkin',
          title: 'Arrival check-in missed',
          body: !config.emailInvites
            ? 'You have not confirmed your arrival. Open your journey if you want to text someone.'
            : willNotify
            ? `Demo Mode: no messages were sent. In a live setup, ${checkin.contactIds.length} selected contact${checkin.contactIds.length === 1 ? '' : 's'} would now receive a calm email saying you have not confirmed arrival yet.`
            : 'You have not confirmed your arrival. No contacts were set to be notified.',
          link: '/journey',
          tag: `missed-${checkin.id}`,
        });
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [journey, checkin, profile, notify]);

  // Periodically refresh to pick up server-side check-in changes.
  useEffect(() => {
    if (!journey || config.isDemo) return;
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [journey, refresh]);

  const endJourney = useCallback(async (status: 'completed' | 'cancelled') => {
    if (!journey) return;
    await backend.endJourney(journey.id, status);
    setPromptOpen(false);
    setTrackingState(false);
    setJourney(null);
    setCheckin(null);
  }, [journey]);

  const confirmArrival = useCallback(async () => {
    if (!journey) return;
    setBusy(true);
    try {
      if (checkin) await backend.updateCheckin(checkin.id, { status: 'confirmed' });
      await endJourney('completed');
      toast.success('Arrival confirmed', 'Your journey has ended and sharing has stopped.');
      navigate('/dashboard');
    } catch (e) {
      toast.error('Could not confirm arrival', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [journey, checkin, endJourney, toast, navigate]);

  const extend = useCallback(async (minutes: number) => {
    if (!checkin) return;
    setBusy(true);
    try {
      const base = Math.max(Date.now(), new Date(checkin.expectedArrival).getTime());
      const next = new Date(base + minutes * 60000).toISOString();
      const c = await backend.updateCheckin(checkin.id, { expectedArrival: next, status: 'scheduled', notificationStatus: 'none' });
      setCheckin(c);
      setJourney((j) => (j ? { ...j, expectedArrival: next } : j));
      setPromptOpen(false);
      snoozeUntil.current = 0;
      toast.success('Arrival time extended', `New expected arrival: ${formatTime(next)}.`);
    } catch (e) {
      toast.error('Could not extend', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [checkin, toast]);

  const setSharing = useCallback(async (patch: { enabled?: boolean; liveLocation?: boolean }) => {
    if (!journey) return;
    const j = await backend.updateJourneySharing(journey.id, patch);
    setJourney(j);
    if (patch.liveLocation === false || patch.enabled === false) lastPush.current = 0;
  }, [journey]);

  const value = useMemo<JourneyState>(() => ({
    journey, checkin, loading, refresh, position, tracking, trackingError,
    setTracking: setTrackingState, confirmArrival, extend, endJourney, setSharing,
  }), [journey, checkin, loading, refresh, position, tracking, trackingError, confirmArrival, extend, endJourney, setSharing]);

  const missed = checkin?.status === 'missed';
  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={promptOpen && !!journey && !!checkin}
        onClose={() => {
          snoozeUntil.current = Date.now() + 2 * 60000;
          setPromptOpen(false);
        }}
        title={missed ? 'Are you okay?' : 'Have you arrived?'}
        description={journey ? `You planned to reach ${journey.destination.label} by ${formatTime(checkin?.expectedArrival ?? journey.expectedArrival)}.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => extend(15)} disabled={busy} icon={<IconClock size={18} />}>Extend 15 min</Button>
            <Button variant="teal" onClick={confirmArrival} loading={busy} icon={<IconCheckCircle size={18} />}>I've arrived</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            {[10, 30].map((m) => (
              <Button key={m} size="sm" variant="subtle" onClick={() => extend(m)} disabled={busy}>Extend {m} min</Button>
            ))}
          </div>
          <Notice tone="neutral" title="What happens if you don't respond">
            {!config.emailInvites ? (
              <>SafeRoute won't message anyone for you, and it can't alert anyone if you can't respond. Text someone yourself if you need to.</>
            ) : checkin && checkin.notifyContacts && checkin.contactIds.length > 0 ? (
              <>After a {checkin.graceMinutes}-minute grace period, SafeRoute will try to email the {checkin.contactIds.length} contact{checkin.contactIds.length === 1 ? '' : 's'} you selected to say you have not confirmed arrival yet. It will not say you are in danger, and it never contacts emergency services. Email delivery cannot be guaranteed.</>
            ) : (
              <>You chose not to notify anyone, so SafeRoute will only remind you here. No one else will be contacted.</>
            )}
            {config.isDemo && <span className="mt-1 block font-medium">Demo Mode: no messages are ever sent.</span>}
          </Notice>
          {journey && checkin && !config.emailInvites && <LateTextButtons journey={journey} checkin={checkin} />}
          {missed && checkin?.notificationStatus === 'contacts_notified' && (
            <Notice tone="info">Your selected contacts were emailed that you have not confirmed arrival. Confirming now will let you end the journey; consider messaging them directly too.</Notice>
          )}
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useJourney(): JourneyState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJourney must be used inside JourneyProvider');
  return c;
}
