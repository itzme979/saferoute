-- =====================================================================
-- SafeRoute initial schema
-- Every table has Row Level Security enabled. Private data (profiles,
-- contacts, journeys, check-ins, notifications) is only ever visible to
-- its owner. Community hazard reports are exposed through a restricted
-- view that omits reporter identity.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  email text not null default '',
  avatar_url text,
  phone text check (phone is null or char_length(phone) <= 32),
  walking_preferences jsonb not null default '{
    "preferLit": true, "preferBusy": false, "avoidIsolated": true,
    "avoidConstruction": true, "preferAccessible": false,
    "avoidStairs": false, "fewerCrossings": false
  }'::jsonb,
  notification_preferences jsonb not null default '{
    "browser": false, "inApp": true, "checkinReminderMinutes": 5,
    "missedCheckinGraceMinutes": 15, "notifyContactsOnMissedCheckin": true,
    "hazardUpdates": true
  }'::jsonb,
  privacy jsonb not null default '{
    "saveJourneyHistory": true, "defaultShareLiveLocation": false
  }'::jsonb,
  emergency_number text not null default '911' check (emergency_number ~ '^[0-9]{2,4}$'),
  onboarded boolean not null default false,
  is_moderator boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: owner can update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Users may only update a safe subset of columns (never is_moderator / email).
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, phone, walking_preferences, notification_preferences,
              privacy, emergency_number, onboarded, updated_at)
  on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Trusted contacts (SafeCircle)
-- ---------------------------------------------------------------------
create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 32),
  relationship text check (relationship is null or char_length(relationship) <= 40),
  invite_status text not null default 'not_invited'
    check (invite_status in ('not_invited', 'pending', 'accepted', 'declined')),
  invite_token uuid not null default gen_random_uuid() unique,
  invited_at timestamptz,
  responded_at timestamptz,
  can_receive_journeys boolean not null default true,
  can_receive_checkin_alerts boolean not null default true,
  can_receive_sos boolean not null default true,
  created_at timestamptz not null default now(),
  constraint contact_has_channel check (email is not null or phone is not null)
);

create index trusted_contacts_owner_idx on public.trusted_contacts (owner_id);
alter table public.trusted_contacts enable row level security;

create policy "contacts: owner full access" on public.trusted_contacts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Owners can't forge an "accepted" status: only respond_invite() may set it.
create or replace function public.guard_contact_status()
returns trigger language plpgsql as $$
begin
  if current_setting('saferoute.invite_response', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.invite_status := 'not_invited';
  elsif new.invite_status is distinct from old.invite_status
        and new.invite_status not in ('pending') then
    raise exception 'Invitation status can only be changed by the invited person';
  end if;
  -- Changing the address invalidates any earlier acceptance.
  if tg_op = 'UPDATE' and (new.email is distinct from old.email or new.phone is distinct from old.phone) then
    new.invite_status := 'not_invited';
    new.invite_token := gen_random_uuid();
  end if;
  return new;
end $$;

create trigger trusted_contacts_guard before insert or update on public.trusted_contacts
  for each row execute function public.guard_contact_status();

-- ---------------------------------------------------------------------
-- Journeys
-- ---------------------------------------------------------------------
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  origin jsonb not null,
  destination jsonb not null,
  route jsonb not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  expected_arrival timestamptz not null,
  ended_at timestamptz,
  share_enabled boolean not null default false,
  share_live_location boolean not null default false,
  shared_contact_ids uuid[] not null default '{}',
  share_token uuid unique,
  share_revoked_at timestamptz,
  last_location jsonb,
  last_location_at timestamptz,
  created_at timestamptz not null default now()
);

create index journeys_user_idx on public.journeys (user_id, started_at desc);
create unique index journeys_one_active_per_user on public.journeys (user_id) where status = 'active';
alter table public.journeys enable row level security;

