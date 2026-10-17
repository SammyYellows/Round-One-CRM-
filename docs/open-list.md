# Open list

Everything in progress and what each item is waiting on. Sammy picks from
this; Claude keeps it current. Last updated 15/10/2026.

**Wrap-up day, Sunday 11/10:** every open item below is on one sheet,
`docs/wrap-up-day.md`, as a job or a yes/no to close it. After that, only
the GymGrow import stays open.

## Switched off, waiting for Sammy's approval (tidied 17/10)

Still off: the three **Accountability** emails (welcome, weekly check-in,
mid-week nudge; approve on Accountability) and the old GymGrow **Intro
Programme – first week check-in** (`programme_week_one`; the Program
messages now cover it). Everything else is on.

| On (17/10) | Fires when |
|---|---|
| Program: 2 days before, days 1, 3, 7, 10, 14, 17, 21, 24, 28 (email + WhatsApp, everyone on a Program) | 09:00 on each day, counted from their Program membership's start date |
| Payment failed – update your details | TeamUp logs the third failed attempt |
| Win-back | The day after notice to cancel |
| GymGrow lead journey (new lead, booked, reminders, no-show, cancelled, attended, sold welcomes) | As before |
| Weekly members report | Mondays 08:00, from 19/10 |
| Monthly growth and Classes and attendance reports | The 1st at 08:00 |
| Unpaid report | The last day of the month at 08:00, from 30/11 |

**Done 08/10:** failed payments missed (Romel Rodriques) fixed. **11/10:** his duplicate Full Facility Access memberships are cancelled in TeamUp; one active since 05/01/2026.

**Program messages ON (17/10, Sammy "1a, 2a"):** all ten switched on for
everyone on a Program however they signed up (route 2 settled: same
messages). The 16 already on a Program were started from where they were
(`program_current`): 72 messages to come from Sun 18 Oct, 88 skipped as
already gone. People who came through the CRM pipeline also still get the
GymGrow "Intro Programme – welcome" when staff mark Sold – Programme.

**15/10:** the Program WhatsApps now read word for word like their emails
(the `_v2` templates, sent to Meta 15/10, pending). Days 21 and 28 lead with
the Post Program membership (the only one that credits the commitment fee
back), with a Claim Post Program offer button and all memberships as the
other choice. The Program emails go as light HTML (buttons, small logo).

**On** (Sammy's call, 07/10): the win-back email after notice to cancel.
**Off and not TeamUp-driven any more:** the GymGrow welcomes fire only
when staff mark a sale on the pipeline.

## Reminders Sammy asked for (08/10/2026)

- **Vercel Pro at go-live** (Sammy, 09/10): raises the function limit from
  60 seconds to five minutes. The sync is now staged so it isn't needed to
  keep working, but it's the headroom. Already on `before-go-live.md`.

- **Unpaid memberships report** (Reports → Unpaid): monthly, the last day
  of the month from 30 November 2026 (Sammy, 15/10). Sammy finds it
  misleading: a weekly to-do "Improve the failed payment report" goes on
  Needs you every Monday from 2 November (`reminders` setting,
  `src/lib/server/reminders.ts`). WhatsApp can't post to a group; it goes to
  each number.
- **Reports: the other managers' numbers.** Set to 07855284151 only for
  now; add the rest in Reports → Settings before switching the schedules
  on. Also the `management_report` template needs Meta's approval.
- **Blocking after failed payments** (improvement item 15): Sammy wants a
  block in TeamUp that keeps billing going, not a hold. **Screenshot sent
  11/10**: customer profile → **Block Customer** / **Unblock Customer**; the
  membership then shows "Registrations Blocked". **TeamUp's API can read
  blocks but not make them** (`/customer_registration_blocks` is GET only;
  the customers report filters on `registration_blocked`). TeamUp also
  lists "membership blocked after failed payment" as a booking refusal
  reason, so it has its own automatic block. **Sammy, 11/10 (the earlier
  "leave it" was a mis-tap): both.** Built: the nightly payments stage reads
  blocks; Failed payments and the contact page show Blocked in TeamUp / Not
  blocked; anyone with 3+ failed attempts who isn't blocked gets a Needs you
  task that ticks itself off (`recordBlocks`). **New failures only** (Sammy):
  the 47 already failing on 11/10 (22 not blocked) were marked
  `blockTaskId: "before-11-10"`, so no tasks for them. 64 blocked in TeamUp,
  57 of them CRM contacts. Waiting on Sammy: switch on
  TeamUp's own auto-block (and the Kisi setting that leaves blocked
  memberships off the door) if wanted. **Open in TeamUp** added 11/10
  (goteamup.com/providers/customers/<id>/) on Failed payments and the
  contact page.
