# Round 1 CRM

Round 1 Fitness's in-house CRM, built to replace the GymGrow setup.

```
Instagram link ─► /apply questionnaire ─► qualified? ─► /book/<token> calendar ─► booked
                                        └► not a fit ─► saved as "Not Qualified"
```

Staff work in `/admin`:

- **Dashboard**: lead counts, booking rate, show-up rate, conversion, funnel, stage distribution and lead sources.
- **Calendar**: week and list view of consultations. Cancelled and no-show bookings are struck through.
- **Opportunities**: a drag-and-drop pipeline. The stages are Lead → Booked → Confirmed → Attended / Missed → Intro Programme → Recurring / Did not Convert / Won.
- **Contacts**: search, add walk-ins, and a lead page showing questionnaire answers, consultations (confirm, attended, no-show, cancel), notes, WhatsApp messages, scheduled automations and the full activity history.
- **Automation**: the 7 workflows copied from GymGrow, a queue of scheduled messages and an execution log.

## Running it

```bash
npm install
cp .env.example .env        # set ADMIN_PASSWORD at minimum
npm run seed                # optional demo data
npm run dev                 # http://localhost:3000/apply  and  /admin
```

For production, run `npm run build && npm start` on any Node 20+ host (a small VPS, Railway, Render or Fly.io). It needs a persistent disk because the data lives in SQLite at `data/crm.db`; `DATABASE_PATH` changes the location. The server sends due automation messages every minute by itself. If you'd rather drive that from a scheduler, set `DISABLE_TICKER=1` and call `GET /api/cron?key=$CRON_SECRET`.

**Instagram link:** `https://<your-domain>/apply?utm_source=instagram&utm_campaign=<post-name>`. Each lead's source and campaign are saved with the lead.

## Automations (copied from GymGrow)

Workflows are defined in code in `lib/workflows.ts`. When a lead enters a pipeline stage, they're removed from any other active workflow and added to the workflow for that stage. A **WhatsApp** step falls back to **SMS** automatically if WhatsApp can't deliver it (the Undelivered branch in GymGrow). Workflows marked *stops when the contact replies* end as soon as the lead messages back (the Contact reply branch). If a lead replies **YES** while booked, their booking becomes Confirmed.

| # | Workflow | Trigger | Steps |
|---|----------|---------|-------|
| 0 | Questionnaire → CRM | Form submitted | Create/update contact and opportunity, qualify them |
| 1 | New Lead – Booking Push | Stage → Lead | Team notification, email, WhatsApp 1 → 2 days → WhatsApp 2 → 2 days → WhatsApp 3 (ends on reply) |
| 2 | Meeting Booked – Show-up Reminders | Appointment booked | Team notification, email, WhatsApp confirmation → WhatsApp 24h before ("reply YES") → WhatsApp 2h before |
| 3 | No-Show / Cancelled – Rebooking Push | Stage → Missed, or appointment cancelled / no-show | Branches: cancelled → cancelled email + WhatsApp; no-show → no-show email + WhatsApp |
| 4 | Meeting Attended – Follow-up | Stage → Attended | Leaves all other workflows, waits 2h, then WhatsApp |
| 5 | Intro Programme – Encourage Engagement | Stage → Intro Programme | Team notification, email, WhatsApp 1 (WhatsApp 2/3 disabled, as in GymGrow) |
| 6 | Recurring Member – Welcome | Stage → Recurring | Team notification, email, WhatsApp 1 (WhatsApp 2/3 disabled, as in GymGrow) |

Messages set to "wait N days" never go out between 21:00 and 08:00; any that fall in that window are moved to 09:00.

The questionnaire's questions, the answers that disqualify a lead, and the consultation opening hours are all in `lib/config.ts`.

## Going live with messaging

With no API keys set, everything runs in **dry-run** mode. Messages are written to the lead's activity feed rather than sent, so the whole flow can be tested safely.

1. **WhatsApp (Meta Cloud API):** in Meta Business Manager, create a WhatsApp app and get a permanent token and the phone number ID. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
   - Each WhatsApp step names a template (e.g. `r1_new_lead_1`). Submit each one for approval with the text from the Automation page, replacing each `{{name}}` in order with `{{1}}`, `{{2}}` and so on.
   - Point the webhook at `https://<domain>/api/webhooks/whatsapp`, using `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, and subscribe to `messages`. This is what receives replies and delivery failures.
2. **SMS fallback (Twilio):** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`.
3. **Email (Resend):** set `RESEND_API_KEY` and `EMAIL_FROM`. `STAFF_EMAIL` receives the team notifications.

## Code map

- `lib/config.ts`: gym details, questionnaire, qualification rules, availability
- `lib/stages.ts`: pipeline stages
- `lib/pipeline.ts`: stage changes, booking, appointment status and inbound replies
- `lib/workflows.ts`: automation definitions and the sending engine
- `lib/whatsapp.ts`, `lib/sms.ts`, `lib/email.ts`: provider clients
- `app/apply`, `app/book/[token]`: public questionnaire and booking pages
- `app/admin/*`: the staff CRM
