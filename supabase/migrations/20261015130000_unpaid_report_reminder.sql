-- A weekly to-do from Monday 2 November 2026 to improve the failed payment
-- (unpaid) report, which Sammy finds misleading (15/10/2026). Read by
-- src/lib/server/reminders.ts from /api/cron. Nothing is sent to anyone.

insert into public.settings (id, value, updated_at) values (
  'reminders',
  '{"list":[{"id":"improve-unpaid-report","text":"Improve the failed payment report: Sammy finds it misleading. Work out what it should show and change it.","weekday":1,"from":"2026-11-02"}]}'::jsonb,
  now()
) on conflict (id) do nothing;
