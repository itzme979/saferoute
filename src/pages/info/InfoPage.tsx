import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconMail } from '@/components/icons';
import { Notice } from '@/components/ui';
import { config } from '@/lib/config';

type PageId = 'privacy' | 'terms' | 'help' | 'contact';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const SupportLine = () =>
  config.supportEmail ? (
    <a className="inline-flex items-center gap-2 font-semibold text-teal-700 underline-offset-2 hover:underline" href={`mailto:${config.supportEmail}`}>
      <IconMail size={18} /> {config.supportEmail}
    </a>
  ) : (
    <span className="text-slate-500">The operator of this SafeRoute installation has not configured a support address yet.</span>
  );

const PAGES: Record<PageId, { title: string; intro: string; body: ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'SafeRoute handles location information, which is sensitive. This page explains what we collect, why, and the control you have over it.',
    body: (
      <>
        <Section title="What we collect">
          <p><strong>Account details:</strong> your name, email address, optional phone number and optional profile photo.</p>
          <p><strong>Preferences:</strong> your walking, notification and privacy settings.</p>
          <p><strong>Trusted contacts:</strong> names, email addresses or phone numbers and relationship labels you add. Contacts are private to you.</p>
          <p><strong>Journeys:</strong> start, destination, chosen route, timings and sharing settings. If you turn off journey history, journeys are deleted when they end.</p>
          <p><strong>Location:</strong> only when you allow it in your browser, and only for the feature you are using. Live location is stored only when you turn on live sharing for a specific journey. It is cleared when sharing stops or the journey ends.</p>
          <p><strong>Hazard reports:</strong> category, description, approximate location (rounded to roughly 11 metres) and an optional photo. Photos are re-encoded on your device to remove hidden location metadata before upload.</p>
        </Section>
        <Section title="What other people can see">
          <p>Hazard reports are visible to signed-in SafeRoute users without your name or account details. Please do not report your own home address or include personal details.</p>
          <p>Trusted contacts only see a journey if you share that specific journey with them, through a private link that stops working when the journey ends or you stop sharing.</p>
        </Section>
        <Section title="Your choices">
          <p>You can edit your profile, clear your journey history, stop sharing at any time, revoke location permission in your browser settings, and permanently delete your account from Settings. Deleting your account removes your profile, contacts, journeys and notifications. Hazard reports you created remain for the community but are no longer linked to you.</p>
        </Section>
        <Section title="Service providers">
          <p>SafeRoute uses Supabase for accounts and data storage, Resend for email delivery, OpenRouteService and FOSSGIS OSRM for routing, the Overpass API for OpenStreetMap data, Photon for address search and OpenFreeMap for map tiles. Route and area data comes from police open data portals (Toronto Police Service, Ottawa Police Service, Ville de Montréal, data.police.uk), City of Toronto open data and NASA GIBS. Local news is fetched through SafeRoute's server from Google News using only the neighbourhood name. Requests to map and data services include the coordinates or area needed to answer them.</p>
        </Section>
      </>
    ),
  },
  terms: {
    title: 'Terms of Service',
    intro: 'By using SafeRoute you agree to these terms. Please read them, especially the section on limitations.',
    body: (
      <>
        <Section title="SafeRoute is a decision-support tool">
          <p>SafeRoute provides information to help you plan walking journeys and share them with people you trust. It does not guarantee your safety, does not prevent crime, and is not a replacement for emergency services. Always use your own judgement and follow local traffic rules.</p>
        </Section>
        <Section title="Information may be incomplete">
          <p>Route, lighting, accessibility and hazard information comes from third-party and community sources and may be inaccurate, incomplete or out of date. SafeRoute does not provide turn-by-turn navigation.</p>
        </Section>
        <Section title="Notifications are not guaranteed">
          <p>Reminders, check-in messages and alerts depend on your device, browser, network and email providers. They may be delayed or not delivered. Do not rely on SafeRoute as your only way to stay in touch.</p>
        </Section>
        <Section title="Community conduct">
          <p>Reports must be accurate and respectful. Do not post personal information, harassment, spam or inappropriate images. Reports may be hidden by community flags or moderators, and accounts that misuse the service may be suspended.</p>
        </Section>
        <Section title="Contacting others">
          <p>Only add people as trusted contacts if you know them and believe they would agree to receive messages from SafeRoute on your behalf. Contacts can decline invitations.</p>
        </Section>
      </>
    ),
  },
  help: {
    title: 'Help and Support',
    intro: 'Answers to common questions about using SafeRoute.',
    body: (
      <>
        <Section title="How are routes compared?">
          <p>SafeRoute requests up to three walking routes, then checks each one against OpenStreetMap data and community reports. Routes are ranked only against each other, based on the priorities you choose. There is no overall “safety score”. Any factor without enough data for every route is left out of the comparison, and we tell you which ones.</p>
        </Section>
        <Section title="Why does a route say “No data” for lighting?">
          <p>In Toronto, Brampton, Burlington and Whitby, SafeRoute uses the municipality's official light-pole records. Elsewhere, street lighting is mapped by volunteers in OpenStreetMap and is missing in many areas. “No data” means unknown, not unlit. You can help by contributing to OpenStreetMap.</p>
        </Section>
        <Section title="Where does the crime information come from?">
          <p>From police open data: Toronto Police Service, Ottawa Police Service, the SPVM in Montréal and data.police.uk for England, Wales and Northern Ireland. SafeRoute counts incidents reported within 75 m of each route and within 400 m of your start and destination over the most recent 12 months published (3 months in the UK). If you turn on “Avoid reported crime”, routes are compared by crimes against people (such as assault and robbery). Police offset locations for privacy and each source leaves out some offence types, so these numbers describe what was reported, not how safe a street is. Other areas show “No data”.</p>
        </Section>
        <Section title="What happens if I miss an arrival check-in?">
          <p>A few minutes before your expected arrival, SafeRoute reminds you. At the expected time it asks whether you have arrived, and you can confirm or extend. If you still have not responded after your grace period, and only if you chose to notify contacts for that journey, SafeRoute tries to email the contacts you selected to say you have not confirmed arrival. It never says you are in danger and never contacts emergency services.</p>
        </Section>
        <Section title="Location is not working">
          <p>Check that location is allowed for this site in your browser settings and that your device's location services are on. You can always type an address instead.</p>
        </Section>
        <Section title="Browser notifications">
          <p>Turn them on in Settings. Your browser will ask for permission. If you previously blocked notifications, you will need to allow them in your browser's site settings.</p>
        </Section>
        <Section title="Still need help?">
          <p><SupportLine /></p>
        </Section>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    intro: 'Questions, feedback or a problem with a community report? We would like to hear from you.',
    body: (
      <>
        <Section title="Email">
          <p><SupportLine /></p>
        </Section>
        <Notice tone="warning" title="In an emergency" className="mt-8">
          SafeRoute support cannot respond to emergencies. Call your local emergency number.
        </Notice>
        <p className="mt-6 text-[15px] text-slate-600">To report an inaccurate or inappropriate hazard report, open it on the <Link to="/community" className="font-semibold text-teal-700 hover:underline">Community Map</Link> and use “Flag report”.</p>
      </>
    ),
  },
};

export default function InfoPage({ page }: { page: PageId }) {
  const p = PAGES[page];
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{p.title}</h1>
      <p className="mt-3 text-lg text-slate-600">{p.intro}</p>
      {p.body}
    </article>
  );
}
