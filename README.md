# Round One CRM

Leads, trials, members, WhatsApp, forms and Meta ads for Round One.

This is currently a **working front-end prototype**. Everything is clickable
and behaves like the real thing, but the data is sample data stored in your
own browser. Nothing is sent anywhere.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

**Staff login.** With a `.env.local` (copy `.env.example` and fill in the
Supabase values), every page except the public forms asks you to log in.
Without it, the prototype runs locally with no login. Staff accounts are
added by Sammy: a row in the `staff` table with their email, plus an
invite.

**Database changes.** Add a new SQL file to `supabase/migrations/`, then run
`npm run db:migrate` with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`
set.

Open http://localhost:3000 (or 3001 if you start it from Claude Code's
preview, which uses `.claude/launch.json`).

## Things to try

1. **Today** shows what needs doing. Jordan is waiting on a WhatsApp reply.
2. **Calendar**: week, day and list views, filtered by coach or type. Click
   an empty slot to book; click an appointment to confirm it, mark it
   attended or no-show, move it or cancel it. Booking a free trial moves the
   person to *Appointment booked* and sends the confirmation WhatsApp. A
   no-show moves them to the *No-show* column; attended moves them to
   *Appointment attended*.
3. Open **Jordan Reid**, reply on WhatsApp, or tap "Simulate a reply".
4. **Pipeline**: drag a card between columns. Dragging to *Appointment
   booked* sends the confirmation WhatsApp automatically. After a trial,
   open the contact to mark them *Sold – Programme*, *Sold – Recurring
   membership* or *Nurture*. Choosing *Lost* asks for a reason.
5. **Forms → Open live form** opens the public trial form in a new tab.
   Fill it in, then switch back: the lead appears on Today and Pipeline,
   and the *New trial lead* automation sends a welcome WhatsApp.
6. The **prototype clock** in the sidebar moves time forward. Press
   **+1 day** and waiting automation steps run (nudges, reminders).
7. **Automations**: pause a flow with its switch and see what's waiting.
8. **Reset** in the sidebar puts the sample data back.

## Working on it together

- Pull before you start: `git pull`
- Work on a branch, push, open a pull request, the other person reviews.
- `CLAUDE.md` holds the shared rules. Claude Code reads it automatically, so
  update it when you agree something new.
- Personal notes for your own Claude go in `CLAUDE.local.md` (not committed).
