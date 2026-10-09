-- Payments become their own sync stage (the members stage took 47 seconds
-- with them in). customers 03:00, members 03:02, payments 03:04, apply
-- 03:07, attendance 03:10 (UTC).
select cron.schedule('crm-teamup-payments', '4 3 * * *', $$ select net.http_get(url := 'https://round-one-crm.vercel.app/api/cron?job=teamup&stage=payments', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')), timeout_milliseconds := 60000); $$);
select cron.alter_job((select jobid from cron.job where jobname = 'crm-teamup-apply'), schedule := '7 3 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'crm-teamup-attendance'), schedule := '10 3 * * *');
