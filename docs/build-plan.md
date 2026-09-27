# Build plan: from prototype to the real CRM

Status: **draft for review by Sammy and Andrew.** Nothing in here is built yet.
When we agree a section, the rules it sets go into `CLAUDE.md` in the same PR
that builds it.

## 1. Where we are

- `main` is Andrew's front-end prototype (PR #1). Every screen works on sample
  data held in the browser (`src/lib/store.tsx`). This is the base we build on.
- `claude/inhouse-crm-lead-qualification-rpthip` is Sammy's earlier build
  (SQLite, server actions, real WhatsApp/email/SMS clients, self-booking, the
  GymGrow workflows). It stays as a **parts bin**. We port its tested logic,
  not its structure or storage (section 5).
- Accounts already set up:
  - A Supabase project `round1-dev` in London.
  - A Resend account, with domain verification under way.
  - A Meta Business account (verified), already running ads.

### Checked for this PR

- Ran `npm run dev` on `main` and submitted `/f/free-trial` using a demo Meta ad link.
- The lead appeared on the Pipeline, tagged with its ad, with *New trial lead* running.
- Also opened Today, Calendar, Automations and Meta ads.
- No console errors.
- Not checked: dragging a card, or the prototype clock's +1 day.

## 2. Decisions so far

**Scope** stays as in `CLAUDE.md`: this CRM takes someone from enquiry to a
booked, attended trial and the sale. Billing, classes and renewals live elsewhere.

**Pipeline stages (Sammy, 26/09).** These replace the current
New lead → Contacted → Trial booked → Trial done → Joined:

| Order | Stage | Meaning |
|---|---|---|
| 1 | New lead | Enquiry received |
| 2 | Appointment booked | Trial in the calendar |
| 3 | Appointment attended | Came to the trial |
| 4a | Sold – Programme | Bought the intro programme |
| 4b | Sold – Recurring membership | Bought a membership |
| 4c | Nurture | Trialled, hasn't bought yet; keep in touch |
| – | Lost | Clearly said no. Always recorded with a reason. |

- **Appointment statuses:** booked, confirmed, attended, no-show, cancelled.
  - "Confirmed" stays a status, not a stage.
  - The prototype's "showed" is renamed "attended".
- **Qualification:** everyone qualifies. The form collects details and answers
  but never turns anyone away. There are no disqualify rules; staff can still
  mark someone Lost with a reason.
- **Automations come last.** We build everything else first. Andrew's three
  prototype automations keep working as they are until the redesign
  (section 8, phase 4).
- **SMS fallback is parked.** It stays designed-for (messages carry a channel),
  but not built.
- **Hosting:** Vercel. **Email:** Resend, sending as `bookings@round1boxfit.co.uk`.

## 3. Open questions

Please answer these in the PR comments:

1. ~~Is "Contacted" dropped?~~ **Answered: keep it** (Sammy, 26/09).
2. ~~Is No-show a pipeline column?~~ **Answered: yes, its own column**
   (Sammy, 26/09). Built in PR #3.
3. **Self-booking:** after the form, does the lead pick their own trial slot
   (and get a `/book/<link>` in messages), or do staff book every trial?
4. **Domain.**
   - `CLAUDE.md` says the brand comes from `roundonefitness.co.uk`.
   - The live DNS and email are on `round1boxfit.co.uk`, and the plan is
     `crm.` and `book.` subdomains there.
   - Which domain is right for the app and the links?
5. **Job runner** for automation waits. Runs already store `resumeAt`, so one
   of these:
   - **(a)** A Vercel Cron job every minute that calls `tick()`. It needs no new
     dependency, but per-minute cron needs Vercel Pro.
   - **(b)** Inngest or Trigger.dev, as `CLAUDE.md` says.

   The proposal is (a) until it hurts.
6. **New dependencies.** **Answered: agreed by Sammy (26/09).** `CLAUDE.md` says to agree these first. This plan needs:
   - `@supabase/supabase-js` and `@supabase/ssr`, for the database client and staff login cookies.
   - Nothing else. Resend, WhatsApp and Meta all use plain `fetch`.
7. **Andrew's OK** on the new stages, because they change the scope wording
   in `CLAUDE.md` ("ends at Joined" becomes "ends at Sold").

## 4. Supabase schema

The tables mirror `src/lib/types.ts`, one table per array in `State`.
Everything is created with SQL migrations in `supabase/migrations/`, so dev and
prod stay identical.

