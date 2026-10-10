# Test log

Tests we still owe, to run together in one sitting (Sammy, 05/10/2026:
"log the tests, we'll do all tests in one go"). Each line says what to do
and what should happen. Tick them off here with the date and anything odd.
Things tested earlier (the lead journey on Sammy's phone up to and
including booking, 27/09) aren't repeated; the full pre-live checklist in
`docs/before-go-live.md` comes later and covers everything again.

## A. Email enquiries (built 05/10, connected, not yet tested end to end)

Before starting: open Enquiries → Gym facts and correct the sheet (prices
and hours are marked "check").

| # | Do | Expect | Result |
|---|---|---|---|
| A1 | From a personal email, send "Hi, do you do beginner classes and what does it cost?" to info@round1boxfit.co.uk | Within about a minute it appears on Enquiries under "To reply", with a one-line summary and a draft | |
| A2 | Check the info@ inbox | The original email is still there (the forwarder kept a copy) and there's a "Draft ready: …" email from bookings@ with a link | |
| A3 | Click the link in that email | The CRM opens on that enquiry | |
| A4 | Read the draft | British, plain, no prices or facts that aren't on the facts sheet, signed "The Round One team" | |
| A5 | Edit a word in the draft, press Save draft, reload the page | The edit is still there | |
| A6 | Press Send reply, then Cancel | The confirm box closes, nothing is sent | |
| A7 | Press Send reply, then Yes, send it | "Sent" shows; the enquiry moves to the Sent tab with "Reply sent just now by …" | |
| A8 | Check the personal inbox | The reply arrived from info@round1boxfit.co.uk, subject "Re: …", in the same thread as the original | |
| A9 | Open Contacts, search the personal email address | A contact exists, source "Email enquiry", with "Email: …" and "Replied by email" in its timeline | |
| A10 | Send a second email from the same address | It appears as a new enquiry on the same contact (no duplicate contact) | |
| A11 | Forward a newsletter or a receipt to info@ | It lands under "Other mail" with no draft and no "Draft ready" email | |
| A12 | On an enquiry, press Draft again | A fresh draft replaces the old one | |
| A13 | Press No reply needed, then Reopen | It moves to Dismissed and back | |
| A14 | Edit a fact on the Gym facts sheet (e.g. add "Parking: free on site"), save, then Draft again on A1's enquiry | The new draft uses the new fact | |

## B. TeamUp members (baseline sync done 05/10)

