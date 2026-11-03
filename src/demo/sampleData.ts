/**
 * DEMONSTRATION DATA
 * Everything in this file is fictional sample content used only in Demo Mode
 * or when a user explicitly chooses "View sample routes". It is always marked
 * with `isSample: true` and labelled "Sample" in the interface. It is not real
 * lighting, hazard or pedestrian information.
 */
import type { HazardReport, Journey, Place, TrustedContact, WalkingRoute } from '@/types';
import { lineLength } from '@/lib/geo';

export const SAMPLE_ORIGIN: Place = { label: 'Union Station, Toronto (sample)', lat: 43.6453, lng: -79.3806 };
export const SAMPLE_DESTINATION: Place = { label: "Queen's Park, Toronto (sample)", lat: 43.6629, lng: -79.3918 };

const coordsA: [number, number][] = [[-79.3806, 43.6453], [-79.3846, 43.6461], [-79.3868, 43.651], [-79.3888, 43.6553], [-79.3903, 43.6595], [-79.3918, 43.6629]];
const coordsB: [number, number][] = [[-79.3806, 43.6453], [-79.3786, 43.6459], [-79.3815, 43.6519], [-79.3833, 43.656], [-79.3857, 43.661], [-79.3893, 43.6617], [-79.3918, 43.6629]];
const coordsC: [number, number][] = [[-79.3806, 43.6453], [-79.3838, 43.6446], [-79.3878, 43.648], [-79.3896, 43.6507], [-79.3912, 43.6548], [-79.3927, 43.659], [-79.3918, 43.6629]];

function sampleRoute(id: string, name: string, coordinates: [number, number][], turns: number, m: Partial<WalkingRoute['metrics']>): WalkingRoute {
  const distanceM = lineLength(coordinates) * 1.08;
  return {
    id,
    name,
    coordinates,
    distanceM,
    durationS: distanceM / 1.3,
    turns,
    provider: 'Sample data',
    enrichment: 'available',
    isSample: true,
    metrics: {
      litPct: null, unlitPct: null, lightingCoveragePct: null, stairs: null, crossings: null, publicPlaces: null,
      isolatedPct: null, unpavedPct: null, noSidewalkPct: null, osmConstruction: null, hazards: [], ...m,
    },
  };
}

export const SAMPLE_ROUTES: WalkingRoute[] = [
  sampleRoute('sample-a', 'Via University Ave', coordsA, 3, { litPct: 0.82, unlitPct: 0.02, lightingCoveragePct: 0.84, stairs: 0, crossings: 9, publicPlaces: 21, isolatedPct: 0, unpavedPct: 0, noSidewalkPct: 0, osmConstruction: 0, hazards: [{ id: 'sample-h2', category: 'construction', isSample: true }] }),
  sampleRoute('sample-b', 'Via Bay St', coordsB, 4, { litPct: 0.74, unlitPct: 0, lightingCoveragePct: 0.74, stairs: 0, crossings: 12, publicPlaces: 48, isolatedPct: 0, unpavedPct: 0, noSidewalkPct: 0, osmConstruction: 0, hazards: [] }),
  sampleRoute('sample-c', 'Via Simcoe St', coordsC, 5, { litPct: 0.51, unlitPct: 0.12, lightingCoveragePct: 0.63, stairs: 1, crossings: 7, publicPlaces: 11, isolatedPct: 0.06, unpavedPct: 0.02, noSidewalkPct: 0, osmConstruction: 0, hazards: [{ id: 'sample-h1', category: 'lighting', isSample: true }] }),
];

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export function sampleHazards(): (HazardReport & { userId: string | null })[] {
  const base = { photoUrl: null, isOwn: false, resolvedVotes: 0, stillThereVotes: 0, myVote: null, statusChangedAt: null, isSample: true, userId: null };
  return [
    { ...base, id: 'sample-h1', category: 'lighting', description: 'Two streetlights out on the west side of the block after dusk.', lat: 43.6508, lng: -79.3895, status: 'active', createdAt: daysAgo(2), stillThereVotes: 2 },
    { ...base, id: 'sample-h2', category: 'construction', description: 'Sidewalk narrowed by scaffolding. Covered walkway in place.', lat: 43.6532, lng: -79.3879, status: 'active', createdAt: daysAgo(5) },
    { ...base, id: 'sample-h3', category: 'sidewalk', description: 'Large crack and uneven pavement near the bus shelter.', lat: 43.6566, lng: -79.3843, status: 'active', createdAt: daysAgo(9) },
    { ...base, id: 'sample-h4', category: 'accessibility', description: 'Curb ramp missing on the north-east corner.', lat: 43.6487, lng: -79.3772, status: 'active', createdAt: daysAgo(12) },
    { ...base, id: 'sample-h5', category: 'intersection', description: 'Short pedestrian signal; hard to finish crossing in time.', lat: 43.6559, lng: -79.3801, status: 'active', createdAt: daysAgo(3) },
    { ...base, id: 'sample-h6', category: 'obstacle', description: 'Fallen branch partially blocking the path.', lat: 43.6612, lng: -79.3946, status: 'resolved', createdAt: daysAgo(20), statusChangedAt: daysAgo(17), resolvedVotes: 3 },
    { ...base, id: 'sample-h7', category: 'other', description: 'Standing water pools across the path after heavy rain.', lat: 43.6441, lng: -79.3868, status: 'outdated', createdAt: daysAgo(45), statusChangedAt: daysAgo(30) },
  ];
}

export function sampleContacts(): TrustedContact[] {
  return [
    { id: crypto.randomUUID(), name: 'Jordan Lee (sample)', email: 'jordan@example.com', phone: null, relationship: 'Sibling', inviteStatus: 'accepted', invitedAt: daysAgo(14), canReceiveJourneys: true, canReceiveCheckinAlerts: true, canReceiveSos: true, createdAt: daysAgo(14), isSample: true },
    { id: crypto.randomUUID(), name: 'Sam Rivera (sample)', email: 'sam@example.com', phone: null, relationship: 'Friend', inviteStatus: 'pending', invitedAt: daysAgo(1), canReceiveJourneys: true, canReceiveCheckinAlerts: false, canReceiveSos: true, createdAt: daysAgo(1), isSample: true },
  ];
}

export function sampleJourneys(): Journey[] {
  const r = SAMPLE_ROUTES[1];
  const mk = (d: number, status: Journey['status'], reverse = false): Journey => ({
    id: crypto.randomUUID(),
    origin: reverse ? SAMPLE_DESTINATION : SAMPLE_ORIGIN,
    destination: reverse ? SAMPLE_ORIGIN : SAMPLE_DESTINATION,
    route: { name: r.name, coordinates: reverse ? [...r.coordinates].reverse() : r.coordinates, distanceM: r.distanceM, durationS: r.durationS, turns: r.turns, provider: r.provider, summary: ['Sample journey'] },
    status,
    startedAt: daysAgo(d, 2),
    expectedArrival: daysAgo(d, 1.6),
    endedAt: daysAgo(d, 1.62),
    shareEnabled: d === 1,
    shareLiveLocation: false,
    sharedContactIds: [],
    shareToken: null,
    lastLocation: null,
    lastLocationAt: null,
    isSample: true,
  });
  return [mk(1, 'completed'), mk(3, 'completed', true), mk(6, 'cancelled')];
}
