// Sample data so the prototype feels real. None of these people or ads exist.
// Times are relative to when the data was created, so it always looks fresh.

import { Appointment, Automation, Campaign, Contact, Form, Message, Source, Stage, State, Task } from "./types";

// Meta ads, down to the individual ad. Campaign totals are the sum of these.
const CAMPAIGNS: Campaign[] = [
  {
    name: "Autumn beginners", utm: "autumn_beginners",
    ads: [
      { id: "ad_101", name: "Pads with a coach", adset: "Bristol 18–35", format: "video", spend: 430, impressions: 24100, clicks: 700, leads: 30, trials: 9, joined: 4 },
      { id: "ad_102", name: "First class free", adset: "Bristol 18–35", format: "image", spend: 250, impressions: 15600, clicks: 360, leads: 14, trials: 3, joined: 1 },
      { id: "ad_103", name: "Member story: Tom", adset: "Bristol 35–55", format: "video", spend: 140, impressions: 8500, clicks: 180, leads: 8, trials: 2, joined: 1 },
    ],
  },
  {
    name: "Kids’ boxing", utm: "kids_boxing",
    ads: [
      { id: "ad_201", name: "Kids’ class clip", adset: "Parents, Bristol", format: "video", spend: 260, impressions: 14100, clicks: 400, leads: 14, trials: 6, joined: 2 },
      { id: "ad_202", name: "Confidence carousel", adset: "Parents, Bristol", format: "carousel", spend: 150, impressions: 8800, clicks: 210, leads: 7, trials: 2, joined: 1 },
    ],
  },
  {
    name: "Women’s boxing", utm: "womens_boxing",
    ads: [
      { id: "ad_301", name: "Women’s session reel", adset: "Women 22–45", format: "video", spend: 204, impressions: 11200, clicks: 320, leads: 11, trials: 4, joined: 2 },
      { id: "ad_302", name: "Try it free", adset: "Women 22–45", format: "image", spend: 100, impressions: 6200, clicks: 135, leads: 4, trials: 1, joined: 0 },
    ],
  },
  {
    name: "Retargeting", utm: "retargeting",
    ads: [
      { id: "ad_401", name: "Still thinking about it?", adset: "Site visitors, 30 days", format: "image", spend: 150, impressions: 9800, clicks: 290, leads: 6, trials: 2, joined: 0 },
    ],
  },
];

type Row = [id: string, name: string, stage: Stage, source: Source, hoursAgo: number, adId?: string];

const ROWS: Row[] = [
  ["jordan", "Jordan Reid", "new", "meta_ad", 2, "ad_101"],
  ["hannah", "Hannah Cole", "new", "website", 5],
  ["ellis", "Ellis Grant", "new", "meta_ad", 26, "ad_102"],
  ["chloe", "Chloe Adams", "new", "meta_ad", 28, "ad_301"],
  ["ryan", "Ryan Moss", "new", "walk_in", 50],
  ["nathan", "Nathan Hughes", "contacted", "referral", 30],
  ["maya", "Maya Patel", "contacted", "meta_ad", 50, "ad_103"],
  ["owen", "Owen Clarke", "contacted", "website", 75],
  ["sam", "Sam O’Neill", "trial_booked", "meta_ad", 96, "ad_101"],
  ["aisha", "Aisha Khan", "trial_booked", "meta_ad", 100, "ad_102"],
  ["grace", "Grace Liu", "trial_booked", "referral", 120],
  ["leo", "Leo Cole", "trial_booked", "website", 130],
  ["kai", "Kai Robinson", "trial_booked", "meta_ad", 60, "ad_401"],
  ["ella", "Ella Wright", "trial_booked", "meta_ad", 80, "ad_301"],
  ["priya", "Priya Shah", "trial_done", "meta_ad", 170, "ad_101"],
  ["ben", "Ben Carter", "trial_done", "walk_in", 200],
  ["zara", "Zara Ahmed", "trial_done", "meta_ad", 220, "ad_201"],
  ["tom", "Tom Price", "member", "meta_ad", 300, "ad_101"],
  ["dan", "Dan Evans", "member", "referral", 400],
];

export const TEMPLATES: Record<string, string> = {
  trial_welcome: "Hi {first}, thanks for asking about a free trial at Round One. Which evening suits you: Tuesday, Wednesday or Thursday?",
  trial_nudge: "Hi {first}, just checking in. Would you like to book your free trial this week? Reply with a day and we’ll sort it.",
  trial_confirmed: "You’re booked in, {first}. Your free trial is on {trial}. Bring trainers and water, and we’ll lend you gloves.",
  trial_reminder: "See you soon, {first}. Your trial starts at {trialTime}.",
  missed_you: "Sorry we missed you, {first}. Want to rebook your free trial? Reply with a day that works.",
};