| Table | Mirrors | Key columns / notes |
|---|---|---|
| `staff` | `Staff` | `id`, `name`, `role`, `auth_user_id` (links to Supabase Auth), `active` |
| `contacts` | `Contact` | `name`, `phone` (E.164), `email`, `source`, **`campaign`, `adset`, `ad`, `ad_id`**, `fbclid`, `stage`, `lost_reason`, `tags text[]`, `answers jsonb`, `trial_at`, `created_at`. Indexes on `phone`, `ad_id`, `stage`. |
| `messages` | `Message` | `contact_id`, `dir`, `text`, `template`, `by`, `at`, and new: `channel` (whatsapp / email / sms), `status` (queued / sent / delivered / read / failed), `provider_id` (the WhatsApp message id) |
| `events` | `CrmEvent` | **Append-only.** `type`, `contact_id`, `detail`, `at`, `data jsonb`. A trigger rejects UPDATE and DELETE. |
| `automations` | `Automation` | `name`, `summary`, `enabled`, `trigger jsonb`, `steps jsonb`. Step and trigger shapes stay defined in `types.ts`. |
| `runs` | `Run` | `automation_id`, `contact_id`, `step_index`, `status`, `resume_at`, `started_at`. Index on `(status, resume_at)` for the runner. |
| `forms` | `Form` | `slug` (unique), `name`, `questions jsonb`, `thanks`. The response count is computed from events, not stored. |
| `tasks` | `Task` | `contact_id`, `text`, `done`, `at`, `assigned_to` (staff) |
| `calendars` | `CalendarDef` | `name`, `duration_min`, `style`, `book_trial`, plus `availability jsonb` (opening hours per weekday, slots per time) if self-booking is agreed |
| `appointments` | `Appointment` | `contact_id`, `calendar_id`, `staff_id`, `start`, `end`, `status`, `notes` |
| `templates` | `State.templates` | `name`, `body`, `language`, `category`, `meta_status` (draft / submitted / approved / rejected) |
| `ads` | `Campaign` + `Ad` | `ad_id` (Meta id), `name`, `adset`, `campaign`, `campaign_utm`, `format` |
| `ad_insights_daily` | `AdMetrics` (spend side) | `ad_id`, `day`, `spend`, `impressions`, `clicks`, `leads`. Filled by the nightly Meta sync. Trials and joins are counted from `contacts` and `appointments`, as they are now. |

Prototype-only fields that don't get a table:
- `clockOffset`, `seededAt`: prototype only.
- `history`: replaced by `ad_insights_daily` and real events.

**Security.**
- Row-level security is **on for every table, with no policies** for the
  `anon` or `authenticated` roles. Nothing can be read or written straight from
  the browser.
- All access goes through our own route handlers, using a server-only client
  that holds the service-role key. That client lives in `src/lib/server/`,
  which never imports into a `"use client"` file.
- Each handler first checks the staff member's Supabase Auth session, then
  looks up their `staff` row.
- The only unauthenticated endpoints are:
  - the public form submit (`/api/forms/[slug]/submit`), validated and rate-limited;
  - self-booking, if agreed;
  - the WhatsApp and Meta webhooks (signature-checked);
  - the cron route (secret-checked).

## 5. Replacing `store.tsx`

The goal is to change as few page components as possible. Pages call
`useStore()` and get back `{ s, now, act }`. We keep that shape.

**Step 1 – server engine.**
- `engine.ts` stays pure: state in, state out.
- A small server adapter (`src/lib/server/runAction.ts`) does the database work:
  1. Loads the slice of state an action needs: the contact(s), their
     appointments, calendars, staff, automations, waiting runs, templates and forms.
  2. Runs the engine function on that draft.
  3. Writes back what changed: new events and messages as inserts, changed
     contacts, appointments, runs and tasks as updates. All in one transaction.
- Events and messages aren't loaded for actions. The engine only ever appends
  to them.

**Step 2 – API.**
- `GET /api/state` returns a `State`-shaped snapshot for the staff screens.
  - At a gym's scale (a few thousand contacts) this is fine.
  - Messages and events are limited to recent ones, with a per-contact fetch
    on the contact page.
- `POST /api/actions/<name>` runs one named engine function, for example
  `setStage`, `sendMessage`, `createAppointment` or `submitForm`.

