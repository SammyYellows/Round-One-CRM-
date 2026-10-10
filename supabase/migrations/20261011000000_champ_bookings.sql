-- Champ can book a member into a TeamUp class (Sammy, 10/10/2026): the one
-- change Champ may make. Staff confirm each booking with a Book button;
-- managers can switch on Auto-book for themselves. Nothing else is ever
-- written to TeamUp from Champ (no cancelling, attendance or edits).
create table public.champ_bookings (
  id text primary key default gen_random_uuid()::text,
  chat_id text references public.champ_chats (id) on delete cascade,
  staff_id text references public.staff (id) on delete set null,
  staff_name text not null default '',
  contact_id text,
  customer_id text not null,
  event_id text not null,
  label text not null default '',
  status text not null default 'pending' check (status in ('pending', 'booked', 'failed', 'dismissed')),
  error text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index champ_bookings_chat on public.champ_bookings (chat_id, created_at);
alter table public.champ_bookings enable row level security;

alter table public.staff add column if not exists champ_autobook boolean not null default false;