- **Two-way TeamUp actions** (item 9): Sammy wants reminding; the hold
  button is the first one, built 08/10.
- **Test log run** (`docs/test-log.md`): **closed 11/10** as covered by
  staff using the CRM from Monday; log anything odd.
- **Program messages days 1–28:** wording approved (08/10). **Sammy, 10/10:
  keep them off until Meta has approved the WhatsApp templates**, so email
  and WhatsApp start together. That needs the WhatsApp token.
- **Route 2 schedule:** still listening for Sammy's description.
- **Tick boxes on the questionnaire (item 10): done 11/10.** Goals (up to
  2), why now (up to 2, Claude's suggestions Sammy picked) and what you've
  tried (any; "Nothing" clears the rest), each with an "Other" box.
- **Win-back replies** landing in Enquiries: fine as it is (Sammy, 08/10).

## This week (from 11/10/2026): staff get familiar; WhatsApp moves over

**Sammy does the setup on Sunday 11/10; gym staff start using the CRM on
Monday 12/10.**

Ads are paused, so no new leads this week (Sammy, 10/10). The GymGrow
import is paused. Built 10/10 for staff: logins with roles (the Staff page,
management only), staff see the day-to-day screens only, a manual
(`/manual`) and Champ trained on it. Waiting on Sammy: the staff list to
add on the Staff page; the WhatsApp move this week (steps in
`docs/go-live-day.md` §2) so replies land in the CRM; the other go-live
jobs (Vercel Pro, the crm. address, privacy page, keys) as and when.

## Go-live (v1), Sunday 11/10/2026

Full switch-over (Sammy, 10/10; GymGrow is stopped). The day, in order,
is in `docs/go-live-day.md`; privacy paragraphs to paste are in
`docs/privacy-paragraphs.md`. Ready tonight: the consent line on the form
(appears once `PRIVACY_URL` is set) and crm.round1boxfit.co.uk registered
on Vercel (needs one CNAME at SiteGround). Nothing new reaches customers
beyond the ten automations already on.

**GymGrow import: done 11/10** (see Done, item 19: 686 contacts from the Opportunities data, plus 655 old messages in `gymgrow_messages`). The notes below are the history. **Was on hold** (Sammy, 10/10). Contacts export received (1,450
rows: 685 questionnaire leads with email, 683 phone-only contacts uploaded
in one go on 7 May, 82 added individually; 88 already in the CRM). No
notes, stages or answers in it. Waiting on Sammy: the **Opportunities
export** from GymGrow, so each lead goes into its real pipeline stage.
Plan when it comes: preview first (counts per stage and example rows),
import quietly (source GymGrow, original dates, tag gymgrow-import, no
messages, no automations), tag the 88 existing contacts only.
**Never import the 683 rows created on 7 May 2026 with no tag and no
email: they are Sammy's personal phone contacts that synced into GymGrow
(confirmed 10/10).** **Never import the 82 rows with no tag added
individually from May to October either: also personal contacts (Sammy,
10/10).** Only the 685 rows tagged "lead" (questionnaire enquiries) come
in. **Sammy's choice (10/10):** he tries the Opportunities export on
go-live day; if he can't get it, import with the dates rule (last 30 days
→ Contacted for staff follow-up, older → Nurture; the ~87 already known
from TeamUp only get a tag). Keep each person's GymGrow contact ID so a
later Opportunities export can update stages: only people still at their
imported stage change, clashes are shown to Sammy first, and stage
updates from the import never fire automations.

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
   Sammy (photos added 10/10, rotating every 45 minutes): ~~an Equipment note on
   Train Champ~~ **done 17/10** (from Sammy's photos: classes use dumbbells,
   kettlebells and free kit, never barbells, racks or machines); the
   separate management logins (Sammy will go into that later; Teach
   Champ is limited by the Owner/Manager staff role until then). Cost runs on the
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
3. **Photo on the questionnaire** (improvement list item 1). **Done 11/10**:
   the gym photo shows in front of the form on phones and desktop, starts
   fading at 2 seconds and is gone by 5 (a tap skips it). The photo is small
   (490×326); see items 21 and 22.
