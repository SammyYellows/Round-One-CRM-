# TeamUp members: reminders, timetable and selling messages

Status: **part 1 built and live (03/10/2026); parked by Sammy on 05/10/2026.** Pick up from "Where we stopped" at the bottom. Sammy's idea: pull current
customers from TeamUp regularly and, depending on their membership category,
automatically send reminders, class timetable information and selling
messages (e.g. moving Program members on to a recurring membership; Sammy
will state the wording), then prompt staff in the CRM when someone replies.

## What TeamUp's API gives us (checked 03/10/2026)

- Base: `https://goteamup.com/api/v2`, JSON, 100 per page, 250 requests a
  minute. Round One's provider id is **10418134** (header
  `Teamup-Provider-ID`).
- **Without any login** it already returns the 7 membership categories
  (Premium, Program, Class Only, Facility Access Only, Youth, Student &
  Blue Light, Staff), the 15 memberships for sale (Premium Heavyweight,
  Middleweight, Class Pass PAYG, Full Facility Access, Youth Boxers, Day
  Pass, the student/blue-light versions) and the full class timetable
  (`/events`, 1,985 classes). The 28 Day Program (274852) is not in the
  public list, so it's a hidden or provider-only membership.
- **With a token:** `/customers`, `/customer_memberships` (who has what,
  start and expiry, holds), `/attendances`, `/invoices`, `/payment_subscriptions`.
- **Token:** TeamUp has no API keys or client-credentials; the supported
  server key is a **Machine-to-Machine (M2M) token** (admin-level, acts as
  the business, up to 2 per application). Sent as `Authorization: Bearer`.
  Made in the business dashboard: Settings → Integrations → API Integration
  → Get Started (create an API Application) → Options → View and Update
  Applications → M2M Tokens → Add (set expiry and permissions). Help
  article: support.goteamup.com/en/articles/14819895.
- **Webhooks:** "feed items" (e.g. `customer.created`,
  `event_registration.created`, membership changes) POSTed to a URL we set
  (dashboard or `POST /webhook_destinations`). Not signed: we use an
  unguessable URL, de-duplicate on `TEAMUP-WEBHOOK-ID`, treat it as a nudge
  and re-fetch the real data with the token. Must answer within 10 seconds.

## How it would work

1. **Sync.** A nightly pull (and the webhook nudges in between) copies
   customers and their memberships into a `members` table: name, email,
   mobile, membership, category, start, expiry/renewal, status, last
   attendance. Members are matched to existing CRM contacts on email or
   mobile, so a trial lead who joined shows their membership.
2. **Members screen** in the CRM: who's on what, filters by category,
   expiring soon, not attended lately. Separate from the trial pipeline
   (the pipeline still ends at the sale).
3. **Member automations**, as data like the others, with new triggers:
   `membership.started` (category), `membership.expiring` (days before),
   `membership.ended`, `no_attendance` (days), and a weekly `schedule`
   (e.g. Sunday evening timetable). Steps reuse `whatsapp` and `email`.
   Sammy supplies the wording per category; the timetable step builds its
   text from `/events` for the coming week.
4. **Replies** land in the CRM as they do now (WhatsApp via the webhook,
   email via the inbound route from `docs/email-enquiries.md`) and staff
   are prompted to answer, with AI drafts once that's built.
5. **Opt-out.** Every marketing message carries a way to stop (reply STOP /
   unsubscribe link); a `marketing_opt_out` flag on the member is honoured
   everywhere. Reminders about their own membership can still go.

## Limits to know

- **WhatsApp to members can't start until the real number moves from
  GymGrow.** Meta's test number only reaches Sammy's phone. Email works now.
- Marketing templates need Meta approval on the real account.
- UK GDPR / PECR: marketing by WhatsApp or email needs consent or the
  existing-customer basis plus an easy opt-out. Service messages (your
  membership renews on…) don't need marketing consent.
