-- Mailouts: marketing emails to members, ex-members and old leads, picked in
-- the CRM and sent through Resend (docs/mailouts.md), 06/10/2026. Sent only
-- after staff press Send and confirm. Not part of State.

alter table public.contacts add column if not exists email_bounced boolean not null default false;

create table public.mailouts (
  id text primary key,
  subject text not null default '',
  body text not null default '',
  audience jsonb not null default '{}'::jsonb,   -- shape: Audience in src/lib/server/mailouts.ts
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  created_at timestamptz not null default now(),
  created_by text,
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.mailouts enable row level security;

create table public.mailout_recipients (
  id text primary key,
  mailout_id text not null references public.mailouts (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  resend_id text,
  error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (mailout_id, contact_id)
);
create index mailout_recipients_queue_idx on public.mailout_recipients (status, mailout_id);
create index mailout_recipients_resend_idx on public.mailout_recipients (resend_id);
create index mailout_recipients_sent_idx on public.mailout_recipients (sent_at desc);
alter table public.mailout_recipients enable row level security;
