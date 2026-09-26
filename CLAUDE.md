# Project context

CRM for Round One, a boxing and strength gym. Built by Andrew and a friend,
both using Claude Code on the same repo. Read `README.md` for how to run it.

## Scope

**This CRM books free trials.** It takes someone from first enquiry (ad,
form, walk-in, referral) to a booked and attended trial, and ends at the
sale ("Sold – Programme" or "Sold – Recurring membership"). Memberships,
billing, member classes, renewals and PT are managed in other software:
don't build them here. The calendar holds trials only.

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

**Front-end prototype.** Every screen works, but all data lives in the
browser (`localStorage`) via `src/lib/store.tsx`. There is no backend yet.
The sample data in `src/lib/seed.ts` is made up.

Next phase: Supabase (Postgres + auth), route handlers under `src/app/api/`,
WhatsApp Cloud API, Meta Marketing API sync, Resend for email, and a job
runner (Inngest or Trigger.dev) for automation waits.

## How the code is laid out

- `src/lib/types.ts`: **the data model.** The database schema should mirror
  it. Change it here first, then everything else.
- `src/lib/engine.ts`: every change to the CRM (set stage, send message,
  submit form…). Each function writes an event and fires matching automations.
  These become API routes later, so keep them pure: state in, state out.
- `src/lib/store.tsx`: prototype-only local store. Pages call
  `act(d => someEngineFn(d, ...))`. This is the one file to swap out for real
  API calls.
- `src/app/(crm)/*`: staff screens, behind the sidebar.
- `src/app/f/[slug]`: the public form people reach from ads. No sidebar.
- `src/components/FormRunner.tsx`: shared by the public form and the preview.

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
- Once Supabase is in: the service-role key stays server-side, never in a
  `"use client"` file.

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
