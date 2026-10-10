# Go-live day: v1 (planned for Sunday 11/10/2026)

Sammy, 10/10: full switch-over tomorrow. GymGrow is stopped; Sammy is
exporting its data. **Nothing extra goes to members or customers beyond
what is switched on today.** That means the ten automations below start
reaching real phones (WhatsApp moves from Meta's test number to Round
One's real number), and everything switched off stays off.

## What will reach customers from go-live (all on today)

| Automation | When | Sends |
|---|---|---|
| New lead – booking push | Someone sends the CRM form | Email + WhatsApp leads_1, leads_2, leads_3 (2 days apart, stops on reply) |
| Trial booked – show-up reminders | Intro meeting booked | Email + WhatsApp discovery_1, then a day before, then 2 hours before |
| Trial moved – new time | Meeting moved | WhatsApp discovery_1 |
| No-show – rebooking push | Marked no-show | Email + WhatsApp no_showed_1 |
| Cancelled – rebooking push | Meeting cancelled | Email + WhatsApp cancelled_1 |
| Trial attended – follow-up | Marked attended | WhatsApp discovery_4 (4 hours later) |
| Intro Programme – welcome | Staff mark Sold – Programme | Email + WhatsApp intro_programme_1 |
| Recurring member – welcome | Staff mark Sold – Recurring | Email + WhatsApp recurring_member |
| Did not convert – catch-up | Staff tag did-not-convert | WhatsApp |
| Gave notice – win-back | A member gives notice in TeamUp | Email (already live) + WhatsApp win_back |

**Stays off (no change):** all 14 TeamUp-driven messages (Program days
1–28, payment failed, accountability welcome, check-in and nudge), Intro
Programme first-week check-in, and the report schedules. Members who join
straight in TeamUp are moved to their Sold stage quietly, with no message
(fixed 07/10).

**Staff only, never to customers:** inactivity alerts, the waiver alert,
Champ, conduct flags, "Draft ready" for enquiries.

## The day, in order

Times are rough. WhatsApp is the only step that can take longer than an
hour (Meta's template approvals), so start early.

### 1. Morning, no effect on customers

1. **Vercel Pro.** Sammy: vercel.com → round-one-crm team → Settings →
   Billing → Upgrade to Pro.
2. **Web address.** Sammy: SiteGround → Site Tools → Domain → DNS Zone
   Editor → add a **CNAME**: name `crm`, value
   `f21c7aa8e394b2bf.vercel-dns-017.com` (already registered on Vercel on
   10/10). Claude then: checks it's live, sets `APP_URL` to
   `https://crm.round1boxfit.co.uk`, adds it to Supabase login redirects,
   redeploys. The old vercel.app address keeps working.
3. **Privacy page.** Sammy: publish the Wix privacy page with the
   paragraphs in `docs/privacy-paragraphs.md` (Claude isn't a lawyer:
   check the wording) and send Claude the address. Claude sets
   `PRIVACY_URL`, and the consent line appears above Send on the form
   (built 10/10). Sammy also adds the address to the Meta app (App
   settings → Basic → Privacy policy URL): Meta needs it to switch the
   app to Live.
4. **Staff logins.** Sammy sends each person's name, email and role
   (Owner, Manager or Staff). Claude adds them and sends the invites; they
   set their own passwords (8+ characters).
5. **(Optional) Faster screens.** Move the website's server from
   Washington to Dublin, next to the database in Ireland. One setting,
   Claude does it, no downtime. Also keeps customer data in Europe.

### 2. WhatsApp: the real number (the main job)

First find where the number lives. Sammy: Meta Business Suite →
Settings → Accounts → WhatsApp accounts. Screenshot the list (account
names, owner, phone numbers). Then one of two paths:

- **A. The number's WhatsApp account is already in Round One's own
  business portfolio** (common with GymGrow/LeadConnector set-ups).
  Remove GymGrow's app from it, give the CRM's system user (RoundOnecrm)
  full control of that account, and send Claude the account ID and phone
  number ID. Display name and quality rating stay as they are.
- **B. The number sits in GymGrow's own account.** Ask GymGrow to release
  it (and turn off two-step verification on it), then add the number to
  Round One's account in WhatsApp Manager, verify by SMS or call, and set
  a 6-digit PIN. Claude registers it with that PIN.

Then:

1. **New WhatsApp token and app secret** (key rotation for these two).
   Sammy: Business Settings → System users → RoundOnecrm → Generate new
   token (permissions `whatsapp_business_messaging` and
   `whatsapp_business_management`, the real account ticked); App
   settings → Basic → reset App secret. Put both straight into Vercel
   (`WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, Sensitive), plus
   `WHATSAPP_BUSINESS_ACCOUNT_ID` and `WHATSAPP_PHONE_NUMBER_ID`. Not in
   chat.
2. **Templates.** Claude runs `npm run wa:templates` against the real
   account (with the new web address in the Book meeting buttons). Meta
   usually approves in minutes, sometimes up to 24 hours. Until a template
   is approved, that WhatsApp fails and the person still gets the email.
   If GymGrow's old templates exist with the same names, Claude checks
   whether they match before deciding.
3. **Webhook.** Claude subscribes the CRM to the real account so replies
   and read receipts come in. Sammy switches the Meta app to **Live**.
4. **Redeploy**, then test on Sammy's phone: send the form, get leads_1
   from the real number, book a slot and get discovery_1, reply and see it
   in the CRM, reply STOP and see "No marketing" set.

### 3. Point the ads at the CRM

Sammy: in Ads Manager, change each ad's website link to
`https://crm.round1boxfit.co.uk/f/free-trial?utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&ad_id={{ad.id}}`,
and point the roundone.uk/apply redirect at the same form. Claude checks
the first real lead arrives with its ad.

### 4. GymGrow's export

Send Claude the export file. Claude imports the contacts quietly (no
messages, no automations), matching existing contacts on email and
mobile. People who were mid-sequence in GymGrow don't get the rest of it
unless Sammy decides otherwise.

### 5. End of day: replace the other keys pasted in chat

Each one: Sammy makes the new key and puts it straight into Vercel (and
the cloud environment settings where noted); Claude redeploys and checks
it works.

- **Resend API key** (resend.com → API Keys): Vercel `RESEND_API_KEY`;
  if Supabase's login emails use the same key, update Supabase → Auth →
  SMTP too. Delete the old key.
- **TeamUp token** (TeamUp → Settings → Integrations → API): Vercel
  `TEAMUP_M2M_TOKEN`. Claude runs one sync stage to check.
- **Kisi key** (steps in `docs/before-go-live.md`): Vercel `KISI_API_KEY`.
- **Supabase access token and database password** (last, because Claude
  uses them): Supabase → Account → Access Tokens (new, then revoke the
  old); Project Settings → Database → Reset password. Put both in the
  cloud environment settings (`SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DEV_DB_PASSWORD`); a new Claude session picks them up.

### 6. Watch the first day

Claude checks failed emails and WhatsApps, the first leads and their ads,
and the sync, and reports anything odd.

## Decisions already made

- The database is `round1-dev` (Ireland): it holds the real data and
  becomes the live one. Rename it in Supabase whenever (cosmetic).
- Resend Pro before the first big mailout (not needed for go-live).
- Reports' managers' numbers: still only 07855284151; add others when
  ready.

## If something goes wrong

GymGrow is off, so there's no going back to it. Emails, the form, the
booking page and the CRM all work without WhatsApp; if the number move
stalls, leads still get the emails and staff can call them. Nothing in
this plan sends anything new to existing members.
