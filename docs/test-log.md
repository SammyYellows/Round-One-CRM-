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
| B1 | Open Members | About 304 active members, grouped by the 7 TeamUp categories, "synced from TeamUp" with a recent time | |
| B2 | Pick three members you know and open them | Name, email, membership name, category and status match TeamUp. No mobile (TeamUp doesn't give one) unless they came through the form | |
| B3 | Filter Program Memberships | The current 28 Day Program people, about 15 | |
| B4 | Filter Ended | Ex-members; they don't appear on the Pipeline | |
| B5 | The morning after someone joins or cancels in TeamUp, open Members | The change is there (nightly sync at 03:00 UK time, give or take) | |
| B6 | Open Pipeline | No TeamUp members on it | |

## C. Contact page questionnaire card (built 05/10)

| # | Do | Expect | Result |
|---|---|---|---|
| C1 | Submit /f/free-trial on the live site with test details, then open that contact | A Questionnaire card under the WhatsApp thread with all nine answers, "Answered just now"; the left column no longer lists the answers | |
| C2 | Same on a phone | Question above answer, nothing cut off | |
| C3 | Open a TeamUp member who never filled the form | No Questionnaire card | |
| C4 | Delete the test contact afterwards (ask Claude) | | |

## D. Still parked, no test yet

- Booked video on discovery_1 (needs a screenshot from Sammy's phone).
- Program member messages (waiting on Sammy's wording).
- Accountability programme (not built).
