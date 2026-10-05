# Round One Accountability Automation — Project Handover

Context file for continuing this project in Claude Code. Everything below was designed and partially built in a Claude chat session (Oct 2026). Treat this as the source of truth for decisions already made — don't re-litigate them, build on them.

## 1. What this is

An opt-in member accountability system for **Round One** (boxing/fitness gym, Kings Business Park, Bristol, ~300 members, run on TeamUp). Members commit to a weekly training floor + stretch target; the system compares commitments against *actual* attendance, sends check-ins and nudges in the member's chosen tone and frequency, and escalates to coaches when needed.

Owner: Sammy Ait-Tales (co-director). Technical level: strong (controls engineer), but this phase is deliberately no-code.

**Phase 1 stack (prove the logic cheap, app comes later):**
- **TeamUp** — source of truth: membership status, class attendance
- **Kisi** — door access events (actual gym entries, incl. unbooked sessions). Kisi↔TeamUp native integration is ALREADY LIVE: door access auto-revokes on membership lapse
- **Make.com** (EU region, eu1) — orchestration. Free plan now, Core (~£8/mo, 10k ops) at go-live
- **Tally** — forms (chosen over Typeform: free unlimited responses, webhooks + hidden fields on free tier)
- **Anthropic API** — Claude classifies check-in responses and drafts messages ($5 credit loaded)
- **Email first**; SMS maybe later; WhatsApp is phase 2 (see §7)
- **Google Sheets** — roster/config storage for now (may swap to Airtable; design is storage-agnostic)

## 2. Standing rules (non-negotiable design decisions)

1. **Active membership gate**: every scenario checks TeamUp membership status at SEND time (after any delay), not trigger time. Lapsed = machine goes silent. No exceptions in this system.
2. **Win-back is a separate future workflow** — deliberately excluded from this build. Will need marketing-consent checks (TeamUp stores opt-ins).
3. **Opt-in only** — members join the accountability programme deliberately via the commitment form.
4. **Config as data, never hard-coded**: check-in slots, per-member slot assignment, nudge frequency all live in editable lists/roster (Sheet now, app DB later). Scenarios are generic: wake → "who's due now?" → act. Adding a slot = edit a list (+ mirror the option on the Tally form until the app replaces forms).
5. **Messages adapt to the member**: their chosen accountability style (straight talk / encouragement / facts only), their chosen nudge frequency, and their own "why this matters" words quoted back when motivation dips.
6. **Silence when on pace** — mid-week nudges only fire when there's a gap between commitment and reality (unless member chose a regular pulse/daily updates).
7. **Attendance truth = TeamUp class data + Kisi door events combined** (Kisi catches open-gym sessions TeamUp never sees). Phase 1 can run on TeamUp alone; wire Kisi in once the loop works.

## 3. Accounts & credentials (values NOT in this file — keep in password manager / .env, never in a repo)

| Item | Status | Notes |
|---|---|---|
| TeamUp app "Round One Accountability" | Created | Read-only scope. OAuth Client ID + Secret saved |
| TeamUp M2M token | Created | Full access (within read-only app). **Expires 3 Aug 2027** — calendar reminder set for 15 Jul 2027. Viewable again via eye icon on TeamUp Integrations page |
| TeamUp Webhook Destinations | Available, not configured | TeamUp can PUSH events — configure once Make provides a webhook URL. No Zapier needed |
| Make account | Live | EU servers (eu1.make.com — good for UK GDPR). Free plan, 1,000 credits/mo |
| Tally account | Live | Free plan |
| Anthropic API key | Created | $5 credit, $500/mo default cap. Key created (prefix removed from this copy) |
| Kisi API key | **TODO** | Generate from Kisi ORGANIZATION OWNER account (not admin — survives staff changes) |

⚠️ Security note: the TeamUp M2M token, OAuth secret, and Anthropic API key were pasted/screenshotted in the original chat. Acceptable risk for now, but if anything misbehaves, rotate them — all regenerable in minutes. In Claude Code: secrets go in `.env`, `.env` goes in `.gitignore`.

## 4. Tally forms

### Form 1 — "Round One Accountability — Your Commitment" (BUILT, PUBLISHED, 1 test submission in)
Cover page: title + intro ("This is opt-in accountability. You set the commitment, we hold you to it — your way…"). Button: Start. Page break per question.

1. **Floor** (MC, req): "What's your minimum — the number of sessions you'll hit even on your worst week?" Once / Twice / Three times per week (+ Sammy added "At least four times per week" — Claude's recommendation was to cap floor at 3; flagged, Sammy's call). Description: "This is your floor, not your goal…"
2. **Stretch** (MC, req): "And on a good week — what would make you genuinely proud?" Twice / Three / Four times per week / Five+ ("Four time" typo was flagged for fixing)
3. **Goal** (MC, req, multi-select max 2, "Other" toggle on): Lose weight / Get fit / Learn to box / Build confidence / Mental health / Other
4. **Why** (Long answer, req): "Why does this matter to you right now?" — quoted back in future messages
5. **Derailers** (MC, req, Other option added): Shifts / Motivation dips / Nerves / Family / Injury worries / Other
6. **Style** (MC, req): "When a week goes badly, how do you want us to play it?" Straight talk — call me out / Encouragement / Just the facts
7. **TODO — Nudge frequency** (MC, req) — designed, NOT yet added to form: "During the week, how much do you want us on you?" Only if I'm slipping / A regular mid-week pulse / Keep me posted (daily) / Just the weekly check-in
8. **Slot** (MC, req): Sunday 6pm / Monday 8am / Wednesday 7pm / Friday 5pm
9. **Coach notes** (Long answer, optional)

