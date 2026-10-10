# Project context

CRM for Round One, a boxing and strength gym. Built by Andrew and a friend,
both using Claude Code on the same repo. Read `README.md` for how to run it.

## Scope

**This CRM is where Round One's selling and marketing is managed** (Sammy,
27/09/2026). Today it takes someone from first enquiry (ad, form, walk-in,
referral) to a booked and attended intro meeting and the sale ("Sold –
Programme" or "Sold – Recurring membership"). **The "trial" is the 28 Day
Program** (Sammy, 07/10): £79 paid upfront; finish it and move onto a
recurring membership and the £79 is refunded against that membership, so
the first 28 days end up free. "Sold – Programme" means they bought it;
Sammy then sets them up in TeamUp, and the sync matches them to the CRM
contact **on email**. People who sign up straight in TeamUp (website,
walk-in, word of mouth) never pass through the pipeline; `viaOf(contact)`
tells the two routes apart and TeamUp-driven triggers can carry `via`. Marketing to members and
ex-members (e.g. email campaigns, with people picked from TeamUp) belongs
here too: see `docs/improvement-list.md`.

TeamUp is the booking and gym management system: memberships, billing,
member classes, renewals and PT stay there. Don't rebuild them here; read
from TeamUp when marketing needs its data. The calendar holds trials only.

## Pipeline stages

Agreed with Sammy on 26/09. Ids live in `src/lib/types.ts`:

New lead → Contacted → Appointment booked → No-show / Appointment attended →
Nurture → Sold – Programme / Sold – Recurring membership. Plus Lost, which
always carries a reason (`LOST_REASONS`) and is only for people who have
clearly said no.

- Everyone qualifies. Forms collect answers but never turn anyone away.
- "Confirmed" is an appointment status, not a stage.
- Appointment statuses: booked, confirmed, attended, no-show, cancelled.

## Where we are

**Live data.** With Supabase settings (on Vercel, or a `.env.local`), the
staff screens and public forms read and write the Supabase database. Without
them (e.g. a fresh clone), the app runs as the original prototype: made-up
sample data from `src/lib/seed.ts` in the browser, with the prototype clock.
The plan docs live in `docs/`: `open-list.md` (what's in progress and
what each item waits on), `improvement-list.md` (ideas and what's been
built), `before-go-live.md`, `test-log.md`, and one file per work stream. (The original build plan, PR #2, was never merged and was closed
on 06/10/2026 as out of date.)

In place so far:
- **Supabase database** (`round1-dev`): the tables in
  `supabase/migrations/`, mirroring `types.ts`. The screens load from
  `/api/state` and save through `/api/actions`; the public form posts to
  `/api/forms/<slug>/submit`.
- **Staff login** with Supabase Auth. Everything needs a signed-in staff
  member except `/login`, `/auth/*`, the public forms and their submit
  route, the booking pages (`/book/<contact id>`, `/api/book/<id>`),
  `/api/webhooks/*` and `/api/cron`. A login only gets in if it matches a
  row in `staff`.
- **Email** goes through Resend, from bookings@round1boxfit.co.uk: login
  emails (invites, password resets) via Supabase, and automation emails via
  `src/lib/server/deliver.ts`. The engine only records an `email.sent`
  event with the details in `data`; after a change is saved, the server
  sends one email per new event (staff alerts go to `STAFF_EMAIL`). A
  failure is logged as an `email.failed` event. No `RESEND_API_KEY` (e.g.
  locally) means emails are printed to the server log, not sent.

- **WhatsApp** goes through Meta's Cloud API, on Meta's **test number**
  until go-live (the real number stays on GymGrow until then). Same
  record-then-deliver pattern: the engine adds an outgoing message to the
  thread; after the save, `deliver.ts` sends each new one (templates with
  their `{placeholder}` values, header video and "Book meeting" link) and
  stores Meta's message id. `/api/webhooks/whatsapp` (signed with the app
  secret) brings replies in and moves messages on to delivered, read or
  failed. Without `WHATSAPP_TOKEN` messages are printed to the server log.