**Step 3 – swap the store.**
- `store.tsx` fetches `/api/state`.
- `act()` becomes a set of named action calls: pages change from
  `act(d => setStage(d, id, st))` to `actions.setStage(id, st)`, a mechanical
  edit. After each action the store refetches.
- The prototype clock and Reset buttons stay in development only.

**Step 4 – move the runner.**
- `tick()` runs on the server from the cron route, not the browser's 30-second timer.

Later, if the snapshot gets slow, individual pages move to targeted queries.
`contactQuery.ts` already isolates search and filter, so it can become a SQL query.

## 6. What we reuse from the parts bin

Taken from `claude/inhouse-crm-lead-qualification-rpthip`, file by file:

| Old file | Becomes | Notes |
|---|---|---|
| `lib/whatsapp.ts` | `src/lib/server/whatsapp.ts` | Cloud API template and free-text sending, with dry-run when no token is set. Keep as is. |
| `app/api/webhooks/whatsapp/route.ts` | `src/app/api/webhooks/whatsapp/route.ts` | Verify handshake, `X-Hub-Signature-256` check, inbound messages → `receiveMessage`, delivery statuses → `messages.status` |
| `lib/email.ts` | `src/lib/server/email.ts` | Resend over `fetch`. The engine's `email` step starts really sending. |
| `lib/time.ts` | `src/lib/time.ts` | UK timezone conversion (`localToUtc`, day keys, quiet hours). The prototype currently uses the browser's local time, so the server needs this. |
| `lib/availability.ts` | `src/lib/availability.ts` | Slot generation with capacity per slot. Only if self-booking is agreed; reads `calendars.availability`. |
| `app/book/[token]/*` | `src/app/book/[token]` | Self-booking page. Only if agreed; restyled to the public form's light theme, calling `bookTrial()`. |
| `lib/leads.ts` (`normalisePhone`) | `src/lib/phone.ts` | Consistent +44 numbers, needed to match WhatsApp replies to contacts |
| `lib/pipeline.ts` (`handleInboundMessage`) | Logic folded into `receiveMessage` | "Reply YES to confirm". Waits for the automation redesign. |
| `lib/auth.ts`, `app/login` | Not reused | Replaced by Supabase Auth |
| `lib/sms.ts` | Kept for later | SMS is parked |
| `lib/workflows.ts` | Reference only | Its 7 GymGrow workflows are the brief for the automation redesign, not code to port |
| `lib/db.ts`, `instrumentation.ts`, `scripts/seed.ts`, `app/admin/*`, `app/apply/*` | Not reused | SQLite storage, in-process ticker and duplicate screens. Andrew's screens and form builder replace them. |

## 7. Integrations and what each needs from us

| Integration | What the code does | What a person must do | Lead time |
|---|---|---|---|
| **Supabase** | Migrations, server client, staff auth | Done: `round1-dev`. Later: `round1-prod` at go-live. Replace the access token and DB password before go-live (both were shared in a chat). | Minutes |
| **Vercel** | Hosting; a preview per PR on dev data; `main` goes live | Sign up with GitHub, import the repo, move to **Pro** (the business-use terms, and per-minute cron) | Minutes |
| **Resend** | Staff notification emails and contact emails, bounce webhook | Verify `round1boxfit.co.uk` (DNS at SiteGround, `send` subdomain), create a sending API key, create the `bookings@` mailbox | Hours (DNS) |
| **WhatsApp Cloud API** | Send templates and free text inside 24h, receive replies and delivery statuses | 1. Create a Meta app with the WhatsApp product (test number first). 2. Create a system user and permanent token. 3. Submit every template for approval (the 5 in `seed.ts` to start). 4. At go-live, **move the live number off GymGrow** (this cuts GymGrow's WhatsApp, so it's planned as one switch-over). | Templates: hours to 2 days each. Display name / number move: days. **Start early.** |
| **Meta lead-ads webhook** | Leads from Meta instant forms arrive with `ad_id` → `contacts` | Subscribe the Page to the app's `leadgen` webhook; the app needs `leads_retrieval` (may need App Review) | Days to weeks (App Review) |
| **Meta Marketing API** | Nightly sync of spend, impressions, clicks and leads **per ad** into `ad_insights_daily`, for cost per trial and cost per join per creative | A system user token with `ads_read` on the ad account, and the ad account id | Days |
| **Twilio SMS** | Parked | Decide the provider first (GymGrow may already use Twilio underneath) | – |

