# Wrap-up day: Sunday 11/10/2026

Sammy, 10/10: tomorrow is for tying everything up, so the CRM is ready
for gym staff on Monday 12/10. Everything still open is below, in order.
Each line is either a job (who does what) or a yes/no to close it.
**The only thing that stays open afterwards is the GymGrow import**
(waiting on the Opportunities export; Sammy can't get it yet).

Claude will walk through Parts 2 and 3 as multiple-choice questions.

## Part 1: setup for Monday (jobs)

Full steps for each are in `docs/go-live-day.md`.

| # | Job | Who | Needed for Monday? |
|---|---|---|---|
| 1 | Add the staff on the Staff page (name, email, role); they set passwords from the invite | Sammy | **Yes** |
| 2 | WhatsApp: screenshot of Meta Business Suite → WhatsApp accounts, then move the number (path A or B) | Sammy, then Claude | Yes, or replies keep going unanswered |
| 3 | WhatsApp templates submitted to the real account, webhook subscribed, Meta app Live | Claude, after 2 | With 2 |
| 4 | Test on Sammy's phone: form → leads_1, book → discovery_1, reply shows in the CRM, STOP works | Sammy + Claude | With 2 |
| 5 | Vercel Pro | Sammy | No, but cheap and quick |
| 6 | crm.round1boxfit.co.uk: CNAME `crm` → `f21c7aa8e394b2bf.vercel-dns-017.com` at SiteGround | Sammy, then Claude | No |
| 7 | Privacy page on the website (paragraphs in `docs/privacy-paragraphs.md`), send the address | Sammy, then Claude | Before the ads restart |
| 8 | Replace the keys pasted in chat (Resend, TeamUp, Kisi, WhatsApp, Meta secret, Supabase last); delete the old full-access Resend key | Sammy | No, but do it while logged in everywhere |
| 9 | (Optional) move the server to Dublin, next to the database | Claude | No |

## Part 2: switched-off messages (approve, or keep off)

| # | Message | Where | Note |
|---|---|---|---|
| 10 | Program days 1–28 (9 messages) | Program members | Sammy: keep off until the WhatsApp templates are approved on the real number (step 3). Approve then, or say "keep off". |
| 11 | Payment failed – update your details | Failed payments | 46 people would qualify on the first run; it only sends to people who fail from now on. |
| 12 | Accountability welcome, weekly check-in, mid-week nudge | Accountability | Only reach members who join the programme by link. |
| 13 | Weekly, monthly and unpaid report schedules | Reports → Settings | Need the other managers' numbers first, and the `management_report` template (step 3). |

## Part 3: loose ends (do it, or close it)

| # | Item | To close it |
|---|---|---|
| 14 | Route 2 schedule (messages for people who sign up straight in TeamUp) | Describe the days and channel, or drop it |
| 15 | Tick boxes on the questionnaire (item 10) | Send the option lists, or drop it |
| 16 | Blocking after failed payments in TeamUp (item 15) | Send the TeamUp screenshot, or drop it |
| 17 | Two-way TeamUp actions (item 9) | Pick the first action, or park it |
| 18 | Photo background on the questionnaire (item 1) | Send a photo, or drop it |
| 19 | Win-back research (item 17) | Do it, or drop it |
| 20 | Booked video missing on discovery_1 | Drop it (parked as fine since 27/09) |
| 21 | Romel Rodriques: three Full Facility Access memberships in TeamUp | Check in TeamUp, or ignore |
| 22 | Coaches on members (so lapse alerts go to the right coach) | Staff set them from Monday, or Sammy does it |
| 23 | Equipment note on Train Champ (so class plans use the real kit) | Sammy writes it, or later |
| 24 | Mobile numbers for TeamUp-only Program members | Staff add them as they see people, or drop it |
| 25 | Resend Pro (before the first big mailout) | Later, when a mailout is planned |
| 26 | Test log: the email, form and mailout tests still owed | Run during step 4, or close as covered by Monday's real use |
| 27 | Staff Access membership in TeamUp has "no allotment set", so TeamUp won't book staff into classes (found testing Champ's booking, 10/10) | Set an allotment in TeamUp, or leave it |
| 28 | Champ booking: does TeamUp email the member when Champ books them? | Check on the first real booking |

## Stays open

- **GymGrow import:** waiting on the Opportunities export. Never import
  Sammy's personal contacts (the 765 untagged rows).
