-- Member activity and the inactivity alert (improvement item 18, Sammy
-- 10/10/2026): a coach per member, 60 days of sessions per active member,
-- and a nightly "activity" sync stage at 03:12 UTC. Default threshold 20
-- days, editable on Members (settings 'inactivity').
alter table public.contacts add column if not exists coach_id text;  -- staff.id
alter table public.contacts add column if not exists activity jsonb; -- shape: Activity in types.ts
select cron.schedule('crm-teamup-activity', '12 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=activity', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
