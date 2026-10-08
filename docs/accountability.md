# Accountability programme, built in the CRM

Status: **step 1 built 08/10/2026** (Sammy: go, floor capped at three, Claude drafts the wording). Steps 2–6 to come. Sammy decided to build it in
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

Next: step 2 (attendance from TeamUp: `/attendances` exists, 7,236 rows,
with `customer`, `event`, `status` attended/registered; event dates come
from `/events`), then the weekly check-in sender (step 3).

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
