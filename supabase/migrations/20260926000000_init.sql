-- Round One CRM: first schema. Mirrors src/lib/types.ts (one table per array
-- in State). Change types.ts first, then add a new migration file here.
--
-- Security model: row-level security is ON for every table and there are NO
-- policies, so the publishable (anon) key can't read or write anything. All
-- access goes through our own route handlers using the secret key, which
-- bypasses RLS and never leaves the server.

create extension if not exists pgcrypto;

-- ---- Staff --------------------------------------------------------------

create table public.staff (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  role text not null default '',
  email text unique,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- Contacts -----------------------------------------------------------

create table public.contacts (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text not null default '',            -- E.164, e.g. +447700900101
  email text not null default '',
  source text not null default 'website'
    check (source in ('meta_ad', 'walk_in', 'referral', 'website')),
  -- Ad attribution, down to the individual Meta ad (see CLAUDE.md).
  campaign text,                             -- utm_campaign
  adset text,                                -- utm_term
  ad text,                                   -- utm_content
  ad_id text,                                -- Meta ad id; match on this first
  fbclid text,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'booked', 'no_show', 'attended', 'nurture',
                     'sold_programme', 'sold_membership', 'lost')),
  lost_reason text,
  tags text[] not null default '{}',
  answers jsonb not null default '[]',       -- [{ question, answer }]
  trial_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lost_needs_reason check (stage <> 'lost' or lost_reason is not null)
);
create index contacts_phone_idx on public.contacts (phone);
create index contacts_ad_id_idx on public.contacts (ad_id);
create index contacts_stage_idx on public.contacts (stage);

-- ---- Messages -----------------------------------------------------------

create table public.messages (
  id text primary key default gen_random_uuid()::text,
  contact_id text not null references public.contacts (id) on delete cascade,
  dir text not null check (dir in ('in', 'out')),
  text text not null,
  template text,                             -- set when sent as an approved WhatsApp template
  "by" text,                                 -- automation name, or staff name
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'sms')),
  status text not null default 'sent'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  provider_id text,                          -- WhatsApp message id, for delivery updates
  at timestamptz not null default now()
);
create index messages_contact_idx on public.messages (contact_id, at);
create index messages_provider_idx on public.messages (provider_id);

-- ---- Events (append-only log) ------------------------------------------

create table public.events (
  id text primary key default gen_random_uuid()::text,
  type text not null,
  contact_id text,                           -- no FK: the log outlives deleted contacts
  detail text not null,
  data jsonb not null default '{}',
  at timestamptz not null default now()
);
create index events_contact_idx on public.events (contact_id, at desc);
create index events_at_idx on public.events (at desc);

create function public.events_are_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'events are append-only';
end;
$$;
create trigger events_no_update before update or delete on public.events
  for each row execute function public.events_are_append_only();

-- ---- Automations and runs ----------------------------------------------

create table public.automations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  summary text not null default '',
  enabled boolean not null default true,
  trigger jsonb not null,                    -- shape: Trigger in types.ts
  steps jsonb not null default '[]',         -- shape: Step[] in types.ts
  runs integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.runs (
  id text primary key default gen_random_uuid()::text,
  automation_id text not null references public.automations (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  step_index integer not null default 0,     -- the next step to execute
  status text not null check (status in ('running', 'waiting', 'done', 'stopped')),
  resume_at timestamptz,
  started_at timestamptz not null default now()
);
create index runs_due_idx on public.runs (status, resume_at);
create index runs_contact_idx on public.runs (contact_id);

-- ---- Forms and tasks ----------------------------------------------------

create table public.forms (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  name text not null,
  questions jsonb not null default '[]',     -- shape: Question[] in types.ts
  thanks text not null default '',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id text primary key default gen_random_uuid()::text,
  contact_id text references public.contacts (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  assigned_to text references public.staff (id) on delete set null,
  at timestamptz not null default now()
);

-- ---- Calendar -----------------------------------------------------------

create table public.calendars (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  duration_min integer not null default 60,
  style text not null default 'trial' check (style in ('trial', 'pt', 'consult')),
  book_trial boolean not null default false, -- booking here moves the contact to Appointment booked
  availability jsonb                         -- opening hours per weekday, for self-booking (if agreed)
);

create table public.appointments (
  id text primary key default gen_random_uuid()::text,
  contact_id text not null references public.contacts (id) on delete cascade,
  calendar_id text not null references public.calendars (id),
  staff_id text references public.staff (id) on delete set null,
  start timestamptz not null,
  "end" timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'confirmed', 'attended', 'no_show', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index appointments_start_idx on public.appointments (start);
create index appointments_contact_idx on public.appointments (contact_id);

-- ---- WhatsApp templates -------------------------------------------------

create table public.templates (
  name text primary key,                     -- the template name registered with Meta
  body text not null,                        -- with {first}, {trial} etc. placeholders
  language text not null default 'en_GB',
  category text not null default 'utility' check (category in ('utility', 'marketing')),
  meta_status text not null default 'draft'
    check (meta_status in ('draft', 'submitted', 'approved', 'rejected')),
  updated_at timestamptz not null default now()
);

-- ---- Meta ads -----------------------------------------------------------

create table public.ads (
  ad_id text primary key,                    -- Meta ad id
  name text not null,
  adset text,
  campaign text,
  campaign_utm text,
  format text check (format in ('video', 'image', 'carousel')),
  updated_at timestamptz not null default now()
);

-- Spend side only, filled by the nightly Marketing API sync. Trials and sales
-- are counted from contacts and appointments, matched on ad_id.
create table public.ad_insights_daily (
  ad_id text not null references public.ads (ad_id) on delete cascade,
  day date not null,
  spend numeric(10, 2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  primary key (ad_id, day)
);

-- ---- Lock everything down ----------------------------------------------

alter table public.staff enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.automations enable row level security;
alter table public.runs enable row level security;
alter table public.forms enable row level security;
alter table public.tasks enable row level security;
alter table public.calendars enable row level security;
alter table public.appointments enable row level security;
alter table public.templates enable row level security;
alter table public.ads enable row level security;
alter table public.ad_insights_daily enable row level security;
