# SafeRoute

**Know your route. Stay connected. Feel prepared.**

SafeRoute is a walking decision-support and journey-sharing app. It compares real walking routes against the priorities you choose, lets you share a specific journey with people you trust, offers optional arrival check-ins, supports community hazard reporting, and includes SafeSOS for reaching emergency services or trusted contacts quickly.

SafeRoute never claims a route is safe, never invents safety data, and is not an emergency service.

---

## Quick start (Demo Mode, no keys needed)

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase keys configured, the app runs in **Demo Mode**:

| What | Demo Mode behaviour |
|---|---|
| Accounts and data | Stored only in this browser (`localStorage`). |
| Emails (invites, shares, SOS, missed check-ins) | **Never sent.** The UI says so every time. |
| Routes, address search, map, OpenStreetMap street details | **Real** public services. |
| Sample contacts, journeys, hazard reports, sample routes | Labelled **Sample** and fictional. Remove them in *Settings > Demo data*. |
| Moderation | Every demo account is a moderator, so you can try the queue. |
| Password reset | Shows a one-time on-screen link instead of emailing. |

Other commands: `npm test` (unit tests), `npm run build` (type check and production build), `npm run preview`.

---

## Architecture

```
src/
  components/      UI primitives (ui.tsx), SVG icons, map, route + hazard components
  context/         Auth, notifications, toasts, active journey + SafeArrival watcher
  services/
    backend.ts         Backend interface (single contract for the UI)
    supabaseBackend.ts Production: Supabase Auth, Postgres (RLS), Storage, Edge Functions
    demoBackend.ts     Demo Mode: local, clearly labelled, sends nothing
    routing.ts         OpenRouteService (via Edge Function) with OSRM fallback
    osmEnrichment.ts   OpenStreetMap street details via Overpass
    routeAnalysis.ts   Transparent, relative route comparison (no "safety score")
    geocode.ts         Photon address search
  pages/           Landing, auth, onboarding, dashboard, plan, active journey,
                   SafeCircle, community map, settings, history, SOS, moderation,
                   public shared-journey and invitation pages
supabase/
  migrations/      Schema, RLS policies, triggers, RPCs, storage buckets
  functions/       routes, notify, checkin-monitor, delete-account (Deno)
  cron.sql         Schedules the missed-check-in monitor
```

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router, MapLibre GL, Supabase. All icons are inline SVG.

### Where route information comes from

| Shown on a route | Source | Notes |
|---|---|---|
| Geometry, time, distance, turns | OpenRouteService `foot-walking` (key stays server-side), falling back to the FOSSGIS OSRM foot server | Up to 3 alternatives. If only one exists, we say so. |
| Street lighting (Toronto, Brampton, Burlington, Whitby) | Municipal open data, such as Toronto's *Topographic Mapping - Poles* (street, pedestrian and combined light poles), pre-built into static tiles in `public/data/streetlights/` | Share of the route within 35 m of a pole. Used for ranking instead of OSM where every route is covered. Refresh with `node scripts/build-streetlights.mjs`. |
| Street lighting (elsewhere) | OpenStreetMap `lit=*` tags and `highway=street_lamp` nodes | Unknown is shown as **No data**, never as "unlit". |
| Night-time brightness | NASA Black Marble (VIIRS, BRDF-corrected, gap-filled) via NASA GIBS tiles; median of three recent nights | ~500 m pixels and saturates in city centres, so it is context only and **never ranks routes**. Also a map layer. |
| Reported crime | Toronto Police (Major Crime Indicators), Ottawa Police (Criminal Offences), SPVM Montréal (Actes criminels), data.police.uk | Last 12 published months (3 for the UK). Incidents within 75 m of a route and 400 m of start/destination. The *Avoid reported crime* priority ranks by crimes against people only. Map heatmap layer on Plan and Community Map. `src/services/crime.ts`. |
| Local news | Google News RSS search for the start/destination neighbourhood, via the `api/news.ts` Vercel edge function (cached 30 min) | Context only, **never ranks routes**. |
| Stairs, surfaces, sidewalks, mapped crossings, construction | OpenStreetMap | Coverage varies by area. |
| Shops and public places | OpenStreetMap `shop=*` and selected `amenity=*` | Used only as a disclosed proxy for "prefer busier streets". |
| Pedestrian activity | **No source connected** | Always shown as "Not available". |
| Hazards | SafeRoute community reports within 30 m | Only active reports. |

**Comparison method:** each enabled priority compares the routes on screen against each other. The best route gets full marks and the others are scaled between best and worst. Your priorities count twice as much as walking time and community reports. A factor without data for **every** route is skipped and listed as skipped. The UI explains all of this under *How it works*.

---

## Going live: setup guide