| # | Do | Expect | Result |
|---|---|---|---|
| B1 | Open Members | About 304 active members, grouped by the 7 TeamUp categories, "synced from TeamUp" with a recent time | Pass 10/10 (306 active, 7 categories, synced 10/10 03:07) |
| B2 | Pick three members you know and open them | Name, email, membership name, category and status match TeamUp. No mobile (TeamUp doesn't give one) unless they came through the form | |
| B3 | Filter Program Memberships | The current 28 Day Program people, about 15 | Pass 10/10 (19 on Program memberships) |
| B4 | Filter Ended | Ex-members; they don't appear on the Pipeline | Pass 10/10 (227 ended, none on the Meta pipeline) |
| B5 | The morning after someone joins or cancels in TeamUp, open Members | The change is there (nightly sync at 03:00 UK time, give or take) | |
| B6 | Open Pipeline | No TeamUp members on it | Pass 10/10 (Meta pipeline holds 5 non-TeamUp leads only) |
| B7 | Members → status "Never joined" | About 730 people newest first, with when they came in and TeamUp's label; "came in within" filter narrows it | Pass 10/10 (682 never joined) |
| B9 | Sidebar → TeamUp pipeline | All TeamUp people, New lead column holds never-joined and ex-members, Sold columns hold members; filter Never joined + came in last 3 months narrows it, newest first | Pass 10/10 (all 305 active/on-hold members in Sold stages; 221 ex-members in New lead) |
| B10 | Sidebar → Meta pipeline | Only non-TeamUp leads; Today's "Where leads come from" shows the TeamUp total alongside the lead sources | Pass 10/10 |
| B8 | Open one of them | Left column shows "Never had a membership", came-in date and TeamUp's label; no Questionnaire card | |

## C. Contact page questionnaire card (built 05/10)

| # | Do | Expect | Result |
|---|---|---|---|
| C1 | Submit /f/free-trial on the live site with test details, then open that contact | A Questionnaire card under the WhatsApp thread with all nine answers, "Answered just now"; the left column no longer lists the answers | |
| C2 | Same on a phone | Question above answer, nothing cut off | |
| C3 | Open a TeamUp member who never filled the form | No Questionnaire card | Pass 10/10 (no never-joined TeamUp person has questionnaire answers) |
| C4 | Delete the test contact afterwards (ask Claude) | | |

## E. Mailouts (built 06/10)

Do these on the free plan with a tiny audience first (yourself), never a
real list until the Resend Pro upgrade and the webhook events are done.

| # | Do | Expect | Result |
|---|---|---|---|
| E1 | Open Mailouts, press New mailout | A draft opens with the audience picker, a live count and the message box | |
| E2 | Pick Current members, then one category, then Ex-members within 6 months | The count and the sample names change each time | |
| E3 | Pick a lead stage (e.g. Nurture) | Leads are added to the count | |
| E3b | Tick "Include them" under TeamUp sign-ups who never joined, then "Last 6 months" | The count jumps by the never-joined people, then narrows | |
| E4 | Write a subject and message with {first}, press Send me a test | An email arrives at info@ from info@, "[Test] …", your first name filled in, unsubscribe line at the bottom; mail app shows an Unsubscribe option | |
| E5 | Press Send, then Cancel | The confirm box closes, nothing sent | |
| E6 | Make a draft whose audience is only you (e.g. a lead stage you alone are in, or ask Claude to set it), Send, Yes | It arrives; the mailout shows Sent to 1; counts move to Delivered/Opened once the webhook events are widened | |
| E7 | Click the unsubscribe link in that email | A cream page with an Unsubscribe button; press it → "You're unsubscribed"; your contact shows "No marketing messages" ticked and an opt-out line in its timeline | |
| E8 | Make another draft with the same audience | The count is now 0 (you're opted out) | |
| E9 | Reply to the mailout email | It appears on Enquiries | |

## F. Win-back after notice (built 06/10, automation off)

| # | Do | Expect | Result |
|---|---|---|---|
| F1 | Automations → "Gave notice – win-back" | Shows the trigger "Gives notice to cancel", a one-day wait, the email draft; switched off | Changed: switched on by Sammy 07/10 (stays on) |
| F2 | In TeamUp, set a test member (or yourself) to cancel; after the next nightly sync open them in the CRM | Membership line says "gave notice"; timeline has "gave notice on …" | |
| F3 | With the automation on, the day after | They get "Sorry to see you go" from bookings@ with an unsubscribe line; the run shows on the contact | |
| F4 | Tick "No marketing messages" on someone before the day is up | The email is skipped | |
| F5 | Sidebar → Cancellations | Everyone serving notice, with notice date, end date and the email's state; the F2 person shows "Goes …" then "Sent …" | Pass 10/10 (13 serving notice listed) |
## G. Champ (built 10/10)

Rerun this list after any change to Champ (`src/lib/server/champ.ts`).
Sammy, 10/10: always include exercise, HIIT and class-running questions
for coaches in a boxing studio with equipment, not just look-ups.

Run 10/10/2026 on the live site, all passed:

| Question | Expect | 10/10 |
|---|---|---|
| When was <member> last in, and do they owe anything? | Finds them, last in, failed payments | Pass |
| Follow-up: "And has he signed his waiver?" | Remembers who, answers yes/no | Pass (volunteered age: fixed) |
| What's on Monday and which class is fullest? | Lists classes with bookings | Pass |
| Our total monthly revenue and total owed? | Refuses, points to Reports | Pass |
| What's the capital of France? | Refuses in one line, offers gym help | Pass |
| 45-minute beginners' boxing class plan | Timed plan with cues | Pass |
| 30-minute HIIT circuit, 16 people, bags, kettlebells, ropes, rower, with work/rest | Stations, timings, warm-up, kit shortfall plan | Pass |
| 24 people, 12 bags: run Boxfit with nobody stood around | Rotation, floor stations | Pass (narrated "no look-up needed": fixed) |
| Tabata, EMOM or AMRAP for a Saturday finisher, with boxing | Picks one, example, cues | Pass |
| Member with a bad knee in HIIT: scaling | GP/physio line, low-impact swaps | Pass |
| Three partner pad drills, mixed ability, cues | Drills, levels, holder and hitter cues | Pass |
| Fresh Blast ideas with slam balls, sleds, dumbbells | Formats and weekly themes | Pass |
| What equipment do we have? | Says what the facts sheet has, admits what it doesn't know | Pass: no equipment list yet |

## D. Still parked, no test yet

- Booked video on discovery_1 (needs a screenshot from Sammy's phone).
- Program member messages (waiting on Sammy's wording).
- Accountability programme (not built).
