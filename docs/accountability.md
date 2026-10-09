# Accountability programme, built in the CRM

Status: **steps 1–5 built 08/10/2026**; step 6 (Kisi) later (Sammy: go, floor capped at three, Claude drafts the wording). Steps 2–6 to come. Sammy decided to build it in
the CRM rather than on Make, Tally and Google Sheets. The design decisions in
`docs/accountability-handover.md` stand; this maps them onto the CRM.

## The standing rules, kept as they are

1. **Active membership gate at send time**, not trigger time: every
   accountability message checks `contact.membership.status === "active"`
   (from the TeamUp sync) just before sending. Lapsed means silence.
2. **Win-back is separate** and not in this build (marketing consent).
3. **Opt-in only**, via the commitment form.
4. **Config as data**: check-in slots, per-member slot, nudge frequency and
   style live in the database and are edited in the CRM, never in code.
5. **Messages adapt to the member**: style (straight talk / encouragement /
   facts only), frequency, and their own "why" quoted back.
6. **Silence when on pace**: mid-week nudges only when there's a gap,
   unless they chose a regular pulse or daily updates.
7. **Attendance truth = TeamUp classes + Kisi door events.** Phase 1 runs on
   TeamUp attendance alone; Kisi wired in once the loop works.

## What maps onto what

| Handover | In the CRM |
|---|---|
| Tally Form 1 (commitment) | A CRM form (`/f/accountability`), same questions, with the nudge-frequency question added and the "Four time" typo fixed. Opens from a personalised link so the member is known (no hidden fields to forge). |
| Tally Form 2 (weekly check-in) | A CRM form (`/f/check-in`), personalised link per member and week. |
| Google Sheet roster | `contact.accountability` on the member: floor, stretch, goals, why, derailers, style, frequency, slot, coach notes, joined date. Editable on the contact page. |
| Check-in slots list | A `settings` row (`checkin_slots`), editable in the CRM. |
| Make Scenario A (weekly check-in sender) | A `schedule` trigger (new) that wakes at each slot time, for members on that slot: membership active → this week's attendance from TeamUp → the message in their style with their check-in link. |
| Make Scenario B (response processor) | On `form.submitted` for the check-in form: Claude classifies against commitment, attendance, style and answers → strict JSON `{status, sentiment, flag_coach, suggested_reply, adjust_plan}` → streak praise / styled nudge / coach task. Staff see the suggested reply and send it (same approve-and-send screen as the email enquiries). |
| Make Scenario C (intake) | On `form.submitted` for the commitment form: save `contact.accountability`, send the confirmation. |
| Make Scenario D (mid-week nudge) | A Thursday `schedule` trigger: frequency preference + pace vs floor → nudge only where warranted. |
| Silence signal | Daily check: no check-in response and no attendance two weeks running → highest-priority coach task. |
| Log everything to a Sheet | Already how the CRM works: every message, event and run is recorded. |
| Email from the gym's domain | Resend from round1boxfit.co.uk (already live). The handover's open question is answered: `round1boxfit.co.uk` is the brand domain. |
| WhatsApp phase 2 | Same as the CRM's plan: WhatsApp versions switch on when the real number moves from GymGrow. |
| Anthropic API | Shares the AI setup planned in `docs/email-enquiries.md` (same key, same package). |
| Kisi door events | Phase 2: a Kisi client reading door events by member email, merged into attendance. Needs the Kisi API key from the organisation owner account. |

## New pieces the CRM needs

- `contact.accountability` and the two forms (with per-member links).
- A `schedule` trigger kind (cron-like: weekday + time, UK) run by the
  existing 5-minute scheduler, plus an `attendance` fetch from TeamUp
  (`/attendances` for the week, by customer).
- A `claude` step or server hook for classification (depends on the
  email-enquiries AI setup: `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`).
- A coach view: members on the programme, this week's pace, open flags.

## Build order

1. Commitment form + `contact.accountability` + intake (Scenario C).
2. Attendance pull from TeamUp (needs `TEAMUP_M2M_TOKEN` in Vercel).
3. `schedule` trigger + weekly check-in sender (Scenario A), email first.
4. Check-in form + Claude classification + approve-and-send (Scenario B).
5. Mid-week nudge (D) and the silence signal.
6. Kisi.

## Needs from Sammy before step 1

- The TeamUp token and the Anthropic key copied into Vercel (both already
  exist, see the handover).
- Confirm the floor options: cap at three a week (Claude's earlier
  recommendation) or keep "at least four" (Sammy added it).
- The confirmation and check-in email wording, or OK for Claude to draft
  from the handover's tone for Sammy to edit.

## Where we are (08/10/2026)

Built in step 1 (PR on 08/10):
- `/f/accountability`, the commitment form, reached from a personalised
  link `/f/accountability?c=<contact id>` (copied from the Accountability
  screen or the contact page). Nine questions as in the handover, with the
  nudge-frequency question added, the typo gone, floor capped at three.
  New question type `multi` (tick boxes, up to `max`, with an Other box)
  and `optional` on questions.
- `contact.accountability` (`Accountability` in `types.ts`): floor, stretch,
  goals, why, derailers, style, frequency, slot, coach notes, joined/left.
  Filled by `joinAccountability` in the engine from the form's answers
  (question ids `a_floor`, `a_stretch`…); `leaveAccountability` ends it.
  Events `accountability.joined` / `accountability.left`; trigger
  `accountability.joined`.
