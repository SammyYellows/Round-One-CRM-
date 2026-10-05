# Email enquiries with AI-drafted replies

Status: **planned, parked** (Sammy, 02/10/2026). Nothing built yet. When we
pick this up again, start at "Where we stopped" below.

## What Sammy decided (02/10/2026)

- **Mailbox:** info@round1boxfit.co.uk only, to start. Replies go out as
  info@, in the same thread as the enquiry.
- **Approving:** an Enquiries screen in the CRM (the email on the left, an
  editable draft on the right, a Send button), **plus** an email nudge to
  info@ saying "Draft ready" with a link to it. Nothing sends on its own.
- **AI account:** Sammy sets it up at console.anthropic.com with info@. The
  key goes straight into Vercel as `ANTHROPIC_API_KEY` (Sensitive), never
  into chat.
- **Gym facts:** Claude pulls what's public from roundonefitness.co.uk and
  TeamUp; Sammy fills the gaps and corrects it. Staff can edit the facts
  sheet in the CRM afterwards. The AI only ever states facts from that sheet.

## How it will work

1. **Email in.** A forwarder at SiteGround sends a copy of each email to
   info@ on to an address at `inbound.round1boxfit.co.uk`, a sub-address
   that Resend receives for (one MX record at SiteGround). SiteGround's
   inboxes carry on as they are. Resend calls `/api/webhooks/resend`
   (`email.received`, signed) and the CRM fetches the full email
   (`GET /emails/receiving/:id`: text, html, headers, message_id).
2. **Spot enquiries.** The AI reads each email and decides: enquiry
   (trials, prices, classes, bookings) or not (newsletters, invoices, spam,
   automated mail). Non-enquiries are kept but hidden.
3. **Draft.** For an enquiry it writes a reply in the Round One voice from
   the facts sheet, and the sender becomes a contact (matched on email,
   source "email") if they aren't one already. The CRM emails info@ "Draft
   ready" with a link.
4. **Approve and send.** Staff open Enquiries, edit if needed, press Send.
   The reply goes through Resend from info@ with `In-Reply-To` /
   `References` set, so it threads. The message is recorded on the contact.

Model and price (from the claude-api skill, 02/10/2026): `claude-opus-5-5`,
$4 per million input tokens, $20 per million output; about 1–2p per
enquiry, so roughly £3 a month for 200 emails. Pay as you go.

## Still to agree

- **One new package:** `@anthropic-ai/sdk`, Anthropic's official library.
  Our rule is no new dependencies without agreeing it. Sammy hasn't said
  yes or no yet.

## Sammy's jobs (not started)

1. Anthropic account. **Update 05/10: one already exists** (from
   `docs/accountability-handover.md`): API key created, $5 credit loaded,
   $500/month cap. Reuse it: copy the key into Vercel as `ANTHROPIC_API_KEY`
   (Sensitive). It was pasted in that other chat, so replace it at go-live.
2. Put the key in Vercel: round-one-crm → Settings → Environment Variables →
   `ANTHROPIC_API_KEY`, Sensitive, Production + Preview.
3. Later, once Claude has set up the receiving address: add one MX record
   at SiteGround (Site Tools → Domain → DNS Zone Editor) and a forwarder
   from info@ to the inbound address (Site Tools → Email → Forwarders).
   Claude gives the exact values then.

## Claude's build list (not started)

- `enquiries` table (RLS on): id, resend id, from, to, subject, text,
  received_at, kind (enquiry / other), draft, status (new / drafted /
  sent / dismissed), contact_id, sent_message_id, message_id and
  references for threading.
- `settings` row `gym_facts` (editable in the CRM) with the facts sheet.
- `/api/webhooks/resend` with signature check; `src/lib/server/ai.ts`
  (classify + draft, prompt caching on the facts sheet); Enquiries screen
  under `src/app/(crm)/enquiries`; send route via Resend with threading
  headers; "Draft ready" email; `email.received`, `email.drafted`,
  `email.replied` events.
- Resend: add `inbound.round1boxfit.co.uk` as a receiving domain (try via
  the API first; dashboard if not), get the MX value for Sammy, create the
  webhook, put its signing secret in Vercel as `RESEND_WEBHOOK_SECRET`.
- Facts sheet first draft from roundonefitness.co.uk (opening hours,
  address, memberships, classes) and TeamUp.
- Test with sending off, then one real enquiry from Sammy's own email.

## Where we stopped

02/10/2026: decisions made, costs given, Sammy's jobs listed. Waiting on:
Sammy's OK for the `@anthropic-ai/sdk` package, and the Anthropic key in
Vercel. First build step when resumed: the facts sheet draft and the
Enquiries screen, which need neither.