- The plan scope in `CLAUDE.md` already covers this ("selling and marketing
  is managed in the CRM; TeamUp stays the membership system; read from it").

## Decisions (Sammy, 03/10/2026)

- **Build now.** It's independent of the email enquiries and of go-live.
- **Both channels from the start:** every member message has an email
  version (live as soon as built) and a WhatsApp version (switched on when
  the real number moves from GymGrow).
- **Program Memberships only** to start (the 28 Day Program people),
  including the selling messages that move them on to a recurring
  membership. Other categories later.
- **Accountability add-on:** a separate work stream. Sammy is designing it
  in another Claude chat and will export a Markdown file to import here.
  Keep the member messaging generic enough to carry an add-on offer later.
- Wording: Sammy will state it; nothing goes out with made-up facts.
- **Program messages are service messages, not marketing (Sammy,
  05/10/2026).** They are part of what Program members are paying for, so
  they don't need a STOP option and are not blocked by `marketingOptOut`.
  In the CRM that means: email steps without `marketing: true`, and
  WhatsApp templates submitted to Meta as Utility, not Marketing. The
  opt-out still applies to genuine marketing to members and ex-members
  (improvement list item 4).

## Sammy's jobs when we start

1. TeamUp: Settings → Integrations → API Integration → Get Started; create
   the application ("Round One CRM"), then Options → View and Update
   Applications → M2M Tokens → Add. Expiry as long as allowed.
2. Put the token in Vercel as `TEAMUP_M2M_TOKEN` (Sensitive, Production +
   Preview). Claude adds `TEAMUP_PROVIDER_ID=10418134` itself.

## Claude's build list

- `src/lib/server/teamup.ts` (fetch with the token and provider header,
  paging, 429 back-off), `members` table (RLS on), nightly sync via the
  existing `/api/cron`, `/api/webhooks/teamup/<secret>` receiver.
- Members screen; member fields on the contact page.
- New triggers and the `schedule` trigger in `engine.ts`; a timetable text
  builder; opt-out handling in `receiveWhatsApp` (STOP) and email.
- Templates for Meta (after the number moves) and email versions now.

## Where we stopped (05/10/2026)

**Done and live (PR #24):** nightly sync at 03:00 (`/api/cron?job=teamup`),
Members screen, membership triggers (`membership.started`, `.ending`,
`.ended`), STOP / staff opt-out, TeamUp webhook receiver, `teamup_members`
raw copies. Vercel has `TEAMUP_PROVIDER_ID=10418134` and
`TEAMUP_WEBHOOK_SECRET`. The sync answers "skipped" until the token is in.

**Waiting on Sammy:**
1. The M2M token in Vercel as `TEAMUP_M2M_TOKEN`. **Update 05/10: one
   already exists** (from `docs/accountability-handover.md`): TeamUp app
   "Round One Accountability", read-only scope, token expires 3 Aug 2027,
   viewable again via the eye icon on TeamUp's Integrations page. Read-only
   is all the CRM needs, so reuse it rather than making another: copy it
   into Vercel as `TEAMUP_M2M_TOKEN` (Sensitive). Set a go-live reminder to
   replace it, since it was pasted in that other chat.
2. The wording and timing for the Program Memberships messages (welcome,
   reminders, timetable information, "move to recurring" offers), in both
   email and WhatsApp versions.
3. The accountability add-on notes (separate stream, Markdown export from
   another chat).

**Sammy is uploading a Markdown file from other work (05/10) that may
answer some of this. Read it first when resuming.**

**Update 05/10/2026:** the token is in Vercel as `TEAMUP_M2M_TOKEN` (Sammy
gave it to Claude in chat, so it's on the go-live rotation list). Mapping
checked against the real rows: 744 customer memberships (315 active, 234
cancelled, 193 completed, 2 on hold), 7 categories by id, Program
Memberships = category 86746 (prepaid, 24 active rows). Fixed: `completed`
now counts as ended; `renewal_date` is read as the end date. **TeamUp's
API has no phone numbers on customers**, so members are matched on TeamUp
id or email, and WhatsApp to members will need their numbers from
somewhere else (the trial form, or an export). TeamUp also keeps its own
customer `status` (e.g. `at_risk`), which could feed the nurture messages
later.

**Decisions (Sammy, 05/10/2026, after the baseline):**
- **Mobile numbers come from the CRM's own data**, not TeamUp: when a trial
  lead joins, the sync matches their TeamUp record to the existing contact
  on email, so the mobile they gave on the form is already there. Members
  who never came through the form have no number until staff add one on
  the contact page. No TeamUp export.
- **Sammy writes the Program messages himself** and will say what to build
  and when. Claude builds nothing for member messaging until then.

**Update 06/10/2026: every TeamUp customer, not just members.** Sammy
compared the CRM with TeamUp's customer list (1,264 people) and the CRM had
only the 532 who had ever held a membership. The other 732 made a TeamUp
account (free class, enquiry) and never bought; TeamUp labels most of them
"lost". Sammy's decision: bring them all in, with a filter and sort by how
long ago they came in. So the sync now reads `/customers` too
(`importCustomers` in the engine): they become contacts with source
`teamup`, stage "new", off the Pipeline, `contact.teamup` holding TeamUp's
customer id, status and created date, and `createdAt` set to when they
first appeared in TeamUp (existing TeamUp contacts were backdated the same
way). Members → "Never joined" lists them newest first with a "came in
within" filter; Mailouts can pick "TeamUp sign-ups who never joined" with
the same filter. **Two pipelines (Sammy, 06/10):** the sidebar has a Meta
pipeline (ads, form, walk-ins, referrals, WhatsApp, email) and a TeamUp
pipeline (everyone from TeamUp) with filters for members / ex-members /
never joined and came in within 7 days to a year, newest first. Dragging a
TeamUp person to a stage works the same as on the Meta pipeline. The
Today page counts TeamUp people under "Where leads come from" but keeps
them out of the trial funnel and daily leads chart. Members' and never-joined people's mobile numbers still
don't come from TeamUp.

**Win-back (06/10/2026):** the sync records TeamUp's
`is_set_for_cancellation` as `membership.cancelling` and fires
`membership.cancelling` the first sync after it flips (the first sync
after this change only records it, so nobody already serving notice gets
emailed). Automation "Gave notice – win-back": wait 24 hours, marketing
email drafted by Claude, off until Sammy approves it. Marketing emails
from automations now carry the unsubscribe footer and headers, like
mailouts.

**Sidebar badges (06/10):** Enquiries shows how many are waiting for a
reply (asked every minute); Cancellations shows notices recorded in the
last 7 days. The win-back email goes from info@ (like mailouts), so a
reply lands in the inbox and comes into Enquiries with a draft.

**Cancellations screen (06/10):** sidebar → Cancellations lists everyone who
has given notice: membership, when the notice was recorded, when the
membership ends, and the win-back email's state (sent on a date, goes at a
time, or why not: automation off, opted out, no email, notice given before
tracking began). Filter by when notice was given.

**Program members screen (06/10):** sidebar → Program members. Everyone on
the 28 Day Program now (day N of 28, start, end, which messages have gone)
and the Program messages in order, each on an editable card with named
drafts, an AI rewrite and Approve-and-switch-on: the welcome (the existing
`sold_programme` automation, on), a two-week check-in (`program_check_in`,
off, draft by Claude) and a week-to-go move-to-recurring offer
(`program_ending`, off, draft by Claude). Both new ones are driven by the
TeamUp sync (`membership.started` / `membership.ending` for the Program
category) and are service messages. The accountability check-ins will
live on this screen too when that programme is built.

**Program schedule (06/10):** nine messages across the 28 days (days 1, 3,
7, 10, 14, 17, 21, 24, 28), each a WhatsApp template (utility) plus an
email, timed from the Program membership start in TeamUp. All off except
the day-1 welcome. The WhatsApp templates (`program_day_3` … `program_day_28`)
are in the templates table as drafts and need submitting to Meta
(`npm run wa:templates`, needs `WHATSAPP_TOKEN`) and, at go-live,
re-approving on the real account. WhatsApp only reaches people who have a
mobile in the CRM (TeamUp gives none), so most Program members get the
email only until numbers are added.

**Failed payments (07/10):** the sync reads TeamUp's payment subscriptions
(`retry_count` = failed attempts, linked from each customer membership's
`payment_subscription`) and open invoices (by payer), into
`membership.paymentRetries` and `membership.owed`. At three attempts
(`PAYMENT_FAILED_AT`) it logs "N failed payment attempts" on the timeline
and fires `payment.failed`; the first sync after this change only records
the counts. Sidebar → Failed payments lists everyone at three or more with
what they owe and the email's state, badge like Cancellations, and the
"Payment failed – update your details" automation on an editable card, off
until approved. The contact page's membership line shows attempts and the
amount owed.

**Claude's next steps, in order:**
1. ~~Run the first sync and check the mapping.~~ Done 05/10/2026: the
   baseline sync ran on the live site. 542 contacts added (source
   `teamup`), 5 matched existing ones, no messages. 304 active members
   (281 Sold – Recurring membership, 23 Sold – Programme) and 238
   ex-members (ended membership; they stay at stage "new" and off the
   Pipeline). None has a phone number; 20 have no email either. The Members
   screen now shows real people.
2. Add the TeamUp webhook destination (dashboard: Settings → Integrations →
   API Integration → the application → Add Webhook Destination, URL
   `https://round-one-crm.vercel.app/api/webhooks/teamup/<TEAMUP_WEBHOOK_SECRET>`,
   all event types) or via `POST /webhook_destinations`.
3. Build the Program Memberships automations from Sammy's wording: email
   steps now, WhatsApp templates submitted to Meta (live after the number
   moves). Timetable step: a text builder from TeamUp `/events` for the
   coming week (not built yet).
4. Member replies: WhatsApp already lands in the CRM; email replies need
   the inbound route from `docs/email-enquiries.md`.
