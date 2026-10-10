# Open list

Everything in progress and what each item is waiting on. Sammy picks from
this; Claude keeps it current. Last updated 10/10/2026.

## Switched off, waiting for Sammy's approval

Each is built and drafted, and does nothing until Sammy presses "Approve
and switch on" on its card. Claude prompts Sammy about these when the
list comes up, until each is on or dropped.

| What | Where to approve | Fires when |
|---|---|---|
| Program day 1 welcome (from TeamUp) | Program members | A Program membership starts in TeamUp |
| Program day 3: get your sessions in the diary | Program members | Day 3 |
| Program day 7: one week done | Program members | Day 7 |
| Program day 10: the dip | Program members | Day 10 |
| Program day 14: two-week check-in | Program members | Day 15 |
| Program day 17: the second half | Program members | Day 17 |
| Program day 21: a week to go, move to recurring | Program members | 7 days before the Program ends |
| Program day 24: finish strong | Program members | Day 24 |
| Program day 28: you did it | Program members | Day 28 |
| Payment failed – update your details | Failed payments | TeamUp logs the third failed attempt |
| Accountability welcome, weekly check-in, mid-week nudge | Accountability | Joining, their slot each week, Thursday 17:00 |
| Weekly members, monthly growth and unpaid reports | Reports | Mondays and the 1st at 08:00 |

**Fixed 08/10 (PR #83): failed payments missed (Romel Rodriques).** Romel flags after the next nightly sync. Still for Sammy: check in TeamUp whether he really has three Full Facility Access memberships. Original note:
TeamUp's invoices have a `retry_failed` status the sync doesn't read (it
only counts `open`), and a person with more than one active membership
is checked on their newest one only. Romel's 5 Oct £34.99 is retry_failed
with 5 attempts on an older membership, so he never flagged. Live count:
105 retry_failed invoices across 54 people. Fix: worst retry count across
all of a person's memberships, and retry_failed invoices counted as owed.
Waiting on Sammy's go (he also asked whether to show all memberships on
the contact page). Separately, Romel has three active Full Facility
Access memberships billed on the 5th, 15th and 23rd: Sammy to check in
TeamUp.

**Task: Program route 2 schedule** (people who sign up straight in
TeamUp, never through the questionnaire). Built so far: only the day-1
welcome. Waiting on Sammy (07/10, chose "something else"): the days after
the TeamUp start date, a line on what each message says, and the channel
(email is the only one that works for them until mobile numbers are
added, since TeamUp gives none). Also say whether direct sign-ups who buy
a recurring membership rather than the Program get the same messages.
Claude then drafts each in Round One's voice as its own switched-off card
on Program members.

Also needed before the Program and win-back WhatsApps can send: the ten new templates (eight Program, win_back, management_report)
submitted to Meta (Sammy pastes the WhatsApp token; Claude runs
`npm run wa:templates`).