create policy "journeys: owner full access" on public.journeys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Check-ins (SafeArrival)
-- ---------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expected_arrival timestamptz not null,
  grace_minutes int not null default 15 check (grace_minutes between 5 and 60),
  notify_contacts boolean not null default false,
  contact_ids uuid[] not null default '{}',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'reminded', 'confirmed', 'missed', 'cancelled')),
  notification_status text not null default 'none'
    check (notification_status in ('none', 'user_reminded', 'contacts_notified', 'contacts_notify_failed', 'not_configured')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checkins_due_idx on public.checkins (expected_arrival) where status in ('scheduled', 'reminded');
create index checkins_user_idx on public.checkins (user_id);
alter table public.checkins enable row level security;

create policy "checkins: owner full access" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger checkins_touch before update on public.checkins
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Community hazard reports
-- ---------------------------------------------------------------------
create table public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  category text not null check (category in
    ('lighting', 'construction', 'sidewalk', 'accessibility', 'intersection', 'obstacle', 'other')),
  description text not null check (char_length(description) between 5 and 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  photo_path text,
  status text not null default 'active' check (status in ('active', 'resolved', 'outdated', 'hidden')),
  flag_count int not null default 0,
  created_at timestamptz not null default now(),
  status_changed_at timestamptz
);

create index hazard_reports_geo_idx on public.hazard_reports (lat, lng);
alter table public.hazard_reports enable row level security;

create policy "hazards: reporters see own, moderators see all" on public.hazard_reports
  for select using (auth.uid() = user_id or public.is_moderator());
create policy "hazards: authenticated users can report" on public.hazard_reports
  for insert with check (auth.uid() = user_id);
create policy "hazards: moderators can update" on public.hazard_reports
  for update using (public.is_moderator());
create policy "hazards: reporter or moderator can delete" on public.hazard_reports
  for delete using (auth.uid() = user_id or public.is_moderator());

create or replace function public.prepare_hazard_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if tg_op = 'INSERT' then
    -- Rate limit: 5 reports per user per hour.
    select count(*) into recent from public.hazard_reports
      where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent >= 5 then
      raise exception 'Report limit reached. Please try again later.' using errcode = 'P0001';
    end if;
    new.status := 'active';
    new.flag_count := 0;
    -- Store an approximate position only (about 11 m precision).
    new.lat := round(new.lat::numeric, 4)::double precision;
    new.lng := round(new.lng::numeric, 4)::double precision;
  end if;
  -- Personal contact details are not allowed in public text.
  if new.description ~* '[^@\s]+@[^@\s]+\.[a-z]{2,}' or new.description ~ '(\+?\d[\s().-]?){9,}' then
    raise exception 'Please remove email addresses or phone numbers from the description.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

create trigger hazard_reports_prepare before insert or update on public.hazard_reports
  for each row execute function public.prepare_hazard_report();

create table public.hazard_votes (
  report_id uuid not null references public.hazard_reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote text not null check (vote in ('resolved', 'outdated', 'still_there')),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
alter table public.hazard_votes enable row level security;
create policy "votes: own" on public.hazard_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.hazard_flags (
  report_id uuid not null references public.hazard_reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'inaccurate', 'personal_info', 'offensive', 'other')),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
alter table public.hazard_flags enable row level security;
create policy "flags: insert own" on public.hazard_flags
  for insert with check (auth.uid() = user_id);
create policy "flags: read own or moderator" on public.hazard_flags
  for select using (auth.uid() = user_id or public.is_moderator());

-- Community verification: a report changes status when at least 3 different
-- people (or the original reporter) confirm it is resolved/outdated and they
-- outnumber "still there" confirmations.
create or replace function public.apply_hazard_votes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.hazard_reports;
  n_resolved int; n_outdated int; n_still int; new_status text;
begin
  select * into r from public.hazard_reports where id = new.report_id;
  if r.status = 'hidden' then return new; end if;
  select count(*) filter (where vote = 'resolved'),
         count(*) filter (where vote = 'outdated'),
         count(*) filter (where vote = 'still_there')
    into n_resolved, n_outdated, n_still
    from public.hazard_votes where report_id = new.report_id;

  new_status := r.status;
  if new.user_id = r.user_id and new.vote in ('resolved', 'outdated') then
    new_status := new.vote;
  elsif n_resolved + n_outdated >= 3 and n_resolved + n_outdated > n_still then
    new_status := case when n_resolved >= n_outdated then 'resolved' else 'outdated' end;
  elsif n_still > n_resolved + n_outdated and r.status in ('resolved', 'outdated') then
    new_status := 'active';
  end if;

  if new_status is distinct from r.status then
    update public.hazard_reports set status = new_status where id = r.id;
    if r.user_id is not null and r.user_id <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      select r.user_id, 'hazard', 'Your hazard report was updated',
             'Community members marked your report as ' || new_status || '.', '/community'
      from public.profiles p
      where p.id = r.user_id and coalesce((p.notification_preferences ->> 'hazardUpdates')::boolean, true);
    end if;
  end if;
  return new;
end $$;

create or replace function public.apply_hazard_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.hazard_reports
    set flag_count = flag_count + 1,
        status = case when flag_count + 1 >= 3 then 'hidden' else status end
    where id = new.report_id;
  return new;
end $$;

-- Public, privacy-preserving view of hazard reports. Excludes reporter
-- identity and hidden (moderated) reports.
create or replace view public.hazard_reports_public
with (security_invoker = false) as
  select h.id, h.category, h.description, h.lat, h.lng, h.photo_path, h.status,
         h.created_at, h.status_changed_at,
         (h.user_id = auth.uid()) as is_own,
         (select count(*) from public.hazard_votes v where v.report_id = h.id and v.vote in ('resolved', 'outdated'))::int as resolved_votes,
         (select count(*) from public.hazard_votes v where v.report_id = h.id and v.vote = 'still_there')::int as still_there_votes,
         (select v.vote from public.hazard_votes v where v.report_id = h.id and v.user_id = auth.uid()) as my_vote
  from public.hazard_reports h
  where h.status <> 'hidden';

revoke all on public.hazard_reports_public from anon;
grant select on public.hazard_reports_public to authenticated;

-- ---------------------------------------------------------------------
-- Notifications (in-app inbox)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('journey', 'checkin', 'share', 'invite', 'hazard', 'system')),
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: owner full access" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger hazard_votes_apply after insert or update on public.hazard_votes
  for each row execute function public.apply_hazard_votes();