Hidden fields: `member_id`, `first_name`, `email`. Thank-you: "Locked in…"

Known quirk: Tally can't enforce stretch ≥ floor — Claude flags daft combos at processing time.

**TODO**: add Q-nudge-frequency, fix "Four time" typo, one fresh test submission covering every question (incl. 2 goals ticked — multi-select arrives as a list in the payload).

### Form 2 — "Round One — Weekly Check-in" (SPECCED, NOT BUILT)
Intro: "30 seconds. Straight answers beat nice ones."
1. (MC, req) "How did this week actually feel?" Strong / Solid / Scrappy — but I showed up / Struggled / Write-off
2. (Long, opt) "If it wasn't the plan — what got in the way?"
3. (MC, req) "Next week — what's the play?" On track / Lower the target for a bit / Raise it — too easy / I want a word with a coach

Hidden fields: `member_id`, `first_name`, `email`, `week_number`. Thank-you: "Noted. We'll factor it in…"

Identity model: hidden fields filled via personalised URLs built by Make (`?member_id=…&week_number=…`). Identification, not authentication — fine for this data; the future app does real TeamUp-verified logins.

## 5. Make scenarios to build (in order)

**Scenario A — Weekly check-in sender** (one generic scenario, scheduled at each slot time):
wake at slot → read roster (Sheet) for members on this slot → filter: TeamUp membership active → pull week's attendance (TeamUp; later + Kisi) → compose email: attendance-vs-commitment line in their style + personalised Form 2 link → send → log row to Sheet.

**Scenario B — Check-in response processor** (webhook-triggered by Tally submission):
Tally webhook → parse → Claude API call: classify against their commitment, attendance, style, and raw answers → output strict JSON (e.g. `{status, sentiment, flag_coach, suggested_reply, adjust_plan}`) → router: streak praise / chosen-style nudge / coach escalation (esp. "I want a word" or stretch<floor nonsense) → send reply → log.

**Scenario C — Commitment form intake** (webhook on Form 1): validate, write member row to roster with slot + style + frequency + floor/stretch + their "why", send confirmation.

**Scenario D — Mid-week nudge** (Thursday-ish): for each active programme member, check frequency preference + pace vs floor → nudge only where preference and gap warrant → straight-talk/encouragement/facts variants, quote their own "why".

**Silence signal**: no check-in response + no attendance two weeks running = highest-priority churn flag → coach.

Also: log EVERY trigger/response/classification/message to a Sheet from day one — that dataset drives tuning and becomes the app spec.

TeamUp connection: community GoTeamUp Make app with M2M token first; fall back to HTTP modules against the Business API (docs: TeamUp Business API). The "Teamup" VERIFIED Make app is the calendar product — wrong company, avoid. TeamUp webhook destinations can push events to a Make webhook URL (preferred over polling where available).

## 6. Email sending

Send from the gym's own domain mailbox (deliverability + trust), not personal Gmail. Open question: what the gym email runs on (Google Workspace / M365 / domain host SMTP) and which domain is canonical (roundonefitness.co.uk vs round1boxfit.co.uk — use whichever is the decided brand).

## 7. WhatsApp (phase 2 — do not touch yet)

- Round One already runs WhatsApp Business via **GymGrow** (gymgrow.ai — agency: ads/funnels/lead-gen automations). Sammy OWNS the number and Meta business assets; GymGrow is just a connected platform.
- Number is on the WhatsApp Business API → likely a Meta WABA Sammy owns → Make can probably connect to the SAME number natively (Meta allows multiple platforms per WABA). Verify at business.facebook.com → Business Settings → WhatsApp Accounts. **Do not remove/modify anything there — GymGrow's live automations depend on it.**
- No second number unless unavoidable (two "Round One" identities confuses members). If forced, brand it distinctly ("Round One Coaching").
- Boundary check needed with GymGrow: do they message existing members or only leads? Avoid double-messaging.
- Phase 1 is email regardless; WhatsApp only after flows are proven.

## 8. Costings already agreed

- Make Core ~£8–10/mo (10k ops) vs Zapier ~£70–100+/mo at this volume (~3–5k ops/mo realistic) → Make chosen; ~£1k/yr saved
- Tally £0 vs Typeform ~£45/mo (Plus needed at this response volume) → Tally chosen; polish gap accepted, revisit only if the brand demands it
- Claude API: pennies (~£2–5/mo); SMS if added ~4p/msg (Twilio); email free

## 9. GDPR notes

- Make account on EU servers; TeamUp is the single source of truth for consent/status
- Door-log use is proportionate for coaching follow-ups — disclose in programme sign-up text ("we use your attendance data to keep the coaching honest")
- Service messages to active opted-in members ≠ marketing; win-back to lapsed members IS marketing → separate workflow with consent checks

## 10. Immediate next actions

1. Fix Form 1: typo, add nudge-frequency question, fresh full test submission
2. Build Form 2 in Tally
3. Make: connect TeamUp (M2M token), build Scenario A against a test roster Sheet
4. Tally webhook → Scenario B with Claude classification prompt (strict-JSON output)
5. TeamUp Webhook Destination → point at Make for push triggers
6. Generate Kisi API key (owner account) — wire in after core loop works
7. Resolve email sending domain/mailbox
8. Longer term: the accountability app replaces forms + Sheet, TeamUp-verified logins, same data model

---

## Imported into the CRM repo (05/10/2026)

This is Sammy's handover from a separate Claude chat, kept as written. The
CRM already has much of the Phase 1 stack in-house (forms, scheduler, email,
WhatsApp, TeamUp sync, an Anthropic plan), so **where to build the
accountability programme is Sammy's call**: see `docs/accountability.md`
once that decision is made. Nothing from this file is built yet.