**On** (Sammy's call, 07/10): the win-back email after notice to cancel.
**Off and not TeamUp-driven any more:** the GymGrow welcomes fire only
when staff mark a sale on the pipeline.

## Reminders Sammy asked for (08/10/2026)

- **Vercel Pro at go-live** (Sammy, 09/10): raises the function limit from
  60 seconds to five minutes. The sync is now staged so it isn't needed to
  keep working, but it's the headroom. Already on `before-go-live.md`.

- **Unpaid memberships report** (Reports → Unpaid): switch the Monday
  schedule on once the managers' numbers are in. WhatsApp can't post to a
  group; it goes to each number.
- **Reports: the other managers' numbers.** Set to 07855284151 only for
  now; add the rest in Reports → Settings before switching the schedules
  on. Also the `management_report` template needs Meta's approval.
- **Blocking after failed payments** (improvement item 15): Sammy wants a
  block in TeamUp that keeps billing going, not a hold. **Reminder: Sammy
  will send a screenshot of where he blocks someone in TeamUp**; Claude
  then finds the API for it. Kisi is not needed for this (08/10).
- **Two-way TeamUp actions** (item 9): Sammy wants reminding; the hold
  button is the first one, built 08/10.
- **Test log run** (`docs/test-log.md`): Sammy wants reminding to pick a
  time.
- **Program messages days 1–28:** wording approved (08/10). **Sammy, 10/10:
  keep them off until Meta has approved the WhatsApp templates**, so email
  and WhatsApp start together. That needs the WhatsApp token.
- **Route 2 schedule:** still listening for Sammy's description.
- **Tick boxes on the questionnaire (item 10):** Sammy will send the option
  lists for goal, why now and what you've tried (10/10).
- **Win-back replies** landing in Enquiries: fine as it is (Sammy, 08/10).

## Work streams

0b. **Inactivity alert and attendance reports** (items 18 and 19, built
   10/10). Live from tonight's sync. Waiting on Sammy: set a coach on
   members (contact page) so alerts go to the right person rather than
   the front desk; check the 20-day threshold on Members after a week.
   **The Attendance report has no schedule** (Sammy, 10/10: save that
   point): it's on-demand only from Reports → Attendance until he wants
   one. **Rule from Sammy, 10/10: nothing about lapsed members is ever
   sent to the member automatically.** The inactivity alert tells staff
   only; any contact with the member is a human decision, because a
   reminder can remind someone they're paying for a gym they don't use.
   Research on that trade-off: `docs/reference/sleeping-members.md`.
   **10/10 later:** every lapsed member now carries a priority (High /
   Medium / Low) and a suggested action for staff (Members → "Lapsed"
   filter, the contact page, the coach's task). Sammy's call from the
   research: contact is by a person, newest members and regulars who
   stopped first, long-standing occasional trainers left alone.

0c. **Waiver and emergency contact; who's in the gym** (item 20, built
   10/10 after a medical emergency). Live from tonight's `safety` sync
   stage (03:14). A red alert at the top of every staff screen names
   anyone in the gym (class on now, or through the door in the last 1.5
   hours) without a waiver or emergency contact; "Spoke to them" clears
   them for the day. Members → "In the gym now" has the full list. Gaps
   are fixed in TeamUp, not here. Nothing waiting on Sammy.


0d. **Champ** (item 21, built 10/10). Live on the sidebar. Waiting on
   Sammy: the Champ photos for above the chat box. Cost runs on the
   Anthropic key (Sonnet 5.5, roughly 2–5p a question); check the spend
   in the Anthropic console after the first week.

0. **Reports to the managers** (built 08/10, improvement items 12 and 13).
   Waiting on Sammy: the managers' numbers in Reports → Settings; the
   WhatsApp token so the `management_report` template can go to Meta; a
   look at the PDF (Reports → Open the PDF, or Email me a copy); then
   switch the weekly and monthly schedules on there.


1. **TeamUp members** (`docs/teamup-members.md`). Sync live: all 1,264
   TeamUp customers are in (304 active members, 238 ex-members, 675 who
   never joined under Members → Never joined). Program messages are
   service messages.
   **Program schedule** (06/10): nine messages across the 28 days, each
   WhatsApp plus email, on the Program members screen; only day 1 is on.
   Waiting on Sammy: (a) the WhatsApp token, pasted in chat, so Claude can
   submit the eight new templates to Meta's test account; (b) edit and
   approve each message on the Program members screen; (c) mobile numbers
   for Program members who didn't come through the form, added on their
   contact page, or they get the email only.
2. **Accountability programme** (`docs/accountability.md`). Sammy said go
   on 08/10 (floor capped at three, Claude drafts). Step 1 built the same
   night: commitment form on a personalised link, the commitment on the
   contact, the Accountability screen, the welcome email (off); attendance
   from TeamUp and the weekly check-in email (off) with the check-in form;
   Claude's read of each answer with a suggested reply staff approve; the
   mid-week nudge (off) and the silence signal. Kisi door entries are in
   (one session a day, merged with classes), live since 09/10.
   Waiting on Sammy: approve the welcome, check-in and nudge emails on the
   Accountability screen; send one real member their link when ready.
3. **Photo background on the questionnaire** (improvement list item 1).
   Waiting on Sammy: a photo from Round One.
3b. **Win-back email the day after notice** (improvement list item 7).
   **Stays on (Sammy, 08/10).** Research into better win-back approaches
   is improvement item 17.
   Built 06/10 and tested end to end the same night (sent to info@ via
   the real sync code and the live server). Editable on the Cancellations
   screen with named drafts and an AI rewrite. **Found switched on at
   23:00 on 06/10 with Sammy's edited subject**, so it is live unless
   Sammy switches it off there.
   Waiting on Sammy: confirm on or off.

## Testing

4. **Test log** (`docs/test-log.md`): about 40 tests owed for what was
   built on 05 and 06/10. Done informally on 06/10: email enquiries end to
   end (A1–A9 in effect), win-back F2–F3. Still to run properly in one
   sitting: the rest, including mailouts (needs Resend Pro or an audience
   of one).
   Waiting on Sammy: pick a time. The mailout tests need Resend Pro, or an
   audience of one.

## Before go-live (`docs/before-go-live.md`)

5. **Privacy policy.** Waiting on Sammy: add the Wix privacy page and send
   its URL. Then Claude writes the CRM paragraphs and the consent line on
   the form.
6. **Pre-live test checklist**, the full one. Waiting on Sammy: say when.
7. **Go-live switch-over.** Waiting on Sammy: live database decision,
   Vercel Pro, Resend Pro, the crm.round1boxfit.co.uk CNAME at SiteGround,
   and the day to move the WhatsApp number off GymGrow. Key rotation then.

## Small open items

8. **Booked video missing on discovery_1.** Parked as fine. Waiting on
   Sammy: a screenshot, if wanted.
9. **Delete the full-access Resend key** in Resend → API Keys. Claude has
   finished with it. Sammy's call.

## Done and off the list (08–09/10/2026)

Two routes (CRM vs direct TeamUp); first and last name; repeat form
submissions update details; questionnaire first on the contact and above
the calendar; live wording on every email card; calendar contact
ergonomics; failed-payment sync fixed, then each missed payment per person
newest first; Reports (weekly, monthly, unpaid PDFs, settings, reconcile
note); Accountability steps 1–6 (commitment form, attendance from TeamUp
and Kisi, weekly check-in, Claude-read replies to approve, mid-week nudge,
silence signal); email check on the form; win-back WhatsApp; staged
nightly sync with timings; back button; automations grouped.

## Done and off the list (05–06/10/2026)

Email enquiries built, connected and fixed (send-only key → full access;
catch-up every 5 minutes; Send-to address picked out of form
notifications; AI rewrite box); questionnaire card; mailouts; Resend
webhook events; every TeamUp customer imported; Meta and TeamUp
pipelines; the 1,000-row loading cap fixed; win-back built, editable with
drafts, tested; Cancellations screen with paging; sidebar badges that clear
on open; deleted-customer placeholders removed; accountability plan
written and parked; PR #2 closed.
