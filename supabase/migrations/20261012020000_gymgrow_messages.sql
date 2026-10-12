-- Message history copied from GymGrow (Sammy, 12/10/2026): WhatsApp, SMS,
-- email and call records from GymGrow's conversations, for people already in
-- the CRM. Kept out of State (it's large and history only): the contact page
-- loads it on demand, and it never counts as "waiting for a reply".
create table if not exists gymgrow_messages (
  id text primary key,                 -- GymGrow's message id
  contact_id text not null references contacts(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'email', 'call')),
  dir text not null check (dir in ('in', 'out')),
  subject text,
  body text not null default '',
  status text,
  source text,                         -- GymGrow's: app (typed on the phone or in GymGrow), workflow, api…
  at timestamptz not null,
  imported_at timestamptz not null default now()
);
create index if not exists gymgrow_messages_contact_at on gymgrow_messages (contact_id, at);
alter table gymgrow_messages enable row level security;