### 1. Supabase (accounts and database)

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/20261031000000_init.sql` in the SQL editor, or run `supabase link` then `supabase db push`.
3. In **Authentication > URL Configuration**, set the Site URL to your app URL and add `https://your-app/onboarding` and `https://your-app/reset-password` as redirect URLs.
4. Keep **Confirm email** enabled (Authentication > Providers > Email).
5. Copy `.env.example` to `.env.local` and set:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
   The anon key is designed to be public. Row Level Security protects the data. **Never** put the service-role key in the frontend.

### 2. Edge Functions and secrets (server-side only)

```bash
supabase functions deploy routes
supabase functions deploy notify
supabase functions deploy delete-account
supabase functions deploy checkin-monitor --no-verify-jwt

supabase secrets set ORS_API_KEY=<openrouteservice key>   # free: https://openrouteservice.org/dev/#/signup
supabase secrets set RESEND_API_KEY=<resend key>          # https://resend.com
supabase secrets set EMAIL_FROM="SafeRoute <alerts@your-verified-domain.com>"
supabase secrets set APP_URL=https://your-app-domain
supabase secrets set CRON_SECRET=<long random string>
```

* **Resend:** verify your sending domain. Until you do, Resend only delivers to your own address. If `RESEND_API_KEY` is missing, the app tells users that no email was sent.
* **OpenRouteService:** if the key is missing or the service fails, routing falls back to the public OSRM server and the UI shows a notice.

### 3. Missed check-in monitor

Edit the two placeholders in `supabase/cron.sql`, then run it in the SQL editor. It calls `checkin-monitor` every minute. The monitor:

* only acts on check-ins past expected arrival **plus** the user's grace period;
* only emails contacts the user selected **for that journey**, who accepted the invitation and allow check-in alerts;
* uses calm wording ("hasn't confirmed arrival yet; this doesn't necessarily mean anything is wrong");
* never contacts emergency services.

### 4. Moderators

```sql
update public.profiles set is_moderator = true where email = 'you@example.com';
```

Moderators see `/moderation`. Reports are hidden automatically after 3 flags.

### 5. Production recommendations

* **Overpass API:** the public servers are volunteer-run and can take 30 to 100+ seconds when busy. SafeRoute shows routes immediately, enriches them in the background, and falls back to a mirror. For launch, point `VITE_OVERPASS_URL` at a dedicated instance or a commercial provider.
* **Map tiles:** OpenFreeMap is free and needs no key. You can override it with `VITE_MAP_STYLE_URL`.
* **Address search:** Photon's public instance is rate-limited. Consider self-hosting it or a paid geocoder at scale.
* Set `VITE_SUPPORT_EMAIL` so the Contact and Help pages show a support address.

---

## Security and privacy model

* **RLS on every table.** Profiles, contacts, journeys, check-ins, notifications, votes and flags are readable and writable only by their owner.
* **Restricted profile updates.** Users cannot change `is_moderator` or `email`; column grants enforce this.
* **No forged acceptance.** Invitation status can only become `accepted` or `declined` through `respond_invite()`, called by the invited person via their token.
* **Hazard reports are public but de-identified.** They are read through `hazard_reports_public`, which omits `user_id` and hides moderated reports.
  * Locations are rounded to about 11 m by a database trigger.
  * Descriptions containing emails or phone numbers are rejected.
  * Photos are re-encoded in the browser to strip EXIF/GPS data.
  * Reports are rate-limited to 5 per hour.
* **Shared journeys** use an unguessable token, return data only while the journey is active and sharing is on, and include live location only if the user enabled it for that journey.
* **Live location** is sent only during an active, shared journey with live sharing on, only while the app is open, and is cleared when sharing stops or the journey ends.
* **Secrets** (ORS, Resend, service role, cron secret) exist only in Edge Function secrets.
* **Account deletion** removes the auth user (cascading to all private data) and the user's avatar files. Hazard reports remain but are de-identified.

---

## Known limitations (stated honestly in the UI)

* No turn-by-turn navigation. The active journey screen shows the route, progress and distance remaining.
* Location updates and in-app reminders only run while SafeRoute is open. The server-side monitor covers missed check-ins when the browser is closed.
* Browser notifications require permission and may be blocked or delayed. Email delivery is not guaranteed.
* SafeSOS **Call** opens the device dialer with a `tel:` link. SafeRoute never places or simulates calls.
* SMS is not implemented. Phone numbers are used for one-tap calling in SafeSOS.

---

## Licence

The SafeRoute code is released under the [MIT Licence](LICENSE). This does not cover third-party data: the streetlight files in `public/data/` keep the licences of the municipalities that publish them (each `index.json` names its licence and source), and route, map and transit data remain subject to the terms of their providers.

Public transit uses [Transitous](https://transitous.org/api/), whose terms allow open-source, non-commercial projects only. Replace it before using SafeRoute commercially.
