-- The TeamUp sync in stages (Sammy, 09/10/2026): what one stage reads from
-- TeamUp is kept here for the apply stage a couple of minutes later, so no
-- single call goes near Vercel's 60-second limit. RLS on, no policies: the
-- server alone reads and writes it.
create table if not exists public.sync_payloads (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.sync_payloads enable row level security;

-- Four pg_cron jobs in place of the one: customers 03:00, members 03:02,
-- apply 03:05, attendance 03:08 (UTC). Same secret from the Vault.
select cron.unschedule('crm-teamup-sync');
select cron.schedule('crm-teamup-customers', '0 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=customers', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
select cron.schedule('crm-teamup-members', '2 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=members', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
select cron.schedule('crm-teamup-apply', '5 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=apply', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
select cron.schedule('crm-teamup-attendance', '8 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=attendance', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
