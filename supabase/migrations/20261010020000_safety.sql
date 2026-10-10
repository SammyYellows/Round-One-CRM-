-- Safety details from TeamUp (improvement item 20, Sammy 10/10/2026): the
-- signed waiver and emergency contact on each contact, read by a nightly
-- "safety" sync stage at 03:14 UTC, for the "in the gym now" check.
alter table public.contacts add column if not exists safety jsonb; -- shape: Safety in types.ts
select cron.schedule('crm-teamup-safety', '14 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=safety', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
