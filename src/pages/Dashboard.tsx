import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight, IconChevronRight, IconClock, IconCrosshair, IconFlag, IconHistory, IconNavigation, IconRoute, IconSos, IconUsers,
} from '@/components/icons';
import { InstallCard } from '@/components/InstallPrompt';
import { LazyMap, type MapMarker } from '@/components/map/LazyMap';
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, Notice, SampleBadge, Skeleton } from '@/components/ui';
import { useProfile } from '@/context/AuthContext';
import { useJourney } from '@/context/JourneyContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { firstName, formatDate, formatDistance, formatDuration, formatTime, minutesUntil, timeAgo } from '@/lib/format';
import { haversine } from '@/lib/geo';
import { HAZARD_CATEGORIES } from '@/lib/hazards';
import { getCurrentPosition } from '@/lib/location';
import { PageContainer } from '@/layouts/AppLayout';
import { backend } from '@/services';
import type { LatLng } from '@/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const profile = useProfile();
  const { journey, checkin } = useJourney();
  const toast = useToast();
  const journeys = useAsync(() => backend.listJourneys(), []);
  const contacts = useAsync(() => backend.listContacts(), []);
  const hazards = useAsync(() => backend.listHazards(), []);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const origin = center ?? config.defaultCenter;
  const nearby = useMemo(() => (hazards.data ?? [])
    .filter((h) => h.status === 'active')
    .map((h) => ({ ...h, distance: haversine(origin, h) }))
    .filter((h) => !center || h.distance < 5000)
    .sort((a, b) => (center ? a.distance - b.distance : b.createdAt.localeCompare(a.createdAt)))
    .slice(0, 4), [hazards.data, origin, center]);

  const markers: MapMarker[] = useMemo(() => [
    ...nearby.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, kind: 'hazard' as const, category: h.category, label: HAZARD_CATEGORIES[h.category].label })),
    ...(center ? [{ id: 'me', lat: center.lat, lng: center.lng, kind: 'user' as const, label: 'Your approximate location' }] : []),
  ], [nearby, center]);

  const locate = async () => {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setCenter({ lat: p.lat, lng: p.lng });
    } catch (e) {
      toast.info('Location unavailable', (e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const recent = (journeys.data ?? []).filter((j) => j.status !== 'active').slice(0, 3);
  const accepted = (contacts.data ?? []).filter((c) => c.inviteStatus === 'accepted');

  return (
    <PageContainer wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-[30px]">{greeting()}, {firstName(profile.fullName)}</h1>
        </div>
        <Link to="/sos" className="hidden items-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-4 py-2.5 text-sm font-semibold text-coral-700 transition hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500 sm:inline-flex lg:hidden">
          <IconSos size={18} /> SafeSOS
        </Link>
      </div>

      <div className="mt-5"><InstallCard /></div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Primary column */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {journey ? (
            <Card className="overflow-hidden border-teal-200">
              <div className="flex flex-col gap-4 bg-gradient-to-br from-teal-50 to-white p-5 sm:flex-row sm:items-center sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white"><IconNavigation size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-teal-800">Journey in progress</p>
                  <p className="truncate text-lg font-bold text-navy">To {journey.destination.label}</p>
                  <p className="text-sm text-slate-600">Expected arrival {formatTime(journey.expectedArrival)}{journey.shareEnabled ? ' · Shared with your SafeCircle' : ''}</p>
                </div>
                <ButtonLink to="/journey" variant="teal" className="flex-row-reverse" icon={<IconArrowRight size={18} />}>Open journey</ButtonLink>
              </div>
            </Card>
          ) : (
            <Card className="relative overflow-hidden bg-navy p-6 text-white sm:p-8">
              <svg className="pointer-events-none absolute -right-10 -top-6 h-56 w-56 opacity-20" viewBox="0 0 200 200" fill="none" aria-hidden="true">
                <path d="M20 170c30-10 40-40 70-50s60 10 80-30 10-60 10-70" stroke="#4DAFA1" strokeWidth="8" strokeLinecap="round" />
              </svg>
              <h2 className="text-xl font-bold sm:text-2xl">Where are you heading?</h2>
              <p className="mt-1 max-w-md text-sky-100">Compare walking, transit, bike and car routes against your priorities, then choose whether to share the journey or set a check-in.</p>
              <ButtonLink to="/plan" variant="teal" size="lg" className="mt-5" icon={<IconRoute size={20} />}>Plan a Journey</ButtonLink>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 sm:px-5">
              <div>
                <h2 className="font-bold text-navy">Your area</h2>
                <p className="text-[13px] text-slate-500">{center ? 'Active community reports within 5 km' : 'Showing the default area. Share your location to see reports near you.'}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={locate} loading={locating} icon={<IconCrosshair size={16} />}>Near me</Button>
            </div>
            <LazyMap className="h-64 sm:h-80" center={origin} zoom={center ? 14 : 13} markers={markers} ariaLabel="Map preview of community reports" />
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-navy">Recent journeys</h2>
              <Link to="/history" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">View history <IconChevronRight size={16} /></Link>
            </div>
            {journeys.loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : journeys.error ? (
              <Notice tone="warning" action={<Button size="sm" variant="secondary" onClick={journeys.reload}>Try again</Button>}>{journeys.error}</Notice>
            ) : recent.length === 0 ? (
              <EmptyState icon={<IconHistory />} title="No journeys yet" description={profile.privacy.saveJourneyHistory ? 'Journeys you complete will appear here.' : 'Journey history is turned off in your privacy settings.'} />
            ) : (
              <ul className="divide-y divide-mist">
                {recent.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mist text-navy"><IconRoute size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-navy">{j.origin.label.split(',')[0]} to {j.destination.label.split(',')[0]}</p>
                      <p className="text-[13px] text-slate-500">{formatDate(j.startedAt)} · {formatDistance(j.route.distanceM)} · {formatDuration(j.route.durationS)}</p>
                    </div>
                    {j.isSample && <SampleBadge />}
                    <Badge tone={j.status === 'completed' ? 'teal' : 'grey'}>{j.status === 'completed' ? 'Completed' : 'Cancelled'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-navy">Upcoming check-ins</h2>
            {journey && checkin && ['scheduled', 'reminded', 'missed'].includes(checkin.status) ? (
              <Link to="/journey" className="flex items-center gap-3 rounded-xl bg-sky-50 p-3 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-navy"><IconClock size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{formatTime(checkin.expectedArrival)}</p>
                  <p className="text-[13px] text-slate-600">
                    {checkin.status === 'missed' ? 'Check-in missed. Tap to confirm.' : minutesUntil(checkin.expectedArrival) > 0 ? `In ${minutesUntil(checkin.expectedArrival)} min` : 'Due now'}
                  </p>
                </div>
                <IconChevronRight size={18} className="text-slate-400" />
              </Link>
            ) : (
              <p className="text-sm text-slate-500">No check-ins scheduled. You can add one when you start a journey.</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-navy">SafeCircle</h2>
              <Link to="/circle" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">Manage <IconChevronRight size={16} /></Link>
            </div>
            {contacts.loading ? (
              <Skeleton className="h-12" />
            ) : (contacts.data ?? []).length === 0 ? (
              <div className="text-sm text-slate-600">
                <p>Add people you trust so you can share journeys with them.</p>
                <ButtonLink to="/circle" size="sm" variant="subtle" className="mt-3" icon={<IconUsers size={16} />}>Add a contact</ButtonLink>
              </div>
            ) : (
              <>
                <div className="flex -space-x-2">
                  {(contacts.data ?? []).slice(0, 5).map((c) => <Avatar key={c.id} name={c.name} size={40} />)}
                </div>
                <p className="mt-3 text-sm text-slate-600">{accepted.length} of {contacts.data!.length} contact{contacts.data!.length === 1 ? '' : 's'} accepted your invitation.</p>
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-navy">Recent reports {center ? 'nearby' : ''}</h2>
              <Link to="/community" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">Map <IconChevronRight size={16} /></Link>
            </div>
            {hazards.loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : hazards.error ? (
              <Notice tone="warning">{hazards.error}</Notice>
            ) : nearby.length === 0 ? (
              <p className="text-sm text-slate-500">No active reports {center ? 'within 5 km' : 'yet'}.</p>
            ) : (
              <ul className="space-y-1">
                {nearby.map((h) => {
                  const meta = HAZARD_CATEGORIES[h.category];
                  return (
                    <li key={h.id}>
                      <Link to={`/community?report=${h.id}`} className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: meta.color }}><meta.icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-navy">{meta.label}</span>{h.isSample && <SampleBadge />}</span>
                          <span className="block text-[12px] text-slate-500">{timeAgo(h.createdAt)}{center ? ` · ${formatDistance(h.distance)} away` : ''}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <ButtonLink to="/community?report=new" variant="secondary" size="sm" block className="mt-3" icon={<IconFlag size={16} />}>Report a hazard</ButtonLink>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