- **The GymGrow journey** (`src/lib/playbook.ts`): Round One's real form
  questions, 13 WhatsApp templates and the automations copied from the
  GymGrow workflows. Templates need Meta's approval: after changing one in
  the `templates` table, run `npm run wa:templates`.
- **Self-booking.** The form's end screen and the WhatsApp buttons link to
  `/book/<contact id>`, where people pick a free-trial slot from the
  calendar's booking hours (Calendar → Booking hours). The id is the key,
  so contact ids come from a proper random source.

- **Spam protection** on the public form (`src/lib/server/spam.ts`): a
  signed start time (answers faster than 8 seconds are held back; the page
  waits and resends), a hidden trap field, and at most 10 submissions an
  hour per connection and 5 per mobile number (`form_attempts`, hashed
  addresses, cleared after a day). No outside service.
- **Scheduler.** A Supabase `pg_cron` job (`crm-automations`) calls
  `/api/cron` every 5 minutes with `CRON_SECRET` (kept in Supabase Vault),
  so automation waits and reminders run even when nobody has the CRM open.
  Opening the CRM also runs anything due.
- **Meta webhook** is subscribed for the test WhatsApp account only
  (`messages` field, to `/api/webhooks/whatsapp`).

- **TeamUp members** (`docs/teamup-members.md`). Members are contacts: the
  nightly sync (`src/lib/server/teamupSync.ts`) runs in four stages from
  pg_cron a few minutes apart (`/api/cron?job=teamup&stage=customers|
  members|apply|attendance`, payloads kept in `sync_payloads`) so none
  nears Vercel's 60-second limit; each stage's time shows on Members. It
  reads every customer membership from TeamUp with the M2M token and runs
  `importMembers` in the engine, which adds or matches contacts (source
  `teamup`), keeps `contact.membership` current, moves them to the right
  Sold stage and fires `membership.started` / `membership.ended`;
  `checkMembershipsEnding` fires `membership.ending` once per day count.
  The first ever sync is a baseline: no messages. TeamUp webhooks
  (`/api/webhooks/teamup/<secret>`) are unsigned nudges that re-sync one
  customer. Imported members don't show on the Pipeline; they live on
  Members. `marketingOptOut` (reply STOP, or staff) blocks marketing
  templates and `marketing: true` email steps, never service messages.

- **Email enquiries** (`docs/email-enquiries.md`). Resend receives a copy
  of everything sent to info@ (a forwarder to `inbound.round1boxfit.co.uk`)
  and calls `/api/webhooks/resend` (Svix-signed with
  `RESEND_WEBHOOK_SECRET`). `src/lib/server/enquiries.ts` keeps the email
  in the `enquiries` table (not part of `State`), asks Claude
  (`src/lib/server/ai.ts`, plain fetch to the Messages API, facts from the
  `gym_facts` setting only) whether it's an enquiry and for a draft, makes
  the sender a contact (source `email`), and emails `STAFF_EMAIL` "Draft
  ready". **Nothing sends until staff press Send and confirm** on the
  Enquiries screen; the reply goes as info@ with `In-Reply-To` so it
  threads. Events: `email.received`, `email.replied`.

- **Mailouts** (`docs/mailouts.md`). One plain-text email to many people,
  picked from contacts (members, ex-members by category and how recently
  they ended, old leads by stage), written on the Mailouts screen and sent
  from info@ **only after Send and a confirm of the count**.
  `src/lib/server/mailouts.ts` queues one `mailout_recipients` row each
  and sends in batches of 100 via Resend, at once and from `/api/cron`,
  within `MAILOUT_DAILY_LIMIT` a day (free plan). Every email has an
  unsubscribe link (`/u/<contact id>`, one-click via
  `/api/unsubscribe/<id>`) that sets `marketingOptOut`; bounces set
  `emailBounced`; both are skipped next time. Delivery events come back
  through `/api/webhooks/resend`.

