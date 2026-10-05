-- Email enquiries with AI-drafted replies (docs/email-enquiries.md), 05/10/2026.
-- Emails to info@ arrive through Resend's receiving webhook, are kept here,
-- classified and drafted by the AI, and only ever sent after a staff member
-- presses Send and confirms. Enquiries are not part of State: the staff
-- screen reads them through /api/enquiries.

create table public.enquiries (
  id text primary key,
  resend_id text not null unique,                  -- Resend's received-email id
  message_id text,                                 -- the email's Message-ID, for threading the reply
  from_email text not null,
  from_name text,
  to_email text,
  subject text not null default '',
  text text not null default '',
  html text,
  received_at timestamptz not null,
  kind text not null default 'unknown' check (kind in ('unknown', 'enquiry', 'other')),
  summary text,                                    -- the AI's one-line summary
  draft text,                                      -- the editable reply
  status text not null default 'new' check (status in ('new', 'drafted', 'sent', 'dismissed')),
  contact_id text references public.contacts (id) on delete set null,
  reply_text text,
  sent_at timestamptz,
  sent_by text,
  sent_id text,                                    -- Resend's id for the reply
  error text,
  created_at timestamptz not null default now()
);
create index enquiries_status_idx on public.enquiries (status, received_at desc);
alter table public.enquiries enable row level security;

-- People who first write in by email.
alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('meta_ad', 'walk_in', 'referral', 'website', 'whatsapp', 'teamup', 'email'));

-- The facts sheet the AI is allowed to use. First draft from
-- roundonefitness.co.uk on 05/10/2026; staff edit it on the Enquiries screen.
insert into public.settings (id, value) values ('gym_facts', to_jsonb($facts$Round One (also written Round One Gym / Round One Fitness), a boxing and strength gym in Bristol.

Address: Unit 2 Kings Business Park, Kings Park Avenue, Bristol BS2 0TZ.
Phone: 0117 2510 120. Email: info@round1boxfit.co.uk.
Website: roundonefitness.co.uk (memberships, classes, facilities and contact pages).
Bookings and memberships run through the TeamUp app (iOS and Android).

Opening hours (from the website, check): Monday to Friday 6am to 10pm; Saturday and Sunday 9am to 4pm. Off-peak is 10am to 4pm every day.

Free trial: new people can book a free in-person intro session. Staff send the booking link; it is not on the website.

Memberships (prices from the website on 05/10/2026, check before quoting):
- Premium: from £59.99 a month. Full facility access plus classes. 16+.
- Classes Only: from £44.99 a month. 16+.
- Facility Access Only: from £19.99 a month. Gym floor, no classes. 16+.
- Youth: from £34.99 a month. Ages 10 to 15, amateur boxing classes.
- Student & Blue Light: from £31.49 a month, 10% off with valid ID. 16+.
- 28 Day Program: a four-week intro programme for beginners. Price and start dates: ask staff.
No joining fee on any membership; recurring memberships can be cancelled any time with 30 days' notice.

Classes: Boxfit (mixed ability), Ladies Only Boxfit, Junior Boxing (10 to 15), Technique Thursdays, Blast (high energy). The full timetable is on the website and in the TeamUp app; don't quote class times from memory.

Facilities: boxing ring and bags, strength and conditioning area, changing rooms, a café area with coffee and space to work.

Coaches: head coach Lee Haskins, former world champion. Personal training is available; ask staff for availability and prices.

Not known / ask staff: parking, showers, kids' parties, corporate sessions, day-pass price.$facts$::text))
on conflict (id) do nothing;
