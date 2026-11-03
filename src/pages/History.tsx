import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconClock, IconHistory, IconPin, IconRoute, IconRuler, IconShare, IconTrash } from '@/components/icons';
import { LazyMap } from '@/components/map/LazyMap';
import { Badge, Button, ButtonLink, Card, EmptyState, Modal, Notice, SampleBadge, SectionHeader, Skeleton } from '@/components/ui';
import { useProfile } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime, formatDistance, formatDuration, formatTime } from '@/lib/format';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import type { Journey } from '@/types';

export default function History() {
  const profile = useProfile();
  const toast = useToast();
  const journeys = useAsync(() => backend.listJourneys(), []);
  const [open, setOpen] = useState<Journey | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const past = (journeys.data ?? []).filter((j) => j.status !== 'active');

  const remove = async (j: Journey) => {
    if (deleting) return;
    setDeleting(j.id);
    try {
      await backend.deleteJourney(j.id);
      journeys.setData((l) => l?.filter((x) => x.id !== j.id));
      setOpen(null);
      toast.success('Journey deleted');
    } catch (e) {
      toast.error('Could not delete', errorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <PageContainer>
      <SectionHeader as="h1" title="Journey history" description="Only you can see your journey history." />
      {!profile.privacy.saveJourneyHistory && (
        <Notice tone="info" className="mb-4" action={<Link to="/settings#privacy" className="font-semibold text-teal-700 underline">Privacy settings</Link>}>
          Journey history is off. New journeys are deleted when they end.
        </Notice>
      )}
      {journeys.loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : journeys.error ? (
        <Notice tone="warning" action={<Button size="sm" variant="secondary" onClick={journeys.reload}>Try again</Button>}>{journeys.error}</Notice>
      ) : past.length === 0 ? (
        <Card className="p-2"><EmptyState icon={<IconHistory />} title="No past journeys" description="Completed and cancelled journeys appear here." action={<ButtonLink to="/plan" variant="teal" icon={<IconRoute size={18} />}>Plan a Journey</ButtonLink>} /></Card>
      ) : (
        <ul className="space-y-3">
          {past.map((j) => (
            <li key={j.id}>
              <Card interactive className="p-0">
                <button type="button" onClick={() => setOpen(j)} className="flex w-full items-center gap-4 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-navy"><IconRoute size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{j.origin.label.split(',')[0]} to {j.destination.label.split(',')[0]}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-slate-500">
                      <span>{formatDateTime(j.startedAt)}</span>
                      <span>{formatDistance(j.route.distanceM)}</span>
                      <span>{formatDuration(j.route.durationS)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={j.status === 'completed' ? 'teal' : 'grey'}>{j.status === 'completed' ? 'Completed' : 'Cancelled'}</Badge>
                    {j.isSample && <SampleBadge />}
                  </div>
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Journey details" size="lg"
        footer={open && (
          <>
            <Button variant="ghost" className="text-coral-700 hover:bg-coral-50" icon={<IconTrash size={16} />} loading={deleting === open.id} onClick={() => remove(open)}>Delete</Button>
            <Button onClick={() => setOpen(null)}>Close</Button>
          </>
        )}
      >
        {open && (
          <div className="space-y-4">
            <LazyMap className="h-56 rounded-xl" routes={[{ id: 'r', coordinates: open.route.coordinates, selected: true }]} fitKey={open.id}
              markers={[
                { id: 'o', lat: open.origin.lat, lng: open.origin.lng, kind: 'origin', label: 'Start' },
                { id: 'd', lat: open.destination.lat, lng: open.destination.lng, kind: 'destination', label: 'Destination' },
              ]} ariaLabel="Map of past journey" />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-navy" aria-hidden="true" /><div><dt className="text-slate-500">From</dt><dd className="font-medium text-navy">{open.origin.label}</dd></div></div>
              <div className="flex gap-2"><IconPin size={16} className="mt-0.5 shrink-0 text-navy" /><div><dt className="text-slate-500">To</dt><dd className="font-medium text-navy">{open.destination.label}</dd></div></div>
              <div className="flex gap-2"><IconClock size={16} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-slate-500">Timing</dt><dd className="font-medium text-navy">Started {formatTime(open.startedAt)}{open.endedAt ? `, ended ${formatTime(open.endedAt)}` : ''}</dd></div></div>
              <div className="flex gap-2"><IconRuler size={16} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-slate-500">Route</dt><dd className="font-medium text-navy">{open.route.name} · {formatDistance(open.route.distanceM)} · {open.route.turns} turns</dd></div></div>
              <div className="flex gap-2"><IconShare size={16} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-slate-500">Sharing</dt><dd className="font-medium text-navy">{open.shareEnabled ? 'Shared with SafeCircle' : 'Not shared'}</dd></div></div>
            </dl>
            {open.route.summary.length > 0 && <p className="text-[13px] text-slate-500">At the time: {open.route.summary.join(' · ')}. Source: {open.route.provider}.</p>}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