3b. **Win-back email the day after notice** (improvement list item 7).
   **Stays on (Sammy, 08/10).** Research into better win-back approaches
   is improvement item 17.
   Built 06/10 and tested end to end the same night (sent to info@ via
   the real sync code and the live server). Editable on the Cancellations
   screen with named drafts and an AI rewrite. **Found switched on at
   23:00 on 06/10 with Sammy's edited subject**, so it is live unless
   Sammy switches it off there.
   Decided: stays on (Sammy, 08/10).

## Testing

4. **Test log** (`docs/test-log.md`): about 40 tests owed for what was
   built on 05 and 06/10. Done informally on 06/10: email enquiries end to
   end (A1–A9 in effect), win-back F2–F3. Still to run properly in one
   sitting: the rest, including mailouts (needs Resend Pro or an audience
   of one).
   Waiting on Sammy: pick a time. The mailout tests need Resend Pro, or an
   audience of one.

## Before go-live (`docs/before-go-live.md`)

5. **Privacy policy.** Paragraphs written (`docs/privacy-paragraphs.md`)
   and the consent line built (shows once `PRIVACY_URL` is set). Waiting
   on Sammy: publish the Wix page and send its address (wrap-up #7).
6. **Pre-live test checklist**, the full one. Waiting on Sammy: say when.
7. **Go-live switch-over.** Database decided (`round1-dev` is the live
   one). The rest is wrap-up Part 1 (#1–9).

## Small open items

8. **Booked video missing on discovery_1.** Parked as fine. Waiting on
   Sammy: a screenshot, if wanted.
9. **Delete the full-access Resend key** in Resend → API Keys. Claude has
   finished with it. Sammy's call.

10. **Staff Access has "no allotment set" in TeamUp** (membership 246352).
    TeamUp refuses to book anyone on it into a class ("purchase required").
    **Sammy, 11/10: leave it.** Staff on Staff Access aren't booked.
11. **Champ booking: does TeamUp email the member?** To check on the first
    real booking (Champ tells staff TeamUp "may" send its usual
    confirmation).

12. **Win-back email: new draft "Hold and price rise"** (11/10), saved on
    the card on Cancellations; the live wording is unchanged. Adds the
    hold (keeps their current price and avoids the new joining fee), the
    "main reason?" question, and drops "no joining fee if you come back".
    Waiting on Sammy: make it live (pick it under saved drafts, then "Make
    this the live wording") once the price rise and joining fee are
    confirmed. **The live email still promises no joining fee to
    returners**, so switch before the fee starts.

13. **AI-drafted WhatsApp replies** (improvement item 22, Sammy 11/10):
    like Enquiries, staff approve each reply. Build after the real number
    is connected.

14. **WhatsApp real number: GymGrow removed, billing stuck** (11/10).
    Done: Gym Grow and LeadConnector removed as partners from the whole
    business portfolio (page, ad account, Instagram, WhatsApp);
    LeadConnector's credit line gone. The number +44 7833 399014 (WABA
    "Round One Gym", 1438210021679060, owned by Round 1) is still
    Connected, quality High, and the WhatsApp Business app on the gym phone
    still works (tested). Sammy is a finance editor; his Mastercard is saved
    at portfolio level. **Blocked:** the WABA's payment account
    (1968536350436383) is fixed at India / INR (LeadConnector's set-up), so
    no card can be added and paid messages (templates outside 24 hours)
    can't send. Meta support's suggestion (new GBP WABA + migrate the
    number) is on hold: Meta's developer docs say a coexistence number
    (app + Cloud API) can only be onboarded through a partner's Embedded
    Signup, and plain registration makes it API-only (the app stops).
    **Sammy, 11/10: keep the phone app; fix the billing.** Waiting on a
    human at Meta support to change the currency or give a supported move
    that keeps coexistence. Fallbacks if they can't: a coexistence-capable
    partner just for the move, or going API-only with staff replying from
    the CRM. Until then the CRM stays on the test number for WhatsApp.
    Kept quiet from GymGrow: they only see "disconnected". Also: an ad
    account "unknown (Read-Only)" 1004095058969212 to look at; the
    portfolio's own two-factor setting is "No one" (set to Admins later);
    the legal business name reads LEE HASKINS LTD (check). Card number was
    visible in a screenshot in chat (CVV hidden): Sammy to watch it.

15. **Chrome won't log into Meta** (11/10, evening). Since the YCloud
    sign-up's "Log in with WhatsApp Business app", Chrome on Sammy's
    computer is stuck as the WhatsApp login ("You don't have access – log
    out of your WhatsApp Business app", `out_of_scope_page_type=waba_user`).
    Deleting facebook/meta site data didn't fix it. **Edge works** (use it
    for Meta meanwhile). To try: delete ycloud.com, whatsapp and fbcdn site
    data too; if not, Chrome → Clear browsing data → All time → cookies and
    cached files (logs out of all sites).
16. **WhatsApp via YCloud: finish setup** (11/10, evening). The gym phone
    now shows "Connected platform: YCloud – Finish setting up in YCloud";
    Meta shows +44 7833 399014 as CONNECTED, Cloud API, still on the
    Business app (coexistence back on). YCloud never got access (the sign-up
    ended on "You don't have access"; the Facebook route shows the number as
    "Ineligible"). Waiting on YCloud support to complete it. Not yet tested:
    whether the CRM can send directly through the number with its own key
    (the account still has no card, India/INR). GymGrow's old templates on
    that account have buttons pointing at gymgrow.app, so the CRM needs its
    own templates submitted there. The business portfolio now shows as
    "Round One Gym" in Meta pop-ups (was "Round 1"): check.
    **Checked 11/10 late (`/api/whatsapp-check`, read only):** the CRM's new
    key reaches the gym account; still INR; number CONNECTED, green, on the
    Business app; **display name never approved** (`name_status`
    NON_EXISTS, sending "limited" until it is; also why Meta refused the
    move); no apps subscribed to the gym account (left until the switch);
    GymGrow's 14 templates still there. Moving the number into the GBP test
    account would cost the phone app (fresh add = API-only; Meta's move
    needs a payment method and approved name on the old account, and moved
    numbers are Cloud API only). **Sammy: keep the phone app.** Next: Sammy
    submits the display name "Round One Gym"; YCloud chased (sent, no reply
    yet).
    **Later 11/10: Sammy leaning to API-only after all** (kill the phone app,
    move the number into the GBP test account). Paused to sleep on it;
    pick up 12/10. Plan: 1 back up + export the phone's chats; 2 delete the
    number from the old account in WhatsApp Manager; 3 delete the WhatsApp
    Business account on the phone (wipes chats and backups); 4 add the
    number in the app's WhatsApp API Setup (display name "Round One Gym",
    SMS code); 5 Claude registers it, sets WHATSAPP_PHONE_NUMBER_ID,
    redeploys, checks; 6 test. Messages to the number are lost between 2
    and 5 (30-60 min). Not started; nothing changed yet. The phone app's
    Business Platform screen shows YCloud as connected.
    **12/10: YCloud never replied. Meta support (chat) confirmed currency
    can't change and offered a manual migration by their team into our GBP
    account 1645982367314251, keeping the app and chats (contradicts their
    docs, so unproven).** Sammy wants to keep the app as a backup, so we're
    trying Meta's route first: Direct Support case 29114108551548626 (Phone
    Migration, source 1438210021679060, destination 1645982367314251), opened
    12/10 22:42, updates to sammyaittales@hotmail.com. The display name can't
    be edited in WhatsApp Manager (the app owns the profile). If Meta doesn't
    act, fall back to the API-only plan above. `/api/whatsapp-admin`
    (CRON_SECRET) can deregister/register numbers when needed. Also noticed:
    unanswered Facebook/Instagram messages in Business Suite's Inbox (not in
    the CRM).
    **Night of 12/10: tried the API-only move, blocked.** Sammy exported his
    chats and agreed to delete the app account. The app refuses ("Cannot
    delete account: connected to a third party service") because it's still
    linked to **YCloud** (Settings → Account → Business Platform shows YCloud,
    "Finish setting up in YCloud"); tapping the YCloud box does nothing, even
    after updating the app. WhatsApp Manager (old WABA) has no delete for the
    number. `/api/whatsapp-admin` (now also `add`, `request_code`,
    `verify_code`, `add` with `migrate`) was refused by Meta three ways:
    deregister ("not available for API solution for SMB businesses"), migrate
    ("migrate_phone_number must be false") and a plain add ("Phone Numbers
    Count Exceeded Limit Per Business": the number still holds the slot).
    Nothing changed: the gym phone app and the CRM work as before. **Next
    (Sammy, morning), stop at the first that works:** (1) log in to YCloud
    and disconnect or delete the number there; (2) in the app, Settings →
    Help → Contact us, ask WhatsApp to disconnect business platform YCloud
    from +44 7833 399014; (3) Meta Business support again. Once the link is
    gone: Delete account on the phone, delete the number from the old WABA,
    then Claude adds it to WABA 1645982367314251, Sammy reads the code off
    the phone, Claude registers it (PIN in the session scratchpad), sets
    `WHATSAPP_PHONE_NUMBER_ID` in Vercel, redeploys and tests.
    **13/10 late: DONE on a new number.** 07833 399014 turned out to have no
    SIM (Sammy picked it inside WhatsApp Business), so once the app account
    was deleted it was lost. Sammy bought an eSIM: **+44 7536 138295**.
    Meta's add-number screen (developer app → Production setup) made a new
    WhatsApp account **3694606807344403** (Round One Gym, GBP, card added),
    phone number ID **1285209971352773**, verified on the Cloud API. RoundOnecrm
    has full control; webhook subscribed; the 13 CRM templates submitted (12
    approved, discovery_1 pending); Vercel `WHATSAPP_PHONE_NUMBER_ID` and
    `WHATSAPP_BUSINESS_ACCOUNT_ID` switched and redeployed (old values: test
    phone 1325014870699067, account 1645982367314251). Display name in review
    (sending "limited" until approved). **Built overnight 13/10, waiting for
    Sammy:** contact card `crm.round1boxfit.co.uk/contact` (+ `/contact.vcf`);
    template `new_number` (marketing, "Save our number" button) submitted to
    Meta; WhatsApp mailouts on the Mailouts screen; two drafts there: WhatsApp
    "New WhatsApp number" (everyone who chatted on WhatsApp + current members,
    665 people, ~4 days at 200/day) and the email (1,144 people; 80/day on
    Resend free, so Resend Pro first). All 13 lead-journey templates approved
    on the new account; the journey automations stay ON (Sammy, 13/10; test is
    go-live item 17). `win_back` is ON but its template was never submitted,
    so its WhatsApp fails until the wording is approved. **Still to do:**
    Sammy's test message; approve and send the notices; new number on
    website/Instagram/Google; the
    other 10 templates (Program days, win-back, manager report) once their
    wording is approved; keep the eSIM topped up. Tidy: old 07833 entry
    (unverified, holds a slot), two unknown "Round One Gym UK" messaging
    accounts, the "India" payment configuration.
    **14/10:** `new_number` approved; `win_back` reworded (ends "If there is
    something we can do to keep you here, please let us know") and
    resubmitted. Email mailouts have no daily cap (`MAILOUT_DAILY_LIMIT=0`,
    Resend Pro). Mailouts has Email | WhatsApp buttons. Sammy does the
    questionnaire test on a fresh mobile this evening (go-live item 17);
    Claude then checks it and removes the test contact. Menu reordered
    (Sammy, 14/10): Pipeline holds Meta | TeamUp, Program members holds
    Program | All members, Calendar after Pipeline, Automations after Forms.
    **14/10 evening:** Sammy's test (Kayleigh): leads_1 failed, Meta "payment
    method" error on marketing templates (utility ones send). Sammy to check
    Billing & payments for WhatsApp account 3694606807344403. **Retested
    20:57 the same evening: leads_1 and discovery_1 to Kayleigh both
    delivered, so marketing templates send again.** Booking page on phones
    fixed (short day buttons, times under their own heading).
  - **Facebook and Instagram messages** (Sammy, 14/10, option A: separate
    Enquiries buttons). Built: `/api/webhooks/meta`, replies as the Page,
    echoes from the apps, read receipts, contact page cards, Needs you,
    manual, privacy page. **Waiting on Sammy:** give RoundOnecrm the Page and
    the Instagram account, make a token with the messaging permissions and
    paste it into Vercel as `META_SOCIAL_TOKEN`; then Claude runs
    `social_check`, sets `META_PAGE_ID` and runs `social_subscribe`, and they
    test with a real message on each. **14/10 late: connected** (token and
    Page id in Vercel, webhooks on for Page "Round One" and
    @roundonefitness). Earlier conversations: `social_history` built; Claude
    counts first (dry run), copies them in after Sammy's go ("i just want to
    see the old messages", not leads). **Live messages confirmed (17/10,
    Sammy: "Instagram works")**: new Instagram DMs arrive through the
    webhook (e.g. 17/10 08:44), as do Facebook ones. **Facebook history copied in (14/10, Sammy's
    yes):** 285 conversations, 926 messages back to April 2021, 268 people
    (source facebook, off the pipeline, nothing sent); 194 old ones marked
    No reply needed, 4 from the last week waiting. **Instagram history:**
    Meta times out past Vercel's 60 seconds however small the request;
    retried the morning of 15/10 (dry run): Meta answered "An unknown error
    occurred" after a minute, so still failing on Meta's side. **Instagram history copied in (15/10, Sammy's yes):** once
    the Page route worked again (Instagram Login token not needed): 637
    conversations, 4,417 messages back to December 2020 (source instagram,
    off the pipeline, nothing sent); 331 old ones marked No reply needed, 8
    from the last week waiting. AI drafts now show in the WhatsApp, Facebook and
    Instagram inboxes (Use it, then Send).
  - **Till** (Sammy, 14/10): Epos Now connected (read only; key and secret in
    Vercel). Till page next to Staff, management only: cash in the till since
    the last cash-out, Cash out (count, float, confirm), Cashed out history,
    takings and best sellers; Reports → Till; a Till card on Today for
    management. Sums match the till's own end of day. **Waiting on Sammy:**
    the first Cash out (the starting count). Note the till closes its own day
    at 05:00 with nothing counted; the CRM doesn't use that.
  - **Reports to the managers' WhatsApp** (Sammy, 14/10): `management_report`
    reworded ("Here is the {report}…", Meta refuses a variable at the start),
    approved 14/10 22:58; numbers now get +44 (`waNumber`). Test weekly report
    sent to Sammy (07855 284151) 22:59. **Waiting on Sammy:** is the test OK,
    then numbers for Lee, Claire and Farida, and which schedules to switch on
    (weekly and unpaid Mondays 08:00, monthly on the 1st).
  - **AI drafts read the whole conversation** (Sammy, 15/10): WhatsApp,
    Facebook and Instagram suggestions read the whole thread (was the last
    30 messages) and answer everything since our last message; a slow read of
    fewer messages no longer replaces a fuller one. Email drafts read earlier
    emails with that person and our replies (was the latest email only, cut
    at 8,000 characters). After Send, the Email tab stays on To reply.
  - **Small Ask Champ under the draft replies** (Sammy, 15/10): on the
    Email, WhatsApp, Facebook and Instagram tabs, already pointed at the
    person being replied to. Read-only like Champ; a class booking still
    needs Book.
    **13/10: YCloud link gone; waiting on a number slot.** Meta Direct
    Support (a person) said to clear partner connections; Business Settings
    had none. Sammy pressed **Remove from business portfolio** on the old
    INR WABA 1438210021679060 (no confirm box; it's gone, with GymGrow's
    old templates). An hour later the app let him **disconnect YCloud**:
    the gym phone is now a plain WhatsApp Business app, working as normal.
    Adding the number to WABA 1645982367314251 still fails with "Phone
    Numbers Count Exceeded Limit Per Business" (2388386) although the
    business only has the test number left (the test number can't be
    deleted). Probably Meta's count still catching up; Claude retries.
    **Sammy chose route 1 (API only, 13/10)**: keep-the-app coexistence
    needs a Tech Provider/partner. **Don't delete the app account until the
    add succeeds.** Then: Sammy deletes the app account in the evening,
    Meta's 24-hour wait, Claude requests the code (SMS to the gym phone),
    Sammy reads it out, Claude verifies and registers (PIN in the session
    scratchpad), sets `WHATSAPP_PHONE_NUMBER_ID` in Vercel, redeploys,
    tests. If the slot is still blocked on 14/10: Direct Support ticket
    asking for the number limit to be raised. Note: since 1 Oct 2026 Meta
    charges for service replies (after 1,000 free a month per number) and
    for utility messages inside the 24-hour window.
    **GymGrow message history: done (12/10).** Sammy chose "Everything":
    7,890 messages for 655 people (WhatsApp 4,347 out / 1,699 in, email
    1,360 / 51, SMS 382 / 46, calls 1 / 4) are in `gymgrow_messages`, read
    only, shown on the contact page as "Earlier messages" and readable by
    Champ. Matched on phone then email; nobody added, nobody messaged. 84
    GymGrow conversations matched no CRM contact and were left out. To re-run:
    `scripts/gymgrow-history.ts` (dry run; `--write` saves). **Still to do:**
    the `GYMGROW_TOKEN` key was pasted in chat (12/10), so Sammy deletes it in
    GymGrow (Settings → Private Integrations) and from the cloud environment.
    Some people have duplicate contacts (three Danny Burchills): the history
    went to one of them; a merge-contacts tool may be worth adding.

17. **GymGrow leftovers to check** (11/10, when Meta lets Sammy back into
    Business settings; use Edge). Main access is gone (Gym Grow and
    LeadConnector partners removed, credit line gone, WhatsApp link now
    YCloud). Still to check: (1) Leads Access → CRMs tab: remove
    LeadConnector; (2) Sammy's personal Facebook → Settings → Apps and
    websites: remove GymGrow/LeadConnector (can be done in the Facebook app
    on his phone); (3) Business settings → Integrations / Connected apps
    (keep Round One CRM); (4) the "unknown (Read-Only)" ad account
    1004095058969212. Checked clean by Claude 11/10: the website (only a
    TeamUp link) and round1boxfit.co.uk DNS (no GymGrow records).
    **roundone.uk/apply** (the old ad link to Typeform) no longer opens:
    point the ads at crm.round1boxfit.co.uk/f/free-trial when they restart.
18. **Test sends from the gym number** (11/10): a template to Sammy's own
    phone arrived (free 24-hour window); one to a new number
    (+447712255057) was accepted by Meta but not delivered: paid messages
    are blocked until billing is attached (YCloud). New system-user token
    pasted in chat 11/10: **rotated 11/10, 23:15**: app secret reset and
    all RoundOnecrm tokens revoked, new never-expiring token straight into
    Vercel (not chat); test template to Sammy's phone delivered and the
    signed delivery update accepted.

19. **GymGrow import: done** (11/10, night). The Opportunities export (688
    rows: 677 "lead" + 11 from GymGrow's booking page; no personal
    contacts) imported quietly with `scripts/gymgrow-import.ts`: 603 new
    contacts (339 Nurture, 200 No-show, 50 Contacted, 7 Appointment booked,
    3 Sold – Programme, 3 Sold – Recurring, 1 Appointment attended), 2 test
    rows skipped; 83 already in the CRM tagged (37 moved forward from New
    lead, never backwards). All tagged `gymgrow-import`, original enquiry
    dates, GymGrow ids on `contact.gymgrow` (migration 20261011020000). 16
    staff tasks "was booked in GymGrow, check what happened". The 7
    meetings this week from GymGrow's calendar are in the CRM calendar;
    Sammy chose **email reminders only** for them: automation
    `gymgrow_meeting_reminders` (day before, 2 hours before; the Monday
    ones only get the 2-hour one). No WhatsApps or emails sent at import.
20. **Price rise and smaller memberships** (Sammy, 11/10): switching to a
    smaller membership pays the price at the time of changing.
21. **Original photos** (Sammy, 11/10): the questionnaire photo is a small
    copy (490×326) and looks soft full-screen, mostly on desktop. Waiting on
    Sammy: the original, full-size photos. Reminder set for 12/10 morning.
22. **Accountability forms: change the photo later** (Sammy, 11/10). The
    gym photo shows on every public form, including the accountability and
    check-in forms members get. Fine for now; change it for those later.
23. **Site comments: done 11/10** (improvement item 23): Today layout and
    Ask Champ button, Ask Champ in red, bigger Champ picture, Program members
    swapped, email senders off the Meta pipeline, Remove for managers.

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
