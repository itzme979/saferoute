-- Run this once in the Supabase SQL editor AFTER deploying the
-- checkin-monitor function. Replace the two placeholders.
--   <PROJECT_REF>  your project ref (from the project URL)
--   <CRON_SECRET>  the same value you set with `supabase secrets set CRON_SECRET=...`

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'saferoute-checkin-monitor',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/checkin-monitor',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- To make someone a moderator (moderation queue at /moderation):
-- update public.profiles set is_moderator = true where email = 'you@example.com';
