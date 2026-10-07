// Round One's lead journey, copied from the GymGrow workflows and WhatsApp
// templates (screenshots from Sammy, 27/09/2026), signed "The Round One team".
// The local prototype starts from this, and the migration
// supabase/migrations/20260927010000_gymgrow_playbook.sql put the same into
// the database. After that the database is the one to change.
//
// Placeholders: {first} {name} {date} {time} {address} {gym} (see
// placeholders() in engine.ts), and {bookLink} in emails, which the server
// fills with the contact's booking page.

import type { Automation, Availability, Form } from "./types";

export interface TemplateDef {
  name: string; // the name registered with Meta
  category: "utility" | "marketing";
  body: string;
  headerVideo?: string; // file in the whatsapp-media storage bucket
  button?: { text: string; path: string }; // a link button; {{1}} is the contact's id
}

const BOOK = { text: "Book meeting", path: "/book/{{1}}" };

export const TEMPLATES: TemplateDef[] = [
  {
    name: "leads_1", category: "marketing", headerVideo: "leads_video.mp4", button: BOOK,
    body: "Hi {first}, it’s the Round One team. Thanks for your interest in joining us! ✅\n\nThe next step is to book your intro session so we can chat about your goals, show you around, and get you set up.\n\nYou can grab a time that suits you by clicking the button below.\n\nSpeak soon 🙌",
  },
  {
    name: "leads_2", category: "marketing", button: BOOK,
    body: "Hi {first},\n\nJust checking in - we haven’t seen your meeting booked yet and spaces are filling up fast.\n\nIf you’re still looking to get started, you can choose a time by clicking the button below 🗓️\n\nLet me know if you have any questions!",
  },
  {
    name: "leads_3", category: "marketing", button: BOOK,
    body: "Hi {first},\n\nLast chance - we can’t hold your place on the programme without booking a quick meet to get you set up.\n\nIf you’d like to move forward, grab a time now by clicking the button below.",
  },
  {
    name: "discovery_1", category: "utility", headerVideo: "booked_video.mp4",
    body: "Hi {first},\n\nThanks for booking your meeting with us for {date} at {time}.\n\nThis is an in person meeting at our HQ 📍 {address}\n\nThe purpose of the meeting is to find out more about you and your goals, show you around, and run through the program and how everything works! 🙌\n\nLet me know all is good and I’ll confirm your meeting\n\nThe Round One team 😝",
  },
  {
    name: "discovery_2", category: "utility",
    body: "Hi {first},\n\nJust a quick courtesy reminder for our in person meeting tomorrow at {time}. We are really looking forward to meeting you :)\n\nPlease reply to this text to confirm you’ll 100% be attending, or to reschedule.\n\nIf you are attending. Before you come in, I just wanted to get a better understanding of what you’re hoping to get out of training — whether that’s fitness goals, confidence, strength, weight loss, stress relief, learning a skill, or anything personal that’s motivating you. If you could reply anything at all to this chat please.\n\nThe more we know beforehand, the better we can tailor the session and help the coaches understand what’s important to you from day one 👍\n\nLooking forward to meeting you!\n\nThe Round One team ⭐",
  },
  {
    name: "discovery_3", category: "utility",
    body: "Hi {first},\n\nLooking forward to meeting you in a couple of hours\n\nSee you in person at our HQ 📍 {address}\n\nThe Round One team 😄",
  },
  {
    name: "no_showed_1", category: "marketing", button: BOOK,
    body: "Hey {first} - we had you booked in for a session recently but looks like we missed you.\n\nThese sessions are important as we map out your plan properly, so let’s get you rebooked while it’s still fresh.\n\nGive me a shout if anything came up\n\nThe Round One team 👍",
  },
  {
    name: "cancelled_1", category: "marketing", button: BOOK,
    body: "Hey {first} - noticed you cancelled your slot.\n\nWe’ve only got limited spaces left at the moment, so I’d get another time booked in ASAP if you’re still interested!\n\nLet me know if you need help\n\nThe Round One team 👍",
  },
  {
    name: "discovery_4", category: "marketing",
    body: "Hi {first},\n\nGreat having you in for your intro appointment, hope you enjoyed meeting the team and seeing the space!\n\nOur 28 Day Program is the perfect next step to build consistency and experience the coaching and community properly. You can grab a spot here:\n\nhttps://goteamup.com/p/10418134-round-one/memberships/274852/\n\nIf you’d prefer to jump straight into a full membership, just let me know and I’ll walk you through the best options for your goals and schedule.\n\nAny questions, just reply here 👊",
  },
  {
    name: "intro_programme_1", category: "marketing",
    body: "Hey {first},\n\nWe’re so excited to have you starting your programme with us! ⭐\n\nYour first session is the beginning of something great - we can’t wait to see what you achieve.\n\nAny questions before your first session, just reply here and we’ll help you out.\n\nThe Round One team 😄",
  },
  {
    name: "intro_programme_2", category: "marketing",
    body: "Hi {first},\n\nJust checking in after your first week - how are your sessions going? 🙌\n\nWanted to make sure you’re getting the most out of the programme!\n\nAnything at all - questions, feedback, anything - just reply here.\n\nThe Round One team :)",
  },
  // Program schedule (06/10/2026): service messages, one per email in the sequence.
  {
    name: "program_day_3", category: "utility",
    body: "Hi {first}, three days into the Program. The one thing that decides how it goes: book this week’s sessions in the TeamUp app now, on the days you know you can make. Anything unclear, just reply here.\n\n{team}",
  },
  {
    name: "program_day_7", category: "utility",
    body: "Hi {first}, that’s week one done. Quick one: what was the hardest bit, fitting it in or the sessions themselves? Reply with a line, the coaches read these. Week two: book the sessions first.\n\n{team}",
  },
  {
    name: "program_day_10", category: "utility",
    body: "Hi {first}, day 10 is where the newness wears off and the excuses get louder. Everyone hits it. Just book the next session, not the next 18 days. Want a word with a coach? Reply here.\n\n{team}",
  },
  {
    name: "program_day_14", category: "utility",
    body: "Hi {first}, you’re halfway through the 28 Day Program. How many sessions have you managed so far, and is anything getting in the way? Reply here and a coach will come back to you.\n\n{team}",
  },
  {
    name: "program_day_17", category: "utility",
    body: "Hi {first}, you’re into the second half. Keep the booking habit, and ask the coaches for one thing to work on in your technique. Eleven days left, make them count.\n\n{team}",
  },
  {
    name: "program_day_21", category: "utility",
    body: "Hi {first}, your 28 Day Program finishes in a week. If you’d like to carry on with no gap, reply here or ask at the desk and we’ll set up the membership that suits you. No joining fee.\n\n{team}",
  },
  {
    name: "program_day_24", category: "utility",
    body: "Hi {first}, four days left. Book your last sessions now so they happen. If you want to keep training with us, reply here and we’ll sort what comes next before your last day.\n\n{team}",
  },
  {
    name: "program_day_28", category: "utility",
    body: "Hi {first}, 28 days, done. Well done for seeing it through. Reply with the one thing that was best and the one thing we could do better. And if you’re staying, see you next week.\n\n{team}",
  },
  {
    name: "recurring_member", category: "marketing",
    body: "Hi {first},\n\nWelcome to the Round One community! ⭐\n\nI couldn’t be happier to have you with us.\n\nIf there’s ever anything you need, just reach out - always happy to help.\n\nThe Round One team 🙌",
  },
  {
    name: "did_not_convert_intro_to_recurring", category: "marketing", button: { text: "Book a catch up", path: "/book/{{1}}" },
    body: "Hey {first},\n\nIt was great having you with us on the programme\n\nIf you’d like to chat about your goals, how we can keep supporting you or any feedback, we’d love to book a quick catch-up session.\n\nNo pressure - we’re here whenever you’re ready.\n\nThe Round One team 😄",
  },
];