- **Accountability programme** (`docs/accountability.md`). Opt-in: a member
  gets a personalised link to `/f/accountability`; their commitment lands
  on `contact.accountability`; `accountability.joined` fires the welcome.
  Attendance comes from TeamUp (`attendance.ts`); `/api/cron` sends the
  weekly check-in at their slot (`accountabilityTick`), only while their
  membership is active; answers to `/f/check-in` land on the contact and
  Claude's read of them (`readCheckin`) waits on the Accountability screen
  for staff to approve a reply. Mid-week nudges and the silence signal run
  from the same tick. All three emails are off until approved.
- **Reports** (`src/lib/server/growth.ts`, `reports.ts`): weekly members,
  monthly growth, unpaid and attendance PDFs (made in-house, `reports`
  bucket) to the managers' WhatsApp numbers on a schedule from
  `/api/cron`, off until switched on in Reports → Settings.
- **Member activity** (`src/lib/server/activity.ts`, the nightly `activity`
  stage): 60 days of ticked-in TeamUp classes plus Kisi door entries for
  every active member, one session a day, on `contact.activity`, with
  per-class stats for Reports. Past the threshold (settings `inactivity`,
  default 20 days, editable on Members) the member's coach (`coachId`) or
  the front desk gets a task and an email, once per lapse, with a priority
  and suggested action from `src/lib/inactivity.ts`. **Rule (Sammy,
  10/10): nothing about a lapsed member is ever sent to the member
  automatically; staff decide.** Why, with sources:
  `docs/reference/sleeping-members.md`.
- **Safety** (`src/lib/server/safety.ts`, the nightly `safety` stage):
  the signed waiver and emergency contact from TeamUp on
  `contact.safety`. `/api/safety/now` reads TeamUp's classes on now and
  Kisi's door entries (at most 1.5 hours back, cached two minutes); a red
  alert on every staff screen (`SafetyAlert`) names anyone in without a
  waiver or emergency contact until staff tick "Spoke to them"
  (`markSafetyChecked`, clears for the day). Its "List everyone" button
  opens `/safety` (deliberately not on the sidebar): who's in now, plus
  every active member with a gap. Fixes happen in TeamUp.

- **Champ** (`src/lib/server/champ.ts`, `/champ`, `/api/champ`): Round
  One's assistant for staff, on Claude Sonnet 5.5 (`CHAMP_MODEL`). Staff
  ask about members, leads, classes, attendance, door entries, waivers and
  a member's own payments, or for training and sales ideas. **Rules (Sammy,
  10/10):** read-only (its tools only read the CRM, TeamUp and Kisi; it
  can't change or send anything) **with one exception: `book_class`
  books a member into a TeamUp class** (`POST /events/<id>/register`,
  nothing else is ever written). Staff confirm each booking with a Book
  button in the chat (`champ_bookings`, `/api/champ/book`); management
  logins can tick Auto-book (`staff.champ_autobook`) so Champ books
  straight away. Each booking logs a `class.booked` event on the contact; gym training and gym sales only; a
  member's payments yes, gym-wide money (revenue, totals owed) never;
  TeamUp invoices and payment endpoints are not reachable from it. Chats
  are saved (`champ_chats`, `champ_messages`, exact API content blocks so a
  chat carries on unchanged); owners and managers (staff role) can read
  everyone's. **Conduct rule (Sammy, 10/10):** racist, discriminatory or
  misogynistic questions are refused; Champ calls `flag_conduct`, which
  records a `champ_flags` row; the first time the staff member is warned
  that a manager will be told next time, and from then on the Owner and
  Manager logins are emailed with the question and a link to the chat
  (`/champ?chat=<id>`). Ordinary questions about women, faith, disability
  or age (Ladies Boxfit, Ramadan, adapting for a member) are not flagged.
  Champ's three pictures are `public/champ/champ-1..3.webp` (shrunk from Sammy's originals), one shown above the chat box, changing every 45 minutes by the clock.
  **Train Champ** (`/champ/train`, `champKnowledge.ts`, management
  only: Owner or Manager staff role): notes and uploaded documents (PDF,
  .docx, text; files go straight to the private `champ-docs` bucket by a
  signed upload, PDFs are read once by Claude, Word files are unzipped in
  code). Every active entry is added to Champ's system prompt (cached an
  hour), capped at 400,000 characters.

