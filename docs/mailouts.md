# Mailouts: marketing emails to members, ex-members and old leads

Status: **built 06/10/2026 (PR #38), on Resend's free plan until Sammy
upgrades.** Improvement list item 4.

## What Sammy decided (05/10/2026, multiple choice)

- **Resend plan:** develop on the free plan, Sammy will upgrade to Pro ($20
  a month) when it's used for real. **Reminder is in
  `docs/before-go-live.md`.** Until then the CRM sends at most
  `MAILOUT_DAILY_LIMIT` (default 80) mailout emails a day and carries on
  each day; after the upgrade set `MAILOUT_DAILY_LIMIT=0` in Vercel to lift
  it.
- **Format:** plain text in the Round One voice, like every other email.
- **Audience:** TeamUp members and ex-members, plus trial leads who never
  joined (any pipeline stage except Sold).
- **Sender:** info@round1boxfit.co.uk, so replies land in Enquiries.

## How it works

1. **Mailouts screen** (sidebar). New mailout → pick who gets it: current
   members, ex-members (optionally only those who ended within 3, 6, 12 or
   24 months), both, or none; TeamUp categories; old leads by stage. The
   count updates as you pick, with a few names. Anyone with no email, who
   opted out (STOP, unsubscribe link, staff tick box, or a spam complaint)
   or whose email bounced before is left out. One email per address.
2. **Write it**: subject and plain-text message with `{first}`, `{name}`,
   `{gym}`, `{team}`, `{address}`, `{unsubscribe}`. "Send me a test" emails
   the signed-in staff member, filled in as if for the first recipient.
3. **Send** → "Send “…” to N people?" → **Yes, send to N**. The only
   sending route needs `confirm: true` and a signed-in staff member.
4. **Queue.** One `mailout_recipients` row per person. The CRM sends in
   batches of up to 100 through Resend's batch endpoint, at once and then
   from `/api/cron` every 5 minutes, within the daily allowance. The
   screen shows Sending · done/total and refreshes itself.
5. **Every email** ends with "To stop these emails: <link>" and carries
   `List-Unsubscribe` plus one-click headers, so mail apps show their own
   Unsubscribe button. The link goes to `/u/<contact id>` (a page with a
   button, so link scanners don't opt people out); one-click POSTs to
   `/api/unsubscribe/<id>`. Both set `marketingOptOut` through the engine,
   so the contact page and future mailouts respect it.
6. **Afterwards** Resend's webhook reports delivered, opened, clicked,
   bounced and spam complaints per recipient; the mailout shows the
   numbers. A bounce sets `contact.emailBounced`; a complaint opts them out.
   **The webhook's event list in Resend still needs widening** from
   `email.received` to also include sent, delivered, delivery_delayed,
   bounced, complained, opened, clicked (Resend → Webhooks → the
   round-one-crm.vercel.app one → Edit). Until then the counts stay at
   "Sent".

Service messages (bookings, reminders, Program messages) are separate and
never blocked by the opt-out; see `docs/teamup-members.md`.

## Pieces

`supabase/migrations/20261006000000_mailouts.sql` (`mailouts`,
`mailout_recipients`, `contacts.email_bounced`), `src/lib/server/mailouts.ts`,
`/api/mailouts*`, `/api/unsubscribe/[id]`, `/u/[id]`, `/api/webhooks/resend`
(delivery events), `/api/cron` (drains the queue), the Mailouts screen,
`MAILOUT_DAILY_LIMIT` in `.env.example`.

## Where we stopped (06/10/2026)

Built and merged; migration applied. Not yet used for real. Tests are E1 to
E9 in `docs/test-log.md`. Still to do: Sammy widens the Resend webhook
events (above) and upgrades Resend to Pro before the first big send, then
`MAILOUT_DAILY_LIMIT=0` in Vercel.