// First draft by Claude (06/10/2026) for Sammy to edit. Facts used: Facility
// access only and Classes only memberships exist; TeamUp allows holds.
// Program member messages: first drafts by Claude (06/10/2026) for Sammy to
// edit and approve on the Program members screen. Service messages, not
// marketing (Sammy, 05/10). Facts used: the 28 Day Program is four weeks;
// recurring memberships exist (Premium, Classes Only, Facility Access Only).
const PROGRAM_CHECK_IN_EMAIL = {
  subject: "Two weeks in, {first}: how’s it going?",
  body: [
    "Hi {first},",
    "",
    "You’re halfway through the 28 Day Program. This is usually the point where it starts to feel normal, or where life gets in the way.",
    "",
    "Either way, a quick check-in: how many sessions have you managed so far, and is anything getting in the way? Reply to this email and one of the coaches will come back to you.",
    "",
    "The second half is where the results show. See you in the gym.",
    "",
    "{team}",
  ].join("\n"),
};
const PROGRAM_ENDING_EMAIL = {
  subject: "Your 28 days are nearly up, {first}",
  body: [
    "Hi {first},",
    "",
    "Your 28 Day Program finishes in a week. Thank you for putting the work in.",
    "",
    "If you’d like to carry on, you can move straight onto a recurring membership so there’s no gap: Premium for full access plus classes, Classes Only, or Facility Access Only if you’d rather train on your own. And because you finished the Program, the £79 you paid for it comes back off your membership, so your first 28 days end up free. No joining fee, and you can cancel any time with 30 days’ notice.",
    "",
    "Reply to this email or ask at the desk and we’ll set it up before your last session.",
    "",
    "{team}",
  ].join("\n"),
};

