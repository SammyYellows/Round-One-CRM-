# Open list

Everything in progress and what each item is waiting on. Sammy picks from
this; Claude keeps it current. Last updated 06/10/2026, 23:15.

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

Program route 2 (signed up straight in TeamUp): Sammy to describe the
schedule; only the day-1 welcome exists so far.

Also needed before the Program WhatsApps can send: the eight new templates
submitted to Meta (Sammy pastes the WhatsApp token; Claude runs
`npm run wa:templates`).

**On** (Sammy's call, 07/10): the win-back email after notice to cancel.
**Off and not TeamUp-driven any more:** the GymGrow welcomes fire only
when staff mark a sale on the pipeline.

## Work streams

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
2. **Accountability programme** (`docs/accountability.md`). Plan only,
   parked. Both keys it needs are in Vercel.
   Waiting on Sammy: say go; the floor decision (cap at three or keep "at
   least four"); whether Claude drafts the email wording.
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
