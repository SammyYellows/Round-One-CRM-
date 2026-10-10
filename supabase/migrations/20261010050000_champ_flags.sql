-- Champ conduct flags (Sammy, 10/10/2026): racist, discriminatory or
-- misogynistic questions are refused. The first time, a warning that a
-- manager will be told next time; from then on, a manager is told.
create table public.champ_flags (
  id bigint generated always as identity primary key,
  staff_id text references public.staff (id) on delete set null,
  staff_name text not null default '',
  chat_id text references public.champ_chats (id) on delete set null,
  category text not null,
  question text not null default '',
  manager_told boolean not null default false,
  created_at timestamptz not null default now()
);
create index champ_flags_staff on public.champ_flags (staff_id, created_at);
alter table public.champ_flags enable row level security;