// The rest of the Program schedule, two a week (Sammy, 06/10/2026). All off
// until approved on the Program members screen. Days 1 (welcome), 14
// (check-in) and 21 (move to recurring) are the automations above and below.
const PROGRAM_DAY_3_EMAIL = {
  subject: "Day 3, {first}: get your sessions in the diary",
  body: "Hi {first},\n\nThree days in. The single biggest thing that decides how the 28 days go is whether your sessions are booked before the week starts, not decided on the day.\n\nOpen the TeamUp app now and book this week’s sessions. Pick the days you know you can make, not the days you hope you can.\n\nIf anything about booking isn’t clear, reply to this email and we’ll sort it.\n\n{team}",
};
const PROGRAM_DAY_7_EMAIL = {
  subject: "One week done, {first}",
  body: "Hi {first},\n\nThat’s week one. However it went, you turned up, and that’s the part most people never get past.\n\nQuick question for you: what was the hardest bit? Fitting it in, the sessions themselves, or something else? Reply with a line or two. The coaches read these and it helps us help you.\n\nWeek two starts now. Same plan: book the sessions first.\n\n{team}",
};
const PROGRAM_DAY_10_EMAIL = {
  subject: "Day 10, {first}: this is the dip",
  body: "Hi {first},\n\nAround day 10 is when the newness wears off and the excuses get louder. Everyone hits it. It isn’t a sign anything’s wrong.\n\nThe way through is small: the next session, not the next 18 days. If you’ve missed one, don’t make it up, just book the next one.\n\nIf you want a word with a coach about anything, reply here or grab us at the desk.\n\n{team}",
};
const PROGRAM_DAY_17_EMAIL = {
  subject: "Day 17, {first}: the second half",
  body: "Hi {first},\n\nYou’re into the second half. If you’ve kept the sessions going, you’ll probably notice things feel a bit easier than they did on day one. That’s the point.\n\nTwo things for the rest of the Program: keep the booking habit, and ask the coaches for one thing to work on. A single cue in your technique goes a long way.\n\nEleven days left. Make them count.\n\n{team}",
};
const PROGRAM_DAY_24_EMAIL = {
  subject: "Day 24, {first}: finish strong",
  body: "Hi {first},\n\nFour days left on the Program. Book your last sessions now so they actually happen.\n\nHave a think about what comes next too. If you want to keep training with us, reply to this email or ask at the desk and we’ll set up whichever membership suits you, with no gap after your last day.\n\nNearly there.\n\n{team}",
};
const PROGRAM_DAY_28_EMAIL = {
  subject: "You did it, {first}",
  body: "Hi {first},\n\n28 days. Done. Thank you for trusting us with it, and well done for seeing it through.\n\nWhatever you’ve decided about carrying on, we’d genuinely like to know how you found it. Reply with the one thing that was best and the one thing we could do better.\n\nAnd if you’re staying, see you next week.\n\n{team}",
};

