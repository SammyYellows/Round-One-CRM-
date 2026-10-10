-- What Champ knows (Sammy, 10/10/2026): notes management write, and the
-- text read out of documents they upload. Owners and managers only. Champ
-- reads every active entry before answering. Uploaded files are kept in a
-- private bucket.
create table public.champ_knowledge (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  body text not null default '',
  kind text not null default 'note' check (kind in ('note', 'document')),
  file_name text,
  file_path text,
  mime text,
  size integer,
  status text not null default 'ready' check (status in ('ready', 'failed')),
  error text,
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.champ_knowledge enable row level security;

insert into storage.buckets (id, name, public, file_size_limit)
values ('champ-docs', 'champ-docs', false, 20971520)
on conflict (id) do nothing;
