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

**Claude's next steps, in order, once the token is in:**
1. Run the first sync (it's a baseline: no messages). Check the field
   mapping against the raw rows in `teamup_members` and fix
   `readMembership` in `src/lib/server/teamup.ts` if any field is wrong.
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
