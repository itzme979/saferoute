import type { ComponentType } from 'react';
import { FOUNDER_NAME, FOUNDER_QUOTE } from '@/components/FounderStory';
import { HeroVisual } from '@/components/HeroVisual';
import {
  IconArrowRight, IconClock, IconDatabase, IconFlag, IconHeart, IconLock, IconRoute, IconShieldCheck, IconUsers, type IconProps,
} from '@/components/icons';
import { ButtonLink, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const FEATURES: { icon: ComponentType<IconProps>; title: string; body: string }[] = [
  { icon: IconRoute, title: 'Personalized Routes', body: 'Compare walking, transit, bike and car routes by time, mapped street lighting, stairs, crossings and community reports, ranked by the priorities you choose.' },
  { icon: IconUsers, title: 'SafeCircle', body: 'Keep a short list of people you trust. Share a specific journey with them only when you choose to, and stop sharing at any time.' },
  { icon: IconClock, title: 'SafeArrival', body: 'Set an expected arrival time. SafeRoute reminds you to check in and, only if you opted in, lets your chosen contacts know if you haven’t.' },
  { icon: IconFlag, title: 'Community Reports', body: 'Report broken streetlights, damaged sidewalks, missing curb ramps and construction so neighbours can plan around them.' },
];

const STEPS = [
  { n: '1', title: 'Plan your journey', body: 'Enter where you are going and pick the priorities that matter to you, such as well-lit streets or avoiding stairs.' },
  { n: '2', title: 'Stay connected', body: 'Choose whether to share this journey with people in your SafeCircle, and whether to set an arrival check-in.' },
  { n: '3', title: 'Arrive with peace of mind', body: 'Confirm when you arrive. Sharing ends automatically, and you decide whether the journey is saved to your history.' },
];

const PRINCIPLES = [
  { icon: IconDatabase, title: 'Clear about where information comes from', body: 'Routes come from open routing services. Lighting, stairs and crossings come from OpenStreetMap. Hazards come from community reports. When data is missing, we say so instead of guessing.' },
  { icon: IconLock, title: 'Your location is yours', body: 'SafeRoute never shares your location automatically. Sharing happens one journey at a time, only with the people you pick, and stops when the journey ends.' },
  { icon: IconHeart, title: 'Better streets for everyone', body: 'Every report about a broken light or a missing curb ramp helps other people plan, and gives local services a clearer picture.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-teal-700 ring-1 ring-teal-100">
              <IconShieldCheck size={16} /> Know your route. Stay connected. Feel prepared.
            </p>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-[56px]">
              Every journey deserves a little more peace of mind.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Discover routes that match your preferences, stay connected with people you trust, and help make your community easier to navigate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={user ? '/dashboard' : '/signup'} size="lg" variant="teal" icon={<IconArrowRight size={18} />} className="flex-row-reverse">
                {user ? 'Open dashboard' : 'Get Started'}
              </ButtonLink>
              <ButtonLink to="/demo" size="lg" variant="secondary">Try the demo</ButtonLink>
            </div>
            <p className="mt-5 text-[13px] text-slate-500">Free to use. SafeRoute is not an emergency service and cannot guarantee safety.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-700">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">More than a map</h2>
            <p className="mt-3 text-lg text-slate-600">Four tools that work together, so you can make informed choices and stay in touch on the way.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} interactive className="p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-navy"><f.icon size={24} /></span>
                <h3 className="mt-5 text-lg font-bold text-navy">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-700">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Three simple steps</h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-bold text-white">{s.n}</span>
                  {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-gradient-to-r from-navy/30 to-transparent md:block" aria-hidden="true" />}
                </div>
                <h3 className="mt-5 text-lg font-bold text-navy">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why SafeRoute */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wider text-teal-700">Our story</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">It started with walking home alone</h2>
          <blockquote className="mt-6 text-lg leading-relaxed text-slate-700">“{FOUNDER_QUOTE}”</blockquote>
          <p className="mt-4 font-semibold text-navy">{FOUNDER_NAME}, Founder of SafeRoute</p>
          <ButtonLink to="/about#founder" variant="secondary" className="mt-6">Read the full story</ButtonLink>
        </div>
      </section>

      <section className="bg-navy py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-teal-200">Why SafeRoute</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Informed decisions, not promises</h2>
            <p className="mt-4 text-lg leading-relaxed text-sky-100">
              No app can promise that a route is safe. What SafeRoute can do is bring together the information that is available, be honest about its limits, and make it easy to keep the people you trust in the loop.
            </p>
          </div>
          <ul className="grid gap-4">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="flex gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-200"><p.icon size={22} /></span>
                <div>
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-sky-100/90">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Plan your next trip with SafeRoute</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">Create a free account in under a minute. You choose what to share, and with whom.</p>
          <div className="mt-8 flex justify-center">
            <ButtonLink to={user ? '/plan' : '/signup'} size="lg" variant="teal">{user ? 'Plan a Journey' : 'Get Started'}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
