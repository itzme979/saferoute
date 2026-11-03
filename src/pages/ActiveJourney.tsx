import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconCheckCircle, IconClock, IconCopy, IconCrosshair, IconEyeOff, IconNavigation, IconPin, IconRoute, IconShare, IconSos, IconStop, IconUsers,
} from '@/components/icons';
import { LazyMap, type MapMarker } from '@/components/map/LazyMap';
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, Modal, Notice, Skeleton, Toggle } from '@/components/ui';
import { useJourney } from '@/context/JourneyContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { cx, formatDistance, formatDuration, formatTime, minutesUntil } from '@/lib/format';
import { progressAlong } from '@/lib/geo';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import type { CheckinStatus } from '@/types';

const CHECKIN_LABEL: Record<CheckinStatus, { label: string; tone: 'teal' | 'navy' | 'amber' | 'grey' }> = {
  scheduled: { label: 'Scheduled', tone: 'navy' },
  reminded: { label: 'Reminder sent', tone: 'navy' },
  confirmed: { label: 'Confirmed', tone: 'teal' },
  missed: { label: 'Not yet confirmed', tone: 'amber' },
  cancelled: { label: 'Turned off', tone: 'grey' },
};

export default function ActiveJourney() {
  const { journey, checkin, loading, position, tracking, trackingError, setTracking, confirmArrival, extend, endJourney, setSharing, refresh } = useJourney();
  const toast = useToast();
  const contacts = useAsync(() => backend.listContacts(), []);
  const [endOpen, setEndOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const progress = useMemo(() => (journey && position ? progressAlong(position, journey.route.coordinates) : null), [journey, position]);

  if (loading) {
    return <PageContainer><Skeleton className="h-80 rounded-2xl" /><Skeleton className="mt-4 h-40 rounded-2xl" /></PageContainer>;
  }

  if (!journey) {
    return (
      <PageContainer>
        <Card className="p-2">
          <EmptyState
            icon={<IconNavigation />}
            title="No active journey"
            description="When you start a journey, you'll see your route, arrival check-in and sharing status here."
            action={<ButtonLink to="/plan" variant="teal" icon={<IconRoute size={18} />}>Plan a Journey</ButtonLink>}
          />
        </Card>
      </PageContainer>
    );
  }

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error('Something went wrong', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const shareUrl = journey.shareToken ? `${window.location.origin}/s/${journey.shareToken}` : null;
  const sharedNames = (contacts.data ?? []).filter((c) => journey.sharedContactIds.includes(c.id)).map((c) => c.name);
  const shareable = (contacts.data ?? []).filter((c) => c.inviteStatus === 'accepted' && c.canReceiveJourneys);
  const etaMins = minutesUntil(journey.expectedArrival);
  const totalM = journey.route.distanceM;
  const pctDone = progress ? Math.min(1, progress.along / Math.max(1, totalM)) : null;
  const checkinActive = checkin && ['scheduled', 'reminded', 'missed'].includes(checkin.status);

  const markers: MapMarker[] = [
    { id: 'o', lat: journey.origin.lat, lng: journey.origin.lng, kind: 'origin', label: `Start: ${journey.origin.label}` },
    { id: 'd', lat: journey.destination.lat, lng: journey.destination.lng, kind: 'destination', label: `Destination: ${journey.destination.label}` },
    ...(position ? [{ id: 'me', lat: position.lat, lng: position.lng, kind: 'user' as const, label: 'Your current position' }] : []),
  ];

  const startSharing = () => run('share', async () => {
    await backend.updateJourneySharing(journey.id, { enabled: true, contactIds: shareIds });
    const r = await backend.notifyJourneyShare(journey.id, shareIds);
    await refresh();
    setShareOpen(false);
    if (r.simulated) toast.info('Sharing started (no messages sent)', r.message);
    else toast.success('Sharing started', `${r.sent} contact${r.sent === 1 ? '' : 's'} received a private link.`);
  });

  return (
    <div className="lg:grid lg:h-[calc(100vh-4rem)] lg:grid-cols-[1fr_minmax(360px,440px)]">
      <div className="relative h-72 sm:h-96 lg:h-full">
        <LazyMap className="absolute inset-0" routes={[{ id: 'route', coordinates: journey.route.coordinates, selected: true }]} markers={markers} fitKey={journey.id} ariaLabel="Map of your journey" />
        <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-[12px] font-medium text-slate-600 shadow-soft">Route overview. Not turn-by-turn navigation.</div>
      </div>

      <div className="space-y-4 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:border-l lg:border-navy/[0.06]">
        <div>
          <Badge tone="teal" icon={<span className="h-1.5 w-1.5 rounded-full bg-teal-600" />}>Journey in progress</Badge>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy">To {journey.destination.label.split(',')[0]}</h1>
          <p className="text-sm text-slate-600">{journey.route.name} · {formatDistance(totalM)} · started {formatTime(journey.startedAt)}</p>
        </div>

        <Card className="p-4">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected arrival</dt>
              <dd className="text-xl font-bold text-navy">{formatTime(journey.expectedArrival)}</dd>
              <dd className="text-[13px] text-slate-500">{etaMins > 0 ? `in ${formatDuration(etaMins * 60)}` : etaMins === 0 ? 'now' : `${formatDuration(-etaMins * 60)} ago`}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Distance remaining</dt>
              <dd className="text-xl font-bold text-navy">{progress ? formatDistance(progress.remaining) : '—'}</dd>
              <dd className="text-[13px] text-slate-500">{progress ? 'along your route' : 'Turn on progress to see this'}</dd>
            </div>
          </dl>
          {pctDone !== null && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={Math.round(pctDone * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
                <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${pctDone * 100}%` }} />
              </div>
              {progress && progress.offRoute > 75 && <p className="mt-2 text-[13px] text-slate-600">You appear to be about {formatDistance(progress.offRoute)} from the planned route.</p>}
            </div>
          )}
          <dl className="mt-4 space-y-2 border-t border-mist pt-3 text-sm">
            <div className="flex gap-2"><dt className="sr-only">From</dt><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-navy" aria-hidden="true" /><dd className="text-slate-700">{journey.origin.label}</dd></div>
            <div className="flex gap-2"><dt className="sr-only">To</dt><IconPin size={16} className="mt-0.5 shrink-0 text-navy" /><dd className="text-slate-700">{journey.destination.label}</dd></div>
          </dl>
          <div className="mt-3 border-t border-mist">
            <Toggle
              checked={tracking}
              onChange={(v) => {
                if (!v && journey.shareLiveLocation) {
                  toast.info('Live location is on', 'Turn off live location sharing first.');
                  return;
                }
                setTracking(v);
              }}
              label="Show my progress"
              description="Uses your device location on this screen only. It isn't shared unless live location sharing is on."
            />
            {trackingError && <Notice tone="info">{trackingError}</Notice>}
          </div>
        </Card>

        {/* SafeArrival */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold text-navy"><IconClock size={18} /> SafeArrival</h2>
            {checkin ? <Badge tone={CHECKIN_LABEL[checkin.status].tone}>{CHECKIN_LABEL[checkin.status].label}</Badge> : <Badge tone="grey">Off</Badge>}
          </div>
          {checkin && checkinActive ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Check in by {formatTime(checkin.expectedArrival)}.{' '}
                {checkin.notifyContacts && checkin.contactIds.length
                  ? `If you don't respond within ${checkin.graceMinutes} minutes after that, SafeRoute will try to email ${checkin.contactIds.length} selected contact${checkin.contactIds.length === 1 ? '' : 's'}.`
                  : 'No one will be contacted if you miss it.'}
              </p>
              {checkin.status === 'missed' && (
                <Notice tone="warning" className="mt-3" title="You haven't confirmed your arrival">
                  {checkin.notificationStatus === 'contacts_notified' ? 'Your selected contacts were emailed. Confirm now, and consider messaging them directly.' : checkin.notificationStatus === 'contacts_notify_failed' ? 'We tried to email your contacts but delivery failed. Consider messaging them directly.' : 'Confirm your arrival or extend your time.'}
                </Notice>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {[10, 15, 30].map((m) => <Button key={m} size="sm" variant="subtle" onClick={() => extend(m)}>+{m} min</Button>)}
                <Button size="sm" variant="ghost" loading={busy === 'cancel-checkin'} onClick={() => run('cancel-checkin', async () => { await backend.updateCheckin(checkin.id, { status: 'cancelled' }); await refresh(); }, 'Check-in turned off')}>Turn off check-in</Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{checkin?.status === 'cancelled' ? 'You turned off the check-in for this journey.' : 'No arrival check-in for this journey.'}</p>
          )}
        </Card>

        {/* SafeCircle sharing */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold text-navy"><IconUsers size={18} /> SafeCircle sharing</h2>
            <Badge tone={journey.shareEnabled ? 'teal' : 'grey'}>{journey.shareEnabled ? 'Sharing' : 'Not shared'}</Badge>
          </div>
          {journey.shareEnabled ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {sharedNames.length ? <>Shared with {sharedNames.join(', ')}.</> : 'Shared via private link.'} {journey.shareLiveLocation ? 'Your approximate live location is included.' : 'Only your planned route and arrival time are visible.'}
              </p>
              <div className="mt-1 border-t border-mist">
                <Toggle
                  checked={journey.shareLiveLocation}
                  onChange={(v) => run('live', () => setSharing({ liveLocation: v }), v ? 'Live location sharing on' : 'Live location sharing off')}
                  label="Share live location"
                  description={journey.shareLiveLocation ? (position ? `Last updated ${formatTime(new Date())}. Updates while this app is open.` : 'Waiting for your device location...') : 'Off. Contacts see your route and expected arrival only.'}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {shareUrl && (
                  <Button size="sm" variant="secondary" icon={<IconCopy size={16} />} onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success('Link copied', 'Only send it to people you trust.');
                    } catch {
                      toast.info('Copy this link', shareUrl);
                    }
                  }}>Copy link</Button>
                )}
                <Button size="sm" variant="ghost" icon={<IconEyeOff size={16} />} loading={busy === 'stop'} onClick={() => run('stop', () => setSharing({ enabled: false }), 'Sharing stopped. The link no longer works.')}>Stop sharing</Button>
              </div>
              {config.isDemo && shareUrl && <p className="mt-2 text-[12px] text-slate-500">Demo Mode: the link works only in this browser. <Link to={`/s/${journey.shareToken}`} target="_blank" className="font-semibold text-teal-700 underline">Preview what contacts see</Link></p>}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">No one can see this journey.</p>
              <Button size="sm" variant="secondary" className="mt-3" icon={<IconShare size={16} />} onClick={() => { setShareIds([]); setShareOpen(true); }}>Share this journey</Button>
            </>
          )}
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="teal" size="lg" icon={<IconCheckCircle size={20} />} onClick={confirmArrival}>I've arrived</Button>
          <Button variant="secondary" size="lg" icon={<IconStop size={18} />} onClick={() => setEndOpen(true)}>End journey</Button>
        </div>
        <Link to="/sos" className={cx('flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-coral-100 bg-coral-50 font-semibold text-coral-700 transition hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500')}>
          <IconSos size={20} /> Need help? Open SafeSOS
        </Link>
        <p className="flex items-start gap-2 text-[12px] text-slate-500"><IconCrosshair size={14} className="mt-0.5 shrink-0" /> SafeRoute shows your planned route but does not give turn-by-turn directions. Location updates only happen while this app is open.</p>
      </div>

      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="End this journey?" description="Sharing will stop and any arrival check-in will be cancelled."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>Keep going</Button>
            <Button variant="ghost" loading={busy === 'cancel'} onClick={() => run('cancel', async () => { await endJourney('cancelled'); setEndOpen(false); }, 'Journey cancelled')}>Cancel journey</Button>
            <Button variant="teal" onClick={() => { setEndOpen(false); confirmArrival(); }}>I've arrived</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Choose “I've arrived” if you reached your destination, or “Cancel journey” if your plans changed.</p>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this journey" description="Selected contacts receive a private link to your route and expected arrival."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button variant="teal" disabled={shareIds.length === 0} loading={busy === 'share'} onClick={startSharing}>Share</Button>
          </>
        }
      >
        {shareable.length === 0 ? (
          <p className="text-sm text-slate-600">No contacts can receive journeys yet. <Link to="/circle" className="font-semibold text-teal-700 underline">Manage your SafeCircle</Link>.</p>
        ) : (
          <div className="space-y-1">
            {shareable.map((c) => (
              <Checkbox key={c.id} checked={shareIds.includes(c.id)} onChange={(v) => setShareIds((ids) => (v ? [...ids, c.id] : ids.filter((x) => x !== c.id)))} label={c.name} description={c.relationship ?? undefined} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