**Ad attribution rule** (already in `CLAUDE.md`): every ad link carries
`utm_campaign`, `utm_term`, `utm_content` and `ad_id`. Lead-form leads give
`ad_id` directly. Match on `ad_id` first. Andrew can check the URL parameters
on the live ads now, before any code exists.

## 8. Build order

Each PR is small, ships on its own, passes `npm run build`, and says what was
and wasn't tested. There are two lanes, so we can work in parallel without
editing the same files.

**The hotspot is `types.ts` and `engine.ts`.** The stage change (B1) lands
first, so the schema (A1) mirrors the final stages.

### Phase 1 – foundations

| PR | Lane | What | Main files |
|---|---|---|---|
| B1 | B | **Stages**: new list, Lost reasons, "showed" becomes "attended", no-show handling; update the pipeline, metrics, seed and `CLAUDE.md` | `types.ts`, `engine.ts`, `metrics.ts`, `seed.ts`, pipeline page |
| A0 | A | Next 14 → current version upgrade, **only if we want it**, as its own PR | `package.json` |
| A1 | A | Supabase migrations for section 4, the server client, and a seed script for dev | `supabase/`, `src/lib/server/db.ts` |
| A2 | A | Staff login (Supabase Auth), protected routes, a staff table | `src/app/login`, `middleware.ts` |

### Phase 2 – real data

| PR | Lane | What | Main files |
|---|---|---|---|
| A3 | A | `runAction` adapter, `/api/state`, `/api/actions/*`; swap `store.tsx`; a mechanical `act` → `actions` edit in the pages | `src/lib/server/*`, `store.tsx`, pages |
| B2 | B | Public form submit API with attribution and phone matching | `src/app/api/forms`, `f/[slug]` |
| B3 | B | Self-booking: availability, slot picker at the end of the form, `/book/<token>` (**if agreed**) | `availability.ts`, `time.ts`, `book/` |
| A4 | A | Cron route that runs `tick()` on the server; the automation runner moves off the browser | `src/app/api/cron` |

### Phase 3 – messaging and ads

| PR | Lane | What | Main files |
|---|---|---|---|
| B4 | B | Resend: the `email` step sends for real, plus staff notifications | `server/email.ts`, `engine.ts` |
| A5 | A | WhatsApp: sending, the webhook, the templates table with approval status, the 24-hour rule enforced in the UI | `server/whatsapp.ts`, `api/webhooks/whatsapp`, contact page |
| B5 | B | Meta lead-ads webhook | `api/webhooks/meta` |
| A6 | A | Nightly Marketing API insights sync; the Meta ads page reads real spend | `api/cron/meta`, `ads/page.tsx` |

### Phase 4 – automations (after a design session)

The GymGrow workflows get rebuilt as data in Andrew's engine. Candidate
additions to discuss first:
- **Triggers:**
  - `appointment.updated {status}`, which splits cancelled from no-show.
  - `message.received {keyword}`, for "reply YES to confirm".
- **Steps:**
  - `confirm_trial`.
  - `stop_other_automations`, GymGrow's "remove from workflow".
  - `assign`.
- **Settings on each automation:**
  - "stop when they reply".
  - "fall back to SMS" (once SMS is unparked).
- **Quiet hours:** 21:00–08:00 as a global setting.

### Phase 5 – go-live

- Create `round1-prod`, and rotate the keys that were exposed in chat.
- Point `crm.` and `book.` at Vercel.
- Move the WhatsApp number off GymGrow.
- Import GymGrow contacts, if we want them.
- Turn GymGrow's workflows off.

## 9. Things only a person can do (start these now)

| Item | Who | Status |
|---|---|---|
| Supabase `round1-dev` + access token | Sammy | Done (rotate before go-live) |
| Resend domain + API key + `bookings@` mailbox | Sammy | In progress |
| Vercel account (Pro) + import repo | Sammy | To do |
| Meta app with WhatsApp, test number, system user token | Sammy | To do |
| Draft WhatsApp templates and submit for approval | Sammy + Andrew | To do (**long lead time**) |
| Check the live ads' URL parameters include `ad_id` and the UTMs | Andrew | To do |
| `leads_retrieval` / `ads_read` permissions, and App Review if needed | Sammy | Next stage (**long lead time**) |
| Decide the SMS provider | Sammy | Parked |
| Answer the open questions in section 3 | Both | To do |
