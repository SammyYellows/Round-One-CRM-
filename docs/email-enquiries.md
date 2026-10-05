# Email enquiries with AI-drafted replies

Status: **built 05/10/2026, waiting to be connected.** See "Where we
stopped" at the bottom for what's left.

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

## No new package

Claude is called over plain `fetch` (`src/lib/server/ai.ts`), the same way
Resend and WhatsApp are, so the `@anthropic-ai/sdk` question went away.

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

## Where we stopped (05/10/2026)

**Built (PR #33):** `enquiries` table and migration (applied to
round1-dev), `src/lib/server/enquiries.ts` (ingest, classify and draft,
contact matching, "Draft ready" nudge, send with threading),
`src/lib/server/ai.ts`, `/api/webhooks/resend` (Svix signature),
`/api/enquiries*` routes, the Enquiries screen (list, email, editable
draft, **Send reply → "Send this reply to …?" → Yes, send it**, Draft
again, No reply needed, Gym facts editor), sidebar link, `email.received`
and `email.replied` events. The facts sheet's first draft is from the
website and is in the database; Sammy should read and correct it on the
screen (prices and hours are marked "check").

**Rule from Sammy (05/10):** nothing is ever sent unless the confirm box
is pressed. The only sending route needs `confirm: true` and a signed-in
staff member; the AI never sends.

**To connect it, in this order:**
1. **Anthropic key** → Vercel `ANTHROPIC_API_KEY` (Sensitive). Sammy gives
   it to Claude in chat, like the TeamUp token (rotate at go-live).
2. **Resend receiving.** In Resend (resend.com → Domains): add
   `inbound.round1boxfit.co.uk`, choose receiving, copy the MX record it
   shows. Then Webhooks → Add: URL
   `https://round-one-crm.vercel.app/api/webhooks/resend`, event
   `email.received`; copy the signing secret → Vercel
   `RESEND_WEBHOOK_SECRET` (Sensitive). (If Sammy gives Claude the Resend
   key, Claude can do the webhook part via the API.)
3. **SiteGround.** Site Tools → Domain → DNS Zone Editor: add Resend's MX
   record for `inbound`. Site Tools → Email → Forwarders: forward info@ to
   `crm@inbound.round1boxfit.co.uk` (keep a copy in the inbox).
4. Redeploy, then Sammy sends a test email to info@ from his own address,
   sees it on Enquiries with a draft, and sends the reply from there.