// Failed payments (Sammy, 07/10/2026): after three failed attempts logged
// in TeamUp. Service message. Off until approved on the Failed payments screen.
const PAYMENT_FAILED_EMAIL = {
  subject: "Your payment didn’t go through, {first}",
  body: "Hi {first},\n\nYour membership payment has failed a few times now, so we wanted to check in before it causes a problem with your membership.\n\nUsually it’s an expired card or a change of bank. You can update your payment details in the TeamUp app, or reply to this email and we’ll sort it with you.\n\nIf something’s changed and you’d rather talk it through, just reply. We’d rather know than guess.\n\n{team}",
};

const WIN_BACK_EMAIL = {
  subject: "Sorry to see you go, {first}",
  body: [
    "Hi {first},",
    "",
    "We saw you’ve given notice on your membership. No hard feelings, and thank you for training with us.",
    "",
    "Before you go, a couple of things worth knowing:",
    "",
    "If it’s about time or money, there may be a membership that fits better. Facility access only, classes only, or putting your membership on hold for a while are all options.",
    "",
    "If something put you off, tell us. We’d much rather hear it than guess.",
    "",
    "If you’d like to talk it through, just reply to this email or grab one of the coaches next time you’re in. Your membership runs until the end of your notice, so there’s time to decide.",
    "",
    "{team}",
  ].join("\n"),
};

const WELCOME_EMAIL = {
  subject: "Welcome to {gym}, {first}!",
  body: "Hey {first},\n\nWe’re so excited to have you starting with us.\n\nYour first session is the beginning of something great - we’re really glad you’ve taken this step and we can’t wait to see what you achieve.\n\nIf you have any questions before your first session, just reach out and we’ll help you out.\n\nThe Round One team",
};

const rebookEmail = (missed: string) => ({
  subject: "Reschedule with {gym}",
  body: `Hi {first},\n\nWe had you booked in for {date} at {time}, but it looks like ${missed}.\n\nNo worries, things happen.\nIf you’d still like to chat, you can rebook using the link below:\n{bookLink}\n\nIf now’s not the right time, just reply and let me know.\n\nSpeak soon\nThe Round One team`,
});