create trigger hazard_flags_apply after insert on public.hazard_flags
  for each row execute function public.apply_hazard_flag();

-- ---------------------------------------------------------------------
-- Outbound message log (written by Edge Functions with the service role;
-- used for rate limiting and so users can see what was sent on their behalf)
-- ---------------------------------------------------------------------
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('invite', 'journey_share', 'sos', 'missed_checkin')),
  recipient_count int not null default 0,
  delivered_count int not null default 0,
  created_at timestamptz not null default now()
);
create index outbound_messages_user_idx on public.outbound_messages (user_id, created_at desc);
alter table public.outbound_messages enable row level security;
create policy "outbound: owner can read" on public.outbound_messages
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Public RPCs (token-based, no account required)
-- ---------------------------------------------------------------------

-- Invitation landing page: returns only the inviter's first name.
create or replace function public.get_invite(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'inviterFirstName', split_part(p.full_name, ' ', 1),
    'contactName', c.name,
    'status', c.invite_status)
  from public.trusted_contacts c join public.profiles p on p.id = c.owner_id
  where c.invite_token = p_token;
$$;

create or replace function public.respond_invite(p_token uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.trusted_contacts;
begin
  select * into c from public.trusted_contacts where invite_token = p_token;
  if not found or c.invite_status not in ('pending', 'accepted', 'declined') then
    return jsonb_build_object('ok', false);
  end if;
  perform set_config('saferoute.invite_response', 'on', true);
  update public.trusted_contacts
    set invite_status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now()
    where id = c.id;
  insert into public.notifications (user_id, type, title, body, link)
  values (c.owner_id, 'invite',
          c.name || case when p_accept then ' joined your SafeCircle' else ' declined your SafeCircle invitation' end,
          case when p_accept then 'They can now receive journeys you choose to share with them.' else 'You can keep them as a contact or remove them.' end,
          '/circle');
  return jsonb_build_object('ok', true);
end $$;

-- Shared journey view for trusted contacts holding a valid share link.
-- Returns data only while the journey is active and sharing is on.
create or replace function public.get_shared_journey(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.journeys; owner_name text; ci public.checkins;
begin
  select * into j from public.journeys
    where share_token = p_token and share_enabled and share_revoked_at is null;
  if not found then return null; end if;
  select split_part(full_name, ' ', 1) into owner_name from public.profiles where id = j.user_id;
  if j.status <> 'active' then
    return jsonb_build_object('ownerFirstName', owner_name, 'status', j.status, 'endedAt', j.ended_at);
  end if;
  select * into ci from public.checkins where journey_id = j.id order by created_at desc limit 1;
  return jsonb_build_object(
    'ownerFirstName', owner_name,
    'status', j.status,
    'origin', j.origin,
    'destination', j.destination,
    'route', jsonb_build_object('coordinates', j.route -> 'coordinates', 'distanceM', j.route -> 'distanceM', 'durationS', j.route -> 'durationS'),
    'startedAt', j.started_at,
    'expectedArrival', j.expected_arrival,
    'checkinStatus', ci.status,
    'liveLocation', case when j.share_live_location then j.last_location else null end,
    'liveLocationAt', case when j.share_live_location then j.last_location_at else null end
  );
end $$;

revoke all on function public.get_invite(uuid) from public;
revoke all on function public.respond_invite(uuid, boolean) from public;
revoke all on function public.get_shared_journey(uuid) from public;
grant execute on function public.get_invite(uuid) to anon, authenticated;
grant execute on function public.respond_invite(uuid, boolean) to anon, authenticated;
grant execute on function public.get_shared_journey(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('hazard-photos', 'hazard-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: owner writes own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner updates own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner deletes own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hazard photos: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hazard-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hazard photos: owner or moderator deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hazard-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator()));

-- ---------------------------------------------------------------------
-- Realtime for the notification inbox
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
