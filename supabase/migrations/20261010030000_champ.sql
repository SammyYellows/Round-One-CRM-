-- Champ, the staff assistant (Sammy, 10/10/2026): saved chats, one row per
-- chat and one per message. Owners and managers can read everyone's chats.
-- `content` keeps the exact API content blocks (text, tool calls, tool
-- results, thinking) so a chat can continue unchanged; `text` is the plain
-- words shown on screen.
create table public.champ_chats (
  id text primary key default gen_random_uuid()::text,
  staff_id text references public.staff (id) on delete set null,
  staff_name text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index champ_chats_staff on public.champ_chats (staff_id, updated_at desc);

create table public.champ_messages (
  id bigint generated always as identity primary key,
  chat_id text not null references public.champ_chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  text text not null default '',
  tools text[] not null default '{}', -- the look-ups Champ made for this answer
  created_at timestamptz not null default now()
);
create index champ_messages_chat on public.champ_messages (chat_id, id);

alter table public.champ_chats enable row level security;
alter table public.champ_messages enable row level security;