export const AUTOMATIONS: Automation[] = [
  {
    id: "new_lead", name: "New lead – booking push", enabled: true, runs: 0, stopOnReply: true,
    summary: "Tells the front desk, emails and WhatsApps the lead a booking link, then nudges twice, two days apart, until they book or reply. GymGrow workflow 1.",
    trigger: { type: "form.submitted", formId: "free-trial" },
    steps: [
      { kind: "email", to: "staff", subject: "New trial lead: {name}" },
      // Someone already booked (or further on) who fills the form in again
      // doesn't need pushing to book.
      { kind: "if_stage_in", stages: ["new", "contacted", "no_show", "nurture", "lost"] },
      {
        kind: "email", to: "contact", subject: "{gym} next steps",
        body: "Hi {first},\n\nThanks for your enquiry! We’re excited to help you get started.\n\nThe next step is to book your onsite intro session. This gives us a chance to learn more about your goals, show you around, and explain how everything works.\n\nYou can choose a time that suits you here:\n{bookLink}\n\nIf you have any questions before booking, just reply to this email and we’ll help you out.\n\nSpeak soon,\nThe Round One team",
      },
      { kind: "whatsapp", template: "leads_1" },
      { kind: "wait", hours: 48 },
      { kind: "if_stage_in", stages: ["new", "contacted"] },
      { kind: "whatsapp", template: "leads_2" },
      { kind: "wait", hours: 48 },
      { kind: "if_stage_in", stages: ["new", "contacted"] },
      { kind: "whatsapp", template: "leads_3" },
    ],
  },
  {
    id: "trial_booked", name: "Trial booked – show-up reminders", enabled: true, runs: 0,
    summary: "Confirms the booking by email and WhatsApp, then reminds them the day before and two hours before. GymGrow workflow 2.",
    trigger: { type: "stage.changed", to: "booked" },
    steps: [
      { kind: "email", to: "staff", subject: "Trial booked: {name}, {date} at {time}" },
      {
        kind: "email", to: "contact", subject: "Discovery meeting with {gym}",
        body: "Hey {first},\n\nIt’s the Round One team here!\n\nThanks for booking your meeting with us for {date} at {time}.\n\nSUPER important\n\n1 - Please reply to this email to confirm you’ll 100% be attending our meeting.\n\n2 - This is an in person meeting at our HQ at {address}\n\nLet me know all is good and we’ll confirm your meeting!",
      },
      { kind: "whatsapp", template: "discovery_1" },
      { kind: "wait_until_trial", hoursBefore: 24, skipIfLate: true },
      { kind: "whatsapp", template: "discovery_2" },
      { kind: "wait_until_trial", hoursBefore: 2, skipIfLate: true },
      { kind: "whatsapp", template: "discovery_3" },
    ],
  },
  {
    id: "trial_moved", name: "Trial moved – new time", enabled: true, runs: 0,
    summary: "When a booked free trial moves to a new time (by them on their booking page, or by staff), confirms the new time. The reminders move with it.",
    trigger: { type: "appointment.moved" },
    steps: [
      { kind: "email", to: "staff", subject: "Trial moved: {name}, now {date} at {time}" },
      { kind: "whatsapp", template: "discovery_1" },
    ],
  },
  {
    id: "trial_cancelled", name: "Cancelled – rebooking push", enabled: true, runs: 0,
    summary: "When a free trial is cancelled, sends a rebooking link by email and WhatsApp. GymGrow workflow 3, cancelled branch.",
    trigger: { type: "appointment.status", status: "cancelled" },
    steps: [
      { kind: "email", to: "contact", ...rebookEmail("you’re not able to make it") },
      { kind: "whatsapp", template: "cancelled_1" },
    ],
  },
  {
    id: "no_show", name: "No-show – rebooking push", enabled: true, runs: 0,
    summary: "When someone misses their free trial, sends a rebooking link, then asks staff to call if they haven’t rebooked in two days. GymGrow workflow 3, no-show branch.",
    trigger: { type: "appointment.status", status: "no_show" },
    steps: [
      { kind: "email", to: "contact", ...rebookEmail("you weren’t able to make it") },
      { kind: "whatsapp", template: "no_showed_1" },
      { kind: "wait", hours: 48 },
      { kind: "if_stage_in", stages: ["no_show"] },
      { kind: "task", text: "Call {name} about rebooking their trial" },
    ],
  },
  {
    id: "trial_attended", name: "Trial attended – follow-up", enabled: true, runs: 0,
    summary: "Four hours after the trial, offers the 28 Day Program, unless they’ve already bought. GymGrow workflow 4.",
    trigger: { type: "stage.changed", to: "attended" },
    steps: [
      { kind: "wait", hours: 4 },
      { kind: "if_stage_in", stages: ["attended", "nurture"] },
      { kind: "whatsapp", template: "discovery_4" },
    ],
  },
  {
    id: "sold_programme", name: "Intro Programme – welcome", enabled: true, runs: 0,
    summary: "Welcomes someone who has bought the Intro Programme. GymGrow workflow 5.",
    trigger: { type: "stage.changed", to: "sold_programme" },
    steps: [
      { kind: "email", to: "staff", subject: "Sold – Programme: {name}" },
      { kind: "email", to: "contact", ...WELCOME_EMAIL },
      { kind: "whatsapp", template: "intro_programme_1" },
    ],
  },
  {
    id: "programme_week_one", name: "Intro Programme – first week check-in", enabled: false, runs: 0,
    summary: "A week into the programme, asks how it’s going. Off, as it was in GymGrow: switch it on to use it.",
    trigger: { type: "stage.changed", to: "sold_programme" },
    steps: [
      { kind: "wait", hours: 168 },
      { kind: "if_stage_in", stages: ["sold_programme"] },
      { kind: "whatsapp", template: "intro_programme_2" },
    ],
  },
  {
    id: "sold_membership", name: "Recurring member – welcome", enabled: true, runs: 0,
    summary: "Welcomes someone who has taken a recurring membership. GymGrow workflow 6.",
    trigger: { type: "stage.changed", to: "sold_membership" },
    steps: [
      { kind: "email", to: "staff", subject: "Sold – Recurring membership: {name}" },
      { kind: "email", to: "contact", ...WELCOME_EMAIL },
      { kind: "whatsapp", template: "recurring_member" },
    ],
  },
  {
    id: "program_day_1", name: "Program – day 1 welcome (from TeamUp)", enabled: false, runs: 0,
    summary: "When a Program membership starts in TeamUp, the welcome email and WhatsApp. Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "teamup" },
    steps: [
      { kind: "email", to: "contact", ...WELCOME_EMAIL },
      { kind: "whatsapp", template: "intro_programme_1" },
    ],
  },
  {
    id: "program_check_in", name: "Program – two-week check-in", enabled: false, runs: 0,
    summary: "Two weeks into the 28 Day Program (from TeamUp), asks how it’s going. Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 14 * 24 },
      { kind: "email", to: "contact", ...PROGRAM_CHECK_IN_EMAIL },
      { kind: "whatsapp", template: "program_day_14" },
    ],
  },
  {
    id: "program_ending", name: "Program – a week to go, move to recurring", enabled: false, runs: 0,
    summary: "A week before the 28 Day Program ends (from TeamUp), offers a recurring membership. Off until approved on the Program members screen.",
    trigger: { type: "membership.ending", daysBefore: 7, category: "Program Memberships", via: "crm" },
    steps: [{ kind: "email", to: "contact", ...PROGRAM_ENDING_EMAIL }],
  },
  {
    id: "program_day_3", name: "Program – day 3: get your sessions in the diary", enabled: false, runs: 0,
    summary: "Day 3 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 48 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_3_EMAIL },
      { kind: "whatsapp", template: "program_day_3" },
      { kind: "whatsapp", template: "program_day_21" },
    ],
  },
  {
    id: "program_day_7", name: "Program – one week done", enabled: false, runs: 0,
    summary: "Day 7 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 144 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_7_EMAIL },
      { kind: "whatsapp", template: "program_day_7" },
    ],
  },
  {
    id: "program_day_10", name: "Program – day 10: the dip", enabled: false, runs: 0,
    summary: "Day 10 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 216 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_10_EMAIL },
      { kind: "whatsapp", template: "program_day_10" },
    ],
  },
  {
    id: "program_day_17", name: "Program – day 17: second half", enabled: false, runs: 0,
    summary: "Day 17 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 384 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_17_EMAIL },
      { kind: "whatsapp", template: "program_day_17" },
    ],
  },
  {
    id: "program_day_24", name: "Program – day 24: finishing strong", enabled: false, runs: 0,
    summary: "Day 24 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 552 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_24_EMAIL },
      { kind: "whatsapp", template: "program_day_24" },
    ],
  },
  {
    id: "program_day_28", name: "Program – day 28: you did it", enabled: false, runs: 0,
    summary: "Day 28 of the 28 Day Program (from TeamUp). Off until approved on the Program members screen.",
    trigger: { type: "membership.started", category: "Program Memberships", via: "crm" },
    steps: [
      { kind: "wait", hours: 648 },
      { kind: "email", to: "contact", ...PROGRAM_DAY_28_EMAIL },
      { kind: "whatsapp", template: "program_day_28" },
    ],
  },
  {
    id: "payment_failed", name: "Payment failed – update your details", enabled: false, runs: 0,
    summary: "When TeamUp has logged three failed payment attempts, asks them to update their payment details. Off until approved on the Failed payments screen.",
    trigger: { type: "payment.failed" },
    steps: [{ kind: "email", to: "contact", ...PAYMENT_FAILED_EMAIL }],
  },
  {
    id: "win_back", name: "Gave notice – win-back", enabled: false, runs: 0,
    summary: "The day after someone gives notice to cancel in TeamUp, emails them to see if anything would change their mind. Off until Sammy approves the wording.",
    trigger: { type: "membership.cancelling" },
    steps: [
      { kind: "wait", hours: 24 },
      { kind: "email", to: "contact", marketing: true, ...WIN_BACK_EMAIL },
    ],
  },
  {
    id: "did_not_convert", name: "Did not convert – catch-up", enabled: true, runs: 0,
    summary: "When staff mark a programme customer as not carrying on, offers a catch-up session.",
    trigger: { type: "tag.added", tag: "did-not-convert" },
    steps: [{ kind: "whatsapp", template: "did_not_convert_intro_to_recurring" }],
  },
];