const AUTOMATIONS: Automation[] = [
  {
    id: "new_trial", name: "New trial lead", enabled: true, runs: 41,
    summary: "Welcomes a new trial lead on WhatsApp, tells the front desk, then nudges if they haven’t booked.",
    trigger: { type: "form.submitted", formId: "free-trial" },
    steps: [
      { kind: "whatsapp", template: "trial_welcome" },
      { kind: "email", to: "staff", subject: "New trial lead: {name}" },
      { kind: "wait", hours: 24 },
      { kind: "if_stage_in", stages: ["new", "contacted"] },
      { kind: "whatsapp", template: "trial_nudge" },
    ],
  },
  {
    id: "trial_reminder", name: "Trial reminder", enabled: true, runs: 29,
    summary: "Confirms the booking, then reminds them on the day.",
    trigger: { type: "stage.changed", to: "trial_booked" },
    steps: [
      { kind: "whatsapp", template: "trial_confirmed" },
      { kind: "wait_until_trial", hoursBefore: 2 },
      { kind: "whatsapp", template: "trial_reminder" },
    ],
  },
  {
    id: "no_show", name: "Trial no-show", enabled: true, runs: 6,
    summary: "Gets back in touch with anyone who missed their trial.",
    trigger: { type: "tag.added", tag: "no-show" },
    steps: [
      { kind: "whatsapp", template: "missed_you" },
      { kind: "wait", hours: 48 },
      { kind: "if_stage_in", stages: ["trial_done"] },
      { kind: "task", text: "Call {name} about rebooking their trial" },
    ],
  },
];

const FORMS: Form[] = [
  {
    id: "free-trial", slug: "free-trial", name: "Free trial", responses: 94,
    thanks: "We’ll message you on WhatsApp shortly to book your free trial.",
    questions: [
      { id: "q1", type: "text", field: "name", text: "What’s your name?" },
      { id: "q2", type: "phone", field: "phone", text: "What’s your mobile number?", help: "We’ll message you on WhatsApp to book your trial." },
      { id: "q3", type: "email", field: "email", text: "And your email?" },
      { id: "q4", type: "choice", text: "What’s your main goal?", options: ["Get fitter", "Learn to box", "Build confidence", "Compete"] },
      { id: "q5", type: "choice", text: "Have you boxed before?", options: ["Never", "A little", "Yes, regularly"] },
      { id: "q6", type: "choice", text: "When could you train?", options: ["Weekday mornings", "Weekday evenings", "Weekends"] },
    ],
  },
  {
    id: "kids", slug: "kids-trial", name: "Kids’ free trial", responses: 12,
    thanks: "Thanks. We’ll be in touch shortly to book your child’s free trial.",
    questions: [
      { id: "k1", type: "text", field: "name", text: "What’s your name?" },
      { id: "k2", type: "phone", field: "phone", text: "Your mobile number" },
      { id: "k3", type: "choice", text: "How old is your child?", options: ["5–7", "8–12", "13–16"] },
    ],
  },
];

export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Made-up daily numbers for the weeks before the sample data, so the Today
// charts have a shape. Deterministic, so every reset looks the same.
function sampleHistory(now: number, days: number) {
  let x = 7;
  const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const leads = Math.round((weekend ? 1.5 : 3.5) + rand() * 3);
    out.push({
      day: dayKey(d.getTime()),
      leads,
      trials: Math.round(leads * (0.25 + rand() * 0.25)),
      spend: Math.round(44 + rand() * 24),
    });
  }
  return out;
}