- **Roles and staff logins** (Sammy, 10/10): `src/lib/roles.ts`. Owner and
  Manager staff roles are management and see everything; everyone else
  (role Staff) sees the day-to-day screens only. Management-only screens:
  Mailouts, Automations, Reports, Forms, Meta ads, Train Champ, Staff
  (hidden from the sidebar and blocked by `RoleGate`). Management-only
  changes are refused on the server: actions in `MANAGEMENT_ACTIONS`
  (switching or rewording automations, forms, booking hours) and the
  routes using `requireManager()` (reports, mailouts, automation drafts,
  gym facts, TeamUp hold, the inactivity setting, staff, Champ
  knowledge). Message cards on staff screens are read-only for staff.
  Staff never see gym-wide money: no ad spend or cost per trial on Today,
  no total owed on Failed payments (a named member's payments are fine).
  **Staff** page (`/staff`, `/api/staff`): management add a login (name,
  email, role) and Supabase sends the invite; removing sets
  `staff.active = false`, which stops the login at once.
- **Manual** (`src/lib/manual.ts`, `/manual`, linked at the bottom of the
  menu): one section per area; the management section is hidden from
  staff. Champ reads the whole manual and is the expert on the CRM; keep
  the manual true to the screens whenever a screen changes.

Still to come: Meta Marketing API sync.

## How the code is laid out

- `src/lib/types.ts`: **the data model.** The database schema should mirror
  it. Change it here first, then everything else.
- `src/lib/engine.ts`: every change to the CRM (set stage, send message,
  submit form…). Each function writes an event and fires matching automations.
  They run in the browser (instant feedback) **and** on the server (the real
  save), so keep them pure: state in, state out. No `Date` local-time
  maths: use `src/lib/time.ts` for UK times, because the server runs in UTC.
- `src/lib/actions.ts`: **the list of changes a page can make**, by name.
  Pages call `act("setStage", id, stage)`. To add a change: write the
  function in `engine.ts`, then add it to `ACTIONS`. Only listed names can
  run on the server.
- `src/lib/store.tsx`: gives pages `{ s, now, act, live }`. Live mode loads
  `/api/state` and sends each `act` to `/api/actions`; local mode is the old
  localStorage prototype. Pages shouldn't care which, except to hide
  prototype-only controls when `live` is true.
- `src/lib/server/state.ts`: turns database rows into `State` and back.
  Saves only rows that changed; messages and events are only ever added.
- `src/app/(crm)/*`: staff screens, behind the sidebar.
- `src/app/f/[slug]`: the public form people reach from ads. No sidebar, no
  login. Live, it loads the form on the server and posts answers to
  `/api/forms/<slug>/submit`, which treats them as untrusted input.
- `src/components/FormRunner.tsx`: shared by the public form and the preview.
- `src/app/book/[id]`: someone's own booking page. Slots come from
  `src/lib/availability.ts`, which the server checks again when saving.
- `src/lib/playbook.ts`: the starting templates, automations, form and
  booking hours (the prototype uses it; a migration put it in the database).
  `src/lib/gym.ts`: the gym's name and address, used in messages.
- `src/lib/server/`: **server-only** code. `supabase.ts` holds the client
  with the secret key; `staff.ts` answers "who is signed in, and are they
  staff?"; `deliver.ts`, `email.ts` and `whatsapp.ts` send things. Never
  import anything from here into a `"use client"` file.
- `src/lib/supabase/`: the login-session client (publishable key) and env
  settings. `src/middleware.ts` protects the staff screens.
- `supabase/migrations/`: the database schema, one SQL file per change.
  Apply new files with `npm run db:migrate` (see `.env.example`).

## Rules

- **Everything is an event.** Modules don't call each other directly. A form
  submission logs `form.submitted`, and automations react to it. New features
  should emit events, not reach into other modules.
- **Automations are data, not code.** They live in `State.automations` as a
  trigger plus steps. Add a new step kind in `types.ts`, then handle it in
  `advanceRun` and `describeStep` in `engine.ts`.
- **The calendar and the pipeline never disagree.** A free-trial appointment
  sets `contact.trialAt` and the Appointment booked stage; marking it
  attended moves them to Appointment attended, no-show to No-show, and
  cancelled (with no other trial) back to Contacted. Always go through the calendar
  functions in `engine.ts` (`createAppointment`, `setAppointmentStatus`,
  `rescheduleAppointment`), never edit appointments directly.
- **Attribution goes down to the ad.** Every contact from Meta stores
  campaign, ad set, ad name and ad id. Ad links carry
  `utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&ad_id={{ad.id}}`;
  Meta lead-form leads give `ad_id` directly. Match on `ad_id` first. Ad
  reporting joins Meta's spend with the CRM's trials and joins per ad.
- **Search and filters live in `src/lib/contactQuery.ts`**, shared by
  Contacts and Pipeline. Add new filters there, not in a page.
- **WhatsApp's 24-hour rule is real.** Free text only within 24h of the
  contact's last message; otherwise approved templates only. Keep the UI
  honest about this. Automations always send templates.
- **No new dependencies without agreeing it.** No CSS framework, component
  library, ORM or state manager. The app is small.
- **Supabase keys.** The secret key (`SUPABASE_SECRET_KEY`) stays
  server-side, only in `src/lib/server/`, and never in a `"use client"`
  file. Keys live in `.env.local` and Vercel settings, never in git.
- **Row-level security is on for every table, with no policies.** The
  browser can't read or write the database directly; everything goes
  through our server code. New tables must enable RLS in their migration.
- **Schema changes are new migration files.** Never edit one that has been
  applied; add the next file instead, and change `types.ts` to match.

## Design system

Round One's brand, taken from roundonefitness.co.uk. All tokens are CSS
variables at the top of `src/app/globals.css`. Use them; don't add new hex
values.

- Dark UI: `--char` ground, `--card` panels, `--black` sidebar.
- `--red` (#EC2024) is the brand red for accents, big type and fills under
  black text. Buttons use `--red-btn`, which passes contrast under white text.
- `--display` is Anton, for headings and big numbers only, always uppercase.
  `--ui` is Poppins for everything else.
- Square corners everywhere. No `border-radius`.
- Buttons and labels: uppercase, letter-spaced.
- The public form is light (white and cream) with the black logo bar.
- Respect `prefers-reduced-motion`.
- **The desktop layout is signed off (Sammy, 10/10/2026: "don't change
  normal desktop, it looks good").** Phone fixes go only inside the
  `@media (max-width: 800px)` rules at the bottom of `globals.css`; under
  800px the sidebar is a top bar with a Menu button. Check a desktop
  screenshot is unchanged before pushing any layout change.

## Copy voice

British, plain, friendly, like a good front desk. Sentence case. Buttons say
what they do ("Send", "Book", "Make member"), not "Submit". No exclamation
marks. Don't invent gym facts (prices, class times) — use sample data clearly
labelled as such.

## Checks before pushing

```bash
npm run build
```

Must pass clean. Then click through: submit `/f/free-trial`, see the lead on
Today and Pipeline, drag it to Appointment booked, use +1 day and check the
automation steps run.