/** The questions from Round One's Typeform (Round One Fitness 10-Step Form). Everyone qualifies. */
export const TRIAL_FORM: Form = {
  id: "free-trial", slug: "free-trial", name: "Free trial", responses: 0,
  thanksTitle: "Congratulations 🎉",
  thanks: "Based on your answers, you’ve qualified for our programme. Please book an in-person intro meeting with a member of our team to secure your spot.",
  bookButton: "Book a meeting",
  questions: [
    { id: "q1", type: "choice", text: "Do you prefer training alone or in a group?", options: ["Alone", "Group", "Either"] },
    { id: "q2", type: "choice", text: "Are you willing to invest in your health and fitness?", options: ["Yes, I’m ready to commit", "I’m considering it", "Not right now"] },
    { id: "q3", type: "long", text: "What is your #1 fitness goal right now?" },
    { id: "q4", type: "long", text: "Why is now the right time for you to start?" },
    { id: "q5", type: "long", text: "What have you tried before?" },
    { id: "q6", type: "choice", text: "How many days per week are you willing to train?", options: ["1–2 days", "3–4 days", "5+ days"] },
    { id: "q7", type: "choice", text: "Are you looking for coaching & accountability?", options: ["Yes", "No", "Not sure"] },
    { id: "q8", type: "choice", text: "How soon would you be ready to start?", options: ["Immediately", "This week", "This month", "Just browsing"] },
    { id: "q9", type: "scale", text: "How committed are you?", low: "Not very - just browsing", high: "I’m ready to commit" },
    { id: "q10", type: "text", field: "name", text: "What’s your full name?" },
    { id: "q11", type: "phone", field: "phone", text: "What’s the best phone number to reach you?", help: "We’ll message you about your intro meeting on WhatsApp." },
    { id: "q12", type: "email", field: "email", text: "And finally, what’s your email address?" },
  ],
};

/**
 * When people can book the free trial themselves: the GymGrow booking
 * calendar's weekday hours (Monday to Thursday 08:00–19:30, Friday
 * 08:00–17:00) plus weekends 09:00–16:00, all inside the gym's opening
 * hours (roundonefitness.co.uk: Mon–Fri 6am–10pm, Sat–Sun 9am–4pm).
 * 30-minute slots, one person per slot, up to 7 days ahead (Sammy, 27/09).
 */
export const TRIAL_AVAILABILITY: Availability = {
  slotMin: 30,
  capacity: 1,
  minNoticeHours: 2,
  daysAhead: 7,
  hours: {
    0: [["09:00", "16:00"]],
    1: [["08:00", "19:30"]],
    2: [["08:00", "19:30"]],
    3: [["08:00", "19:30"]],
    4: [["08:00", "19:30"]],
    5: [["08:00", "17:00"]],
    6: [["09:00", "16:00"]],
  },
};
