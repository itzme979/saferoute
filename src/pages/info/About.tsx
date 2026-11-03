import { ButtonLink } from '@/components/ui';

export default function About() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-teal-700">About</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Helping people walk with more confidence</h1>
      <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-slate-700">
        <p>
          SafeRoute started with a simple observation: the fastest route is not always the one people want to walk. Students heading home after class, people walking alone at night, older adults and people using mobility aids all weigh different things, from lighting and stairs to how busy a street feels.
        </p>
        <p>
          SafeRoute brings together open map data, community reports and the people you trust. It shows you what is known about each route, explains how routes are compared, and is honest when information is missing.
        </p>
        <h2 className="pt-4 text-xl font-bold text-navy">What SafeRoute is not</h2>
        <p>
          SafeRoute is not an emergency service or a guarantee. It does not predict danger and does not label neighbourhoods as safe or unsafe. Where police publish open data, it shows what has been reported nearby as context. If you are in immediate danger, call your local emergency number.
        </p>
        <h2 className="pt-4 text-xl font-bold text-navy">Where our data comes from</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Walking routes:</strong> OpenRouteService, with the FOSSGIS OSRM public server as a backup.</li>
          <li><strong>Street details</strong> (lighting, stairs, crossings, surfaces, sidewalks, shops): OpenStreetMap, through the Overpass API. These are mapped by volunteers, so coverage varies by area.</li>
          <li><strong>Streetlights:</strong> official light-pole locations from open data published by Toronto, Brampton, Burlington and Whitby. Elsewhere, lighting comes from OpenStreetMap.</li>
          <li><strong>Night-time brightness:</strong> NASA Black Marble satellite imagery (VIIRS) via NASA GIBS. Each pixel covers about 500 m, so it describes areas, not streets, and is never used to rank routes.</li>
          <li><strong>Reported crime:</strong> police open data from Toronto Police Service, Ottawa Police Service, the SPVM (Montréal) and data.police.uk (England, Wales and Northern Ireland). Locations are offset by police for privacy and each source leaves out some offence types.</li>
          <li><strong>Local news:</strong> recent safety-related headlines from Google News for the area around your start and destination. Shown as context only, never used to rank routes.</li>
          <li><strong>Hazards:</strong> reports from SafeRoute users, which the community can verify, resolve or flag.</li>
          <li><strong>Address search:</strong> Photon by komoot, based on OpenStreetMap.</li>
          <li><strong>Pedestrian activity:</strong> no live data source is connected, so we never show crowd levels.</li>
        </ul>
      </div>
      <div className="mt-10"><ButtonLink to="/signup" variant="teal" size="lg">Get Started</ButtonLink></div>
    </article>
  );
}
