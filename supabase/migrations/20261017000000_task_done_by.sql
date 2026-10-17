-- Who cleared each task and when (Sammy, 17/10/2026): the log on /tasks.
alter table public.tasks add column if not exists done_at timestamptz;
alter table public.tasks add column if not exists done_by text;
