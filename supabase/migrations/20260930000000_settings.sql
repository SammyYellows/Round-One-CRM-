-- Shared settings the staff can change, one row per setting (Sammy,
-- 30/09/2026). First one: the one-tap WhatsApp quick replies on the contact
-- page, which start empty (the prototype's made-up lines are gone).

create table public.settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

insert into public.settings (id, value) values ('quick_replies', '[]'::jsonb)
on conflict (id) do nothing;
