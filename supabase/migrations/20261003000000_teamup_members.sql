-- TeamUp members in the CRM (docs/teamup-members.md), 03/10/2026.
-- Members are contacts: the nightly sync creates or updates a contact for
-- each TeamUp customer with a membership, and keeps their membership here.

alter table public.contacts add column if not exists membership jsonb;        -- shape: Membership in types.ts
alter table public.contacts add column if not exists marketing_opt_out boolean not null default false;
create index if not exists contacts_membership_customer_idx on public.contacts ((membership->>'customerId'));

alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('meta_ad', 'walk_in', 'referral', 'website', 'whatsapp', 'teamup'));

-- A raw copy of each TeamUp customer_membership from the last sync, so the
-- field mapping can be checked and fixed without asking TeamUp again.
create table public.teamup_members (
  id text primary key,                       -- TeamUp customer_membership id
  customer_id text not null,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);
create index teamup_members_customer_idx on public.teamup_members (customer_id);
alter table public.teamup_members enable row level security;

-- When the sync last ran and what it found.
insert into public.settings (id, value) values ('teamup_sync', '{}'::jsonb)
on conflict (id) do nothing;
