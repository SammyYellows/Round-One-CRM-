# Open list

Everything in progress and what each item is waiting on. Sammy picks from
this; Claude keeps it current. Last updated 07/10/2026.

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

Also needed before the Program WhatsApps can send: the eight new templates
submitted to Meta (Sammy pastes the WhatsApp token; Claude runs
`npm run wa:templates`).

**On** (Sammy's call, 07/10): the win-back email after notice to cancel.
**Off and not TeamUp-driven any more:** the GymGrow welcomes fire only
when staff mark a sale on the pipeline.

## Work streams

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
   contact, the Accountability screen, the welcome email (off). Next:
   attendance from TeamUp, then the weekly check-in.
   Waiting on Sammy: approve the welcome email on the Accountability
   screen; send one real member their link when ready.
3. **Photo background on the questionnaire** (improvement list item 1).
   Waiting on Sammy: a photo from Round One.
3b. **Win-back email the day after notice** (improvement list item 7).
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

## Done and off the list (05–06/10/2026)

Email enquiries built, connected and fixed (send-only key → full access;
catch-up every 5 minutes; Send-to address picked out of form
notifications; AI rewrite box); questionnaire card; mailouts; Resend
webhook events; every TeamUp customer imported; Meta and TeamUp
pipelines; the 1,000-row loading cap fixed; win-back built, editable with
drafts, tested; Cancellations screen with paging; sidebar badges that clear
on open; deleted-customer placeholders removed; accountability plan
written and parked; PR #2 closed.