- Placeholders `{floor} {stretch} {why} {slot} {goal}` for messages.
- Automation `accountability_welcome` ("Locked in, {first}"), **off until
  approved** on the Accountability screen, where it has the usual card.
- Accountability screen (sidebar): who's on it and what they committed to,
  End button, invite-link search over active members, the welcome card.
  Contact page shows the commitment and the invite link.
- Tested 08/10 through the real route with Sammy's test customer ("sammy
  test" is on the programme as the example; End it when done).

Built in steps 2 and 3 (same night):
- **Attendance** (`src/lib/server/attendance.ts`): TeamUp's `/attendances`
  takes `customer=` and `expand=event` (it ignores date filters, so the
  cut-off is applied in code). `recordAttendance` in the engine counts
  this week and last (Monday to Sunday, UK) into
  `accountability.attendance`. A session counts if its status is
  `attended`, or `registered` for a class that has already happened (many
  gyms never tick people in). Refreshed nightly by the TeamUp sync, by the
  Refresh button on the Accountability screen, and just before a check-in.
- **Weekly check-in** (`src/lib/server/accountability.ts`,
  `accountabilityTick` from `/api/cron` every 5 minutes): `dueCheckins`
  finds members whose slot time this week has passed and who haven't had
  one this week, with an **active membership** (lapsed means silence);
  `sendCheckins` logs `accountability.checkin` and fires the trigger. The
  email automation `accountability_checkin` ("Your week, {first}") uses
  `{paceLine}`, one line on their week against their floor in their chosen
  tone, and `{checkinLink}`. **Off until approved** on the Accountability
  screen.
- **Check-in form** `/f/check-in?c=<id>` (three questions). `recordCheckin`
  stores the answers on the contact (`accountability.checkins`), logs
  `accountability.checkin_received`, and makes a staff task when they want
  a word with a coach or had a struggled / write-off week.
- Slots are read from the text ("Sunday 6pm", "Monday 8am"…): change the
  options on the form and they just work.

Built in steps 4 and 5 (same night):
- **Claude reads each check-in** (`readCheckin` in `ai.ts`, called by the
  submit route via `readLatestCheckin` right after the answer is saved):
  against their floor, stretch, why, style, this and last week's sessions
  and their last three check-ins, it returns status (on track / slipping /
  struggling / wants a coach), sentiment, a coach flag, a suggested reply in
  their tone (80 words max), a target suggestion (keep / lower / raise /
  talk) and a one-line note for staff. Stored on the check-in
  (`Checkin.ai`). Without `ANTHROPIC_API_KEY` the read is skipped and staff
  write the reply themselves.
- **Staff approve** on the Accountability screen: "Check-ins to reply to"
  shows each answer, Claude's read and note, and an editable reply with
  Send behind a confirm (`replyToCheckin`: an `email.sent` event from
  bookings@, subject "Re: your week, {first}") or "No reply needed"
  (`dismissCheckin`). Nothing goes out by itself.
- **Mid-week nudge** (`dueNudges` / `sendNudges`, from `/api/cron` via
  `accountabilityTick`): from 17:00 UK. "Only if I'm slipping": Thursday,
  only when under the floor. "A regular pulse": every Thursday. "Keep me
  posted daily": once a day, Tuesday to Sunday. "Just the weekly
  check-in": never. Active membership only; once a day at most. Trigger
  `accountability.nudge`; automation `accountability_nudge` ("Midweek,
  {first}", `{paceLine}`), **off until approved**.
- **Silence signal** (`flagSilence`, same tick): on the programme a
  fortnight or more, no sessions this week or last, no check-in answered
  in two weeks → one task for the coaches quoting their why, at most once a
  fortnight per member. Event `accountability.silent`.

Tested 08/10 through the real route ("sammy test": Struggled, wants a
coach → check-in stored, coach task made; the Claude read runs only where
the key is set, i.e. on Vercel).

Step 6, Kisi (**live 09/10/2026**): `src/lib/server/kisi.ts` looks the
member up in Kisi by email and reads their successful door entries;
`recordAttendance` merges them with TeamUp classes, one session per UK day
at most, so the swipe for a class isn't counted twice. Checked against the
live account: Kisi has no plain events list; history is an "event set"
(`POST /event_sets` with `interval`, `event_actor_id` = the member's user
id, `event_type: lock.unlock`, `event_success: true`; paged by `cursor`;
at most 90 days). One door ("Round One Entrance"), about 50 entries a
week. `KISI_API_KEY` is in Vercel (the key was pasted in chat on 09/10,
so it's on the go-live rotation list). Next: WhatsApp versions once the
number moves.

## Where we stopped (05/10/2026)

Parked by Sammy on 05/10 straight after the plan was merged (PR #27).
Nothing has been built. To resume, pick up exactly here:

1. Sammy puts `TEAMUP_M2M_TOKEN` and `ANTHROPIC_API_KEY` into Vercel
   (Production + Preview, Sensitive). Both already exist; see the handover.
   The TeamUp token also unparks `docs/teamup-members.md`.
2. Sammy answers two questions, still open:
   - Floor options: cap at three a week, or keep "at least four".
   - Email wording: Claude drafts from the handover's tone for Sammy to
     edit, or Sammy writes it.
3. Then start at build order step 1 (commitment form + `contact.accountability`
   + intake). Step 4 also needs the `@anthropic-ai/sdk` dependency agreed
   (shared with `docs/email-enquiries.md`).