export function seed(now: number): State {
  const ago = (h: number) => new Date(now - h * 3600e3).toISOString();
  const at = (h: number) => new Date(now + h * 3600e3).toISOString();

  const findAd = (adId?: string) => {
    for (const c of CAMPAIGNS) {
      const ad = c.ads.find((a) => a.id === adId);
      if (ad) return { campaign: c.utm, adset: ad.adset, ad: ad.name, adId: ad.id };
    }
    return {};
  };

  const contacts: Contact[] = ROWS.map(([id, name, stage, source, h, adId], i) => ({
    id, name, stage, source,
    ...findAd(adId),
    phone: `+44 7700 900${String(101 + i)}`,
    email: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    tags: [],
    answers: [],
    createdAt: ago(h),
  }));
  const byId = (id: string) => contacts.find((c) => c.id === id)!;

  const jordan = byId("jordan");
  jordan.tags = ["beginner", "evenings"];
  jordan.answers = [
    { question: "What’s your main goal?", answer: "Learn to box" },
    { question: "Have you boxed before?", answer: "Never" },
    { question: "When could you train?", answer: "Weekday evenings" },
  ];
  byId("priya").tags = ["no-show"];

  // Trial slots on the half hour, relative to today.
  const slot = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const soon = (() => {
    const d = new Date(now + 3 * 3600e3);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return d.getTime();
  })();
  const A: [contactId: string, staff: string, start: number, status: Appointment["status"], notes?: string][] = [
    ["sam", "alex", soon, "confirmed", "Beginners"],
    ["aisha", "alex", soon, "booked", "Beginners"],
    ["grace", "jess", slot(1, 11, 30), "confirmed", "Women’s boxing"],
    ["leo", "alex", slot(1, 12, 30), "booked", "Kids 8–12. Mum is Hannah Cole."],
    ["kai", "jess", slot(2, 18), "booked", "Beginners"],
    ["ella", "jess", slot(3, 19), "booked", "Women’s boxing"],
    ["priya", "alex", slot(-2, 18), "no_show", "Beginners"],
    ["ben", "jess", slot(-3, 19), "showed", "Beginners"],
    ["zara", "alex", slot(-4, 17), "showed", "Kids 8–12"],
    ["tom", "alex", slot(-5, 18), "showed", "Beginners"],
    ["dan", "jess", slot(-6, 19), "showed", "Beginners"],
    ["maya", "alex", slot(-1, 18), "cancelled", "Asked to move it, not rebooked yet"],
  ];
  const appointments: Appointment[] = A.map(([contactId, staffId, start, status, notes], i) => ({
    id: `a${i + 1}`, contactId, calendarId: "trial", staffId, status, notes,
    start: new Date(start).toISOString(),
    end: new Date(start + 60 * 60e3).toISOString(),
    createdAt: ago(48),
  }));
  for (const a of appointments) {
    if (a.status === "booked" || a.status === "confirmed") byId(a.contactId).trialAt = a.start;
  }

  const messages: Message[] = [
    { id: "m1", contactId: "jordan", dir: "out", template: "trial_welcome", by: "New trial lead", at: ago(1.9),
      text: "Hi Jordan, thanks for asking about a free trial at Round One. Which evening suits you: Tuesday, Wednesday or Thursday?" },
    { id: "m2", contactId: "jordan", dir: "in", at: ago(1.6), text: "Hi, Wednesday would be good. Do I need my own gloves?" },
    { id: "m3", contactId: "jordan", dir: "in", at: ago(1.58), text: "Also is it ok if I’ve never boxed before" },
    { id: "m4", contactId: "aisha", dir: "out", template: "trial_confirmed", by: "Trial reminder", at: ago(20),
      text: "You’re booked in, Aisha. Your free trial is coming up. Bring trainers and water, and we’ll lend you gloves." },
    { id: "m5", contactId: "priya", dir: "out", template: "missed_you", by: "Trial no-show", at: ago(30),
      text: "Sorry we missed you, Priya. Want to rebook your free trial? Reply with a day that works." },
  ];

  const tasks: Task[] = [
    { id: "t1", contactId: "jordan", text: "Call Jordan Reid back about evening beginners classes", done: false, at: ago(1.5) },
    { id: "t2", contactId: "hannah", text: "Reply to Hannah Cole about a kids’ trial (son, aged 11)", done: false, at: ago(5) },
    { id: "t3", contactId: "maya", text: "Maya Patel cancelled her trial. Offer her a new time", done: false, at: ago(20) },
  ];

  return {
    version: 3,
    seededAt: new Date(now).toISOString(),
    history: sampleHistory(now, 60),
    clockOffset: 0,
    calendars: [{ id: "trial", name: "Free trial", durationMin: 60, style: "trial", bookTrial: true }],
    staff: [
      { id: "alex", name: "Alex Morgan", role: "Head coach" },
      { id: "jess", name: "Jess Hart", role: "Coach" },
    ],
    appointments,
    contacts,
    messages,
    tasks,
    templates: { ...TEMPLATES },
    automations: structuredClone(AUTOMATIONS),
    forms: structuredClone(FORMS),
    runs: [
      { id: "r1", automationId: "new_trial", contactId: "jordan", stepIndex: 3, status: "waiting", resumeAt: at(22), startedAt: ago(2) },
      { id: "r2", automationId: "trial_reminder", contactId: "aisha", stepIndex: 2, status: "waiting", resumeAt: new Date(soon - 2 * 3600e3).toISOString(), startedAt: ago(20) },
      { id: "r3", automationId: "no_show", contactId: "priya", stepIndex: 2, status: "waiting", resumeAt: at(18), startedAt: ago(30) },
    ],
    events: [
      { id: "e1", type: "whatsapp.received", contactId: "jordan", detail: "From Jordan Reid", at: ago(1.58) },
      { id: "e2", type: "email.sent", contactId: "jordan", detail: "New trial lead: Jordan Reid to the front desk", at: ago(1.9) },
      { id: "e3", type: "whatsapp.sent", contactId: "jordan", detail: "trial_welcome to Jordan Reid", at: ago(1.9) },
      { id: "e4", type: "form.submitted", contactId: "jordan", detail: "Jordan Reid · Free trial", at: ago(2) },
      { id: "e5", type: "contact.created", contactId: "jordan", detail: "Jordan Reid from ad “Pads with a coach”", at: ago(2) },
      { id: "e6", type: "stage.changed", contactId: "tom", detail: "Tom Price: Trial done to Joined", at: ago(22) },
    ],
    campaigns: structuredClone(CAMPAIGNS),
  };
}
