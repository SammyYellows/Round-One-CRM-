// The staff manual (Sammy, 10/10/2026): "I want Champ to be the expert on
// it and I want a manual as well." One source for both: the /manual pages
// render these sections, and Champ reads all of them before answering.
// Keep it true to the screens; when a screen changes, change its section.
// Format: paragraphs, "- " bullets, "### " subheadings, **bold**.

export interface ManualSection { slug: string; title: string; who: "everyone" | "management"; summary: string; body: string }

export const MANUAL: ManualSection[] = [
  {
    slug: "getting-started", title: "Getting started", who: "everyone",
    summary: "Logging in, finding your way round, and getting help.",
    body: `The CRM is where Round One looks after enquiries, intro meetings and members. Memberships, bookings, payments and waivers are still done in **TeamUp**; the CRM reads from TeamUp every night and shows it alongside everything else.

### Logging in
- Go to the CRM's web address and log in with your email and password. The email is remembered on that device.
- Tap **Show** in the password box to check what you've typed.
- Forgotten it? Tap **Forgotten your password?**, enter your email, and use the link in the email from bookings@round1boxfit.co.uk. Passwords need 8 characters or more, and can't be the one you already have.
- New staff get an invite email from bookings@ to choose a password.

### Finding your way round
- The menu down the left lists the screens. On a phone it's behind the **Menu** button at the top.
- **Back** at the top of each screen goes to where you were.
- A red number on the menu means something new since you last looked (enquiries waiting, notices to cancel, failed payments).
- **Manual** (this) is at the bottom of the menu.

### What you can see
- **Staff** logins see the day-to-day screens: Today, Champ, Calendar, both pipelines, Contacts, Enquiries, Members, Program members, Cancellations, Accountability and Failed payments.
- **Owner** and **Manager** logins also see Mailouts, Automations, Reports, Forms, Meta ads, Staff and Teach Champ, and can change messages and settings.

### Getting help
Ask **Champ** (second in the menu). It knows this manual, can look up any member, class or lead for you, and can help with training and sales ideas.`,
  },
  {
    slug: "daily-routine", title: "Your daily routine", who: "everyone",
    summary: "What to check at the start of a shift, during it, and before you go.",
    body: `### Start of shift
- **Today**: look at **Needs you** (tasks such as "hasn't been in for 3 weeks" or "check-in to reply to") and **Upcoming trials**.
- **Red waiver alert** at the top of the screen: someone is in the gym without a waiver or emergency contact. Have a word, sort it in TeamUp, then tap **Spoke to them**.
- **Enquiries**: emails sent to info@ with a drafted reply waiting. Check, edit and send, or mark **No reply needed**.
- **WhatsApp replies**: contacts with a **Reply** chip on Members, or new messages on a contact's page.

### During the shift
- Book, move and mark intro meetings in the **Calendar** (attended, no-show, cancelled). Each of these sends the person a message automatically, so keep it accurate.
- Use **Champ** to find anyone or anything instead of searching TeamUp.

### Before you go
- Tick off tasks you've done in **Needs you** on Today.
- Anyone you've spoken to in person about something important: add a note on their contact page.`,
  },
  {
    slug: "today", title: "Today", who: "everyone",
    summary: "The home screen: what needs you, trials coming up, and how leads are doing.",
    body: `- **Needs you**: tasks for staff. Tick **Done** when finished. Tasks are made by the CRM (a member hasn't been in, a check-in needs a reply, a cancellation) or by staff.
- **Upcoming trials** and **Trials this week**: intro meetings booked.
- The tiles and charts (leads in the last 7 days, trials, show-up rate, where leads come from, which ads book trials) show how the sales side is going.
- **Open trial form** opens the public questionnaire; **Book a trial** opens the calendar to book someone in.`,
  },
  {
    slug: "safety", title: "Waivers and who's in the gym", who: "everyone",
    summary: "The red waiver alert, the Safety page, and emergency contacts.",
    body: `Every member should have a signed waiver and an emergency contact in TeamUp. The CRM checks who's in the gym and warns you about anyone missing either.

- **The red alert** at the top of every screen names people who are in now (ticked into a class that's on, or through the front door in the last 1.5 hours) without a waiver or emergency contact. It checks every few minutes.
- Talk to them, get it done in TeamUp (their profile, forms and waivers), then tap **Spoke to them**. They drop off the alert for the rest of the day. If TeamUp still has no waiver next time they come in, they'll show again.
- **List everyone** on the alert opens the **Safety** page: who's in now, and every active member with something missing.
- A member's **Safety** card on their contact page shows their waiver date and emergency contact, with a number you can tap to call.
- **In an emergency, call 999 first.** Then find their emergency contact on their contact page, or ask Champ.
- Waivers and emergency contacts update from TeamUp overnight.`,
  },
  {
    slug: "champ", title: "Champ", who: "everyone",
    summary: "Round One's assistant: what to ask, and the rules it follows.",
    body: `Champ looks things up for you so you don't have to search, and helps with training and sales.

### Things to ask
- "When was Sarah Jones last in?" "Has Tom signed his waiver?" "Does Romel owe anything?"
- "Who's booked on tonight's 6pm Boxfit?" "What's on tomorrow and how full is it?" "Who's in the gym now?"
- "Who hasn't been in for three weeks?" "Who gave notice this month?"
- "Give me a 30-minute HIIT circuit for 16 people with bags and kettlebells." "Three partner pad drills for beginners."
- "How do I handle 'it's too expensive' in an intro meeting?"
- "How do I book a trial in the CRM?"

### What Champ won't do
- Change anything. It can't book, cancel, edit, message or take payments; it tells you where to do it.
- Talk about anything outside gym training, gym sales and the CRM.
- Give gym-wide money figures (revenue, totals owed). It will tell you about a named member's payments.
- Answer racist, discriminatory or misogynistic questions. The first time it warns you; after that a manager is told.

### Chats
- **New chat** starts fresh; your chats are saved on the left. Managers can read everyone's chats.
- Champ's answers are only as good as the data: if something looks wrong, check TeamUp.`,
  },
  {
    slug: "pipeline", title: "Meta pipeline (leads)", who: "everyone",
    summary: "Enquiries from ads, the form, walk-ins and referrals, by stage.",
    body: `Everyone who enquires through the questionnaire, an ad, a walk-in, a referral, WhatsApp or email. Drag a card to another column to change their stage, or change it on their contact page.

### The stages
- **New lead**: just enquired.
- **Contacted**: someone has been in touch.
- **Appointment booked**: intro meeting booked (set by the calendar).
- **No-show** / **Appointment attended**: set when you mark the meeting in the calendar.
- **Nurture**: came in or was interested but hasn't bought yet.
- **Sold – Programme**: bought the 28 Day Program (£79). Then set them up in TeamUp.
- **Sold – Recurring membership**: joined on a membership. Then set them up in TeamUp.
- **Lost**: only when they've clearly said no. It always needs a reason.

### Messages that go automatically
Some stage changes send the person a message, so only move people when it's true:
- A new questionnaire lead gets a "next steps" email and up to three WhatsApps two days apart (they stop if they reply).
- **Appointment booked** sends a confirmation, then reminders a day before and two hours before.
- **No-show** and **cancelled** send a rebooking message; **attended** sends a follow-up four hours later.
- **Sold – Programme** and **Sold – Recurring** send a welcome.

Use the search and filters at the top to find people.`,
  },
  {
    slug: "calendar", title: "Calendar and intro meetings", who: "everyone",
    summary: "Booking, moving and marking intro meetings (trials).",
    body: `The calendar holds intro meetings only. Classes stay in TeamUp.

- **Book a trial**: pick the person and time. They move to Appointment booked and get a confirmation and reminders.
- People can also book themselves from the link in their WhatsApp or at the end of the questionnaire; their booking appears here.
- Click a booking to see their questionnaire answers above the calendar, open their contact, **Move** it to a new time (they're told the new time), or mark it:
  - **Attended**: moves them to Appointment attended and sends a follow-up later.
  - **No-show**: moves them to No-show and sends a rebooking message.
  - **Cancelled**: sends a rebooking message and moves them back to Contacted.
- **Booking hours** (management only) sets when people can book themselves.`,
  },
  {
    slug: "contacts", title: "Contacts and the contact page", who: "everyone",
    summary: "Everyone in one list, and everything about one person.",
    body: `**Contacts** lists everyone: leads, members, ex-members. Search by name, mobile or email. **Save contact** adds someone by hand (for example a walk-in).

### A contact's page
- **WhatsApp**: the conversation. You can write freely only within 24 hours of their last message; after that WhatsApp only allows approved template messages, and the screen says so.
- **Quick replies**: one-tap lines you can drop into a message (**Add a line** to create your own).
- **In their words**: a short summary of what they've told us in WhatsApp, with a suggested reply. **Use it** puts it in the message box for you to edit and send; nothing is sent until you press **Send**. **No reply needed** clears it.
- **Questionnaire**: their answers from the form.
- **Stage** and buttons such as **Sold programme**, **Sold membership** and **Move to nurture** (these send messages, see Meta pipeline).
- For members: their **membership** (from TeamUp), **Coach**, **Last in** and sessions in the last 30 days, a **priority** if they've lapsed with a suggested action, and their **Safety** card.
- **No marketing messages**: tick if they don't want offers (they can also reply STOP). Messages about their own booking or membership still go.`,
  },
  {
    slug: "enquiries", title: "Enquiries (emails to info@)", who: "everyone",
    summary: "Replying to emails with a drafted reply you check first.",
    body: `Every email to info@round1boxfit.co.uk that looks like an enquiry appears here with a reply already drafted, using only the gym facts sheet.

- Read the email on the left and the draft on the right. Edit it freely, or type an instruction (for example "shorter, and mention the Saturday class") and the draft is rewritten.
- **Send reply** and then confirm. It goes from info@ and threads with their email. **Nothing sends until you confirm.**
- **No reply needed** for anything that doesn't need an answer; **Reopen** brings it back.
- The sender becomes a contact automatically.
- **Gym facts** (management only) is the sheet drafts are allowed to use: prices, hours, classes.`,
  },
  {
    slug: "members", title: "Members", who: "everyone",
    summary: "Everyone with a TeamUp membership, who's lapsed, and who's in now.",
    body: `Synced from TeamUp every night. Change memberships in TeamUp, not here.

- **In the gym now**: who's ticked into a class that's on or came through the door recently, with waivers and emergency contacts.
- Filter by category, status (active, on hold, ended, never joined), ending soon, opted out of marketing, **Lapsed** and **No waiver**.
- **Last in** comes from class check-ins in TeamUp and the front door (Kisi). Red means past the "not been in" limit.

### Members who haven't been in
- **Lapsed** sorts them by **priority**: High (new members, regulars who've stopped, accountability members), Medium, Low.
- The member's coach (or the front desk) gets a task and an email when someone passes the limit.
- **The CRM never messages lapsed members automatically.** Contact is a person's decision. A friendly personal message or a chat when they're next in works best. Don't mention their direct debit or price, and don't offer discounts.`,
  },
  {
    slug: "teamup-and-program", title: "TeamUp pipeline and Program members", who: "everyone",
    summary: "People who came through TeamUp, and the 28 Day Program.",
    body: `- **TeamUp pipeline**: everyone synced from TeamUp (members, ex-members and people who made an account but never joined), by when they came in.
- **Program members**: everyone on the 28 Day Program, where they are in it, split into those who came through the CRM and those who signed up straight in TeamUp. It also holds the Program messages (most are switched off until management approves them).
- The 28 Day Program is £79 upfront; if they finish and move onto a recurring membership, the £79 comes off, so their first 28 days end up free.`,
  },
  {
    slug: "payments-and-cancellations", title: "Failed payments and cancellations", who: "everyone",
    summary: "Members whose payments keep failing, and members who've given notice.",
    body: `### Failed payments
- Members flagged after three failed payment attempts in TeamUp, with what they owe. Open a person to see each missed payment.
- The flag clears when a payment goes through in TeamUp.
- Payment issues are sorted in TeamUp. A friendly word in person often works best.
- The "failed-payment email" card at the top is off until management approve it there.

### Cancellations
- Everyone who has given notice in TeamUp, when their membership runs out, and whether the "before you go" email has gone.
- Replies to that email arrive in Enquiries.

The message cards on these screens show exactly what's sent and to whom. Only management can change or switch them on.`,
  },
  {
    slug: "accountability", title: "Accountability programme", who: "everyone",
    summary: "Members who've signed up for weekly accountability.",
    body: `An opt-in programme: a member sets a weekly target and gets a check-in each week.

- **Invite a member**: copy their personal link (also on their contact page) and send it to them. They fill in their commitment.
- **On the programme**: who's on it, their target and this week's sessions.
- **Check-ins to reply to**: their answers with a suggested reply. Edit it, **Send reply** and confirm, or **No reply needed**. Nothing goes without you.
- **End** takes someone off the programme.`,
  },
  {
    slug: "what-gets-sent", title: "What gets sent automatically", who: "everyone",
    summary: "The messages the CRM sends by itself, and the ones it never does.",
    body: `### Sent automatically
- To new questionnaire leads: a next-steps email and up to three WhatsApps.
- For intro meetings: confirmation, reminders, and messages after attended, no-show, cancelled or moved.
- Welcomes when staff mark Sold – Programme or Sold – Recurring.
- A "before you go" email (and WhatsApp) the day after a member gives notice in TeamUp.

### Never sent without a person pressing Send
- Replies to enquiries, accountability check-in replies, suggested WhatsApp replies, mailouts (which also need the number of people confirmed).

### Never sent to members at all
- Anything about not coming in: those alerts go to staff only.

Anyone can reply STOP to stop marketing messages; messages about their own booking or membership still go.`,
  },
  {
    slug: "management", title: "Management screens", who: "management",
    summary: "Staff logins, messages, mailouts, reports, forms and settings.",
    body: `Owner and Manager logins only.

- **Staff**: add a login (name, email, role) and they get an invite email; **Resend** if they lost it; **Remove** stops their login at once (**Bring back** restores it). Roles: Staff (day-to-day screens) or Owner/Manager (everything).
- **Teach Champ** (button on Champ): notes and documents (PDF, Word, text) Champ reads before every answer, such as equipment, class formats, sales scripts. Switch entries on or off, edit or remove them.
- **Everyone's** on Champ: read all staff chats. Conduct flags are emailed to management.
- **Automations**: every automatic message, grouped by job. Read what's sent, edit the wording, and switch messages on or off (with a confirm).
- **Mailouts**: one email to many people (members, ex-members, old leads). Sends only after **Send** and confirming the count. Every email has an unsubscribe link.
- **Reports**: weekly members, monthly growth, unpaid memberships and attendance, as PDFs; schedules to managers' WhatsApp are off until switched on in Settings.
- **Forms**: the questionnaire's questions and end screen.
- **Meta ads**: spend and results per ad.
- **Settings in other screens**: Booking hours (Calendar), the "not been in" limit (Members), Gym facts (Enquiries).`,
  },
];

/** The whole manual as plain text, for Champ. */
export const manualText = () => MANUAL.map((m) => `## ${m.title}${m.who === "management" ? " (management only)" : ""}\n\n${m.body}`).join("\n\n");
