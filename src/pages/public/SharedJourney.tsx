import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { IconClock, IconInfo, IconNavigation, IconPin } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { LazyMap, type MapMarker } from '@/components/map/LazyMap';
import { Badge, Card, EmptyState, Notice, Skeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { formatDistance, formatTime, minutesUntil, timeAgo } from '@/lib/format';
import { backend } from '@/services';

/** Public page a trusted contact opens from a share link. Shows data only while the journey is active. */
export default function SharedJourney() {
  const { token = '' } = useParams();
  const view = useAsync(() => backend.getSharedJourney(token), [token]);

  useEffect(() => {
    const id = setInterval(() => view.reload(), 30000);
    return () => clearInterval(id);
  }, [view.reload]);

  const v = view.data;
  const markers: MapMarker[] = v?.origin && v.destination ? [
    { id: 'o', lat: v.origin.lat, lng: v.origin.lng, kind: 'origin', label: 'Start' },
    { id: 'd', lat: v.destination.lat, lng: v.destination.lng, kind: 'destination', label: 'Destination' },
    ...(v.liveLocation ? [{ id: 'live', lat: v.liveLocation.lat, lng: v.liveLocation.lng, kind: 'live' as const, label: `${v.ownerFirstName}'s last shared location` }] : []),
  ] : [];

  return (
    <div className="min-h-screen bg-warm">
      <header className="border-b border-navy/[0.06] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4"><Logo /></div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">
        {view.loading && !v ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : view.error ? (
          <Notice tone="warning">{view.error}</Notice>
        ) : !v ? (
          <Card className="p-2"><EmptyState icon={<IconNavigation />} title="This link isn't active" description="The journey may have ended, or sharing was turned off. Shared links only work while a journey is in progress." /></Card>
        ) : v.status !== 'active' ? (
          <Card className="p-2"><EmptyState icon={<IconNavigation />} title={`${v.ownerFirstName}'s journey has ended`} description={v.status === 'completed' ? `They confirmed their arrival${v.endedAt ? ` ${timeAgo(v.endedAt)}` : ''}.` : 'They ended this journey. Sharing has stopped.'} /></Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <Card className="overflow-hidden">
              <LazyMap className="h-80 sm:h-[480px]" routes={v.route ? [{ id: 'r', coordinates: v.route.coordinates, selected: true }] : []} markers={markers} fitKey={token} ariaLabel="Map of shared journey" />
            </Card>
            <div className="space-y-4">
              <div>
                <Badge tone="teal">Journey in progress</Badge>
                <h1 className="mt-2 text-2xl font-extrabold text-navy">{v.ownerFirstName} shared a journey with you</h1>
              </div>
              <Card className="space-y-3 p-4 text-sm">
                <p className="flex gap-2"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-navy" aria-hidden="true" /><span><span className="text-slate-500">From</span><br /><span className="font-medium text-navy">{v.origin?.label}</span></span></p>
                <p className="flex gap-2"><IconPin size={16} className="mt-0.5 shrink-0 text-navy" /><span><span className="text-slate-500">To</span><br /><span className="font-medium text-navy">{v.destination?.label}</span></span></p>
                {v.expectedArrival && (
                  <p className="flex gap-2"><IconClock size={16} className="mt-0.5 shrink-0 text-slate-400" /><span><span className="text-slate-500">Expected arrival</span><br /><span className="font-semibold text-navy">{formatTime(v.expectedArrival)}</span> <span className="text-slate-500">({minutesUntil(v.expectedArrival) >= 0 ? `in ${minutesUntil(v.expectedArrival)} min` : `${-minutesUntil(v.expectedArrival)} min ago`})</span></span></p>
                )}
                {v.route && <p className="text-slate-500">Route length {formatDistance(v.route.distanceM)}</p>}
                {v.checkinStatus === 'missed' && <Notice tone="info">{v.ownerFirstName} hasn't confirmed arrival yet. This doesn't necessarily mean anything is wrong. You may want to contact them directly.</Notice>}
              </Card>
              <Card className="p-4 text-sm text-slate-600">
                {v.liveLocation ? (
                  <p>Showing {v.ownerFirstName}'s approximate location, last updated {v.liveLocationAt ? timeAgo(v.liveLocationAt) : 'recently'}. It updates only while their app is open.</p>
                ) : (
                  <p>{v.ownerFirstName} is sharing their planned route and arrival time, not their live location.</p>
                )}
              </Card>
              <p className="flex items-start gap-2 text-[12px] text-slate-500"><IconInfo size={14} className="mt-0.5 shrink-0" /> This page refreshes every 30 seconds and stops working when the journey ends. If you believe someone is in immediate danger, call your local emergency number.</p>
              {config.isDemo && <Notice tone="neutral">Demo Mode: this page only works in the browser that started the journey.</Notice>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
