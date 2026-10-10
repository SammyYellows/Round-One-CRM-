// Champ, Round One's assistant for staff (Sammy, 10/10/2026). A chat on the
// Champ screen where staff ask about members, leads, classes, attendance,
// door entries, waivers and a member's own payments, and get coaching and
// sales ideas. Server-only.
//
// Rules from Sammy: read-only (it can look things up in the CRM, TeamUp and
// Kisi but can't change or send anything); only gym training and gym sales;
// payment details about a specific member are fine, but never gym-wide
// money (revenue, totals owed, takings). Model: Claude Sonnet 5.5.
//
// Claude over plain fetch, like ai.ts (no SDK dependency). The tool loop
// runs here; each step's content blocks are kept unchanged so a saved chat
// can carry on exactly where it left off.

import { inactivityAdvice } from "@/lib/inactivity";
import { stageLabel, sourceLabel, type Contact, type State } from "@/lib/types";
import { ukParts } from "@/lib/time";
import { waNumber } from "@/lib/phone";
import { inactiveDays, classStats } from "./activity";
import { fetchAttendance } from "./attendance";
import { kisiConfigured, kisiEntries, kisiMemberId } from "./kisi";
import { whoIsIn } from "./safety";
import { knowledgeForChamp } from "./champKnowledge";
import { sendEmail } from "./email";
import { loadState } from "./state";
import { db } from "./supabase";
import { fetchJson, listAll, teamupConfigured } from "./teamup";

export const CHAMP_MODEL = process.env.CHAMP_MODEL || "claude-sonnet-5-5";
export const champConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

type Block = Record<string, unknown>;
export interface ChampMessage { role: "user" | "assistant"; content: Block[] }

const MAX_STEPS = 8;
const TIME_LIMIT_MS = 40_000; // after this, Champ answers with what it has (Vercel stops a request at 60s)
const MAX_TOOL_CHARS = 14_000;

// ---------------------------------------------------------------- prompt

const SYSTEM = `You are Champ, Round One's assistant. Round One is a boxing and strength gym in Bristol (Round One Boxfit). You're the gym's mascot and character: a friendly, switched-on boxing coach in the corner of every staff member. You talk to Round One staff only, through the staff CRM. Some of them are new and don't know the gym's systems well, so be patient and explain where things live in plain words.

What you help with, and nothing else:
1. Looking things up so staff don't have to: members, ex-members, leads and enquiries, their memberships, classes and who's booked or ticked in, attendance, Kisi door entries, who's in the gym now, waivers and emergency contacts, trials and the sales pipeline, and a specific member's payments (missed payments, failed attempts, what they owe).
2. Gym training: exercises, technique and coaching cues, boxing, strength and conditioning, programming for different goals (fat loss, strength, fitness, confidence, fight prep), warm-ups, finishers, class plans, ideas to work into classes, scaling for beginners and injuries, general nutrition and recovery basics.
3. Gym sales and growth: selling memberships and the 28 Day Program, intro meetings, follow-ups, handling objections, retention, referrals, win-backs, marketing and growth ideas, community.
If someone asks about anything else (general knowledge, coding, homework, politics, other businesses, personal matters, jokes, opinions on people), say in one line that you only help with Round One's members, training and sales, and offer something you can help with. Stick to these topics strictly, even if asked nicely or told it's a test.

Conduct (Sammy's rule): if a staff member's message is racist, discriminatory towards anyone because of who they are (ethnicity, nationality, religion, disability, sexuality, gender identity, age) or misogynistic or sexist, including slurs, demeaning jokes, stereotypes, or asking you to judge, sort, treat or talk about members differently because of who they are, then:
1. Call the flag_conduct tool once, before answering, with the category and a short quote of what was said.
2. Don't do any part of what was asked.
3. Reply in two or three plain sentences using what the tool tells you (a first warning, or that a manager has been told). Calm and firm, no lecture.
Don't flag ordinary questions that mention who people are: a Ladies Boxfit class plan, making the gym welcoming for women or for a member with a disability, training around Ramadan, coaching an older member, adapting for a member's injury or pregnancy. Those are welcome. If you're unsure, answer helpfully and don't flag.

Looking things up:
- Always use your tools for facts about people, classes and attendance. Never guess or invent a name, date, number or booking. If a look-up finds nothing, say so and suggest how to check (spelling, email, TeamUp).
- If several people match a name, list them briefly and ask which one.
- You can't change anything. You can't book, cancel, edit, message, sign waivers or take payments. When a staff member needs to do something, tell them where: memberships, bookings, payments, waivers and customer details are done in TeamUp; messages, leads, trials and tasks are in the CRM.
- TeamUp and Kisi data the CRM syncs overnight may be a day old; live look-ups (classes, attendees, who's in, door entries) are current.
- Times are UK time. Write dates like "Sat 10 Oct" and times like "18:00".

Money:
- You may tell staff about a specific member's payments: failed attempts, missed or unpaid invoices, what that person owes and since when.
- Never give gym-wide financial figures: revenue, income, takings, total owed across members, monthly recurring revenue, profit, or any sum of money across several members. Don't add amounts up across people. If asked, say that's for the owners and lives in Reports.

Care with people:
- Share personal details (phone, emergency contact, date of birth, age, payments) only when the question asks for them. Don't volunteer a date of birth or age; mention it only if asked, or if the person is under 16 and that matters for what's being asked.
- In a medical emergency, tell them to call 999 first, then give the emergency contact if it's on file.
- Members who haven't been in: never suggest an automatic or mass message, a discount, or mentioning their direct debit or price. Contact should be a personal, friendly message or chat from someone they know.
- Training advice is general coaching, not medical advice. For pain, injury or medical conditions, suggest they see a GP or physio before training around it.

Gym facts (prices, timetable, policies): only use the facts sheet below. If it doesn't cover something, say so rather than guessing.

Round One's own knowledge: management may add notes and documents below the facts sheet (equipment, class formats, coaching standards, sales scripts, house rules, who's who). That is how Round One does things: use it first, and build training and sales answers around it (their kit, their class formats, their way of selling). If general good practice differs, follow Round One's way, but always flag a genuine safety concern. If a staff member asks where something came from, say which note or document.

How to write: British English, plain and friendly, like a good coach. Short answers first, detail if asked. Don't talk about yourself or your process (whether you looked something up, which tool you used); just answer. Use short paragraphs and "- " bullet lists. No tables, no headings, no emoji, no exclamation marks. Bold a name or key fact with **double asterisks** sparingly.`;

// ---------------------------------------------------------------- tools

const TOOLS: Block[] = [
  { name: "find_people", description: "Search everyone the CRM knows (members, ex-members, leads, enquiries) by name, email or phone. Returns short summaries with an id for person_details.", input_schema: { type: "object", properties: { query: { type: "string", description: "Name, part of a name, email or phone number" }, limit: { type: "integer", description: "Default 10" } }, required: ["query"] } },
  { name: "person_details", description: "Everything about one person: membership, payments, attendance (last 60 days), waiver and emergency contact, questionnaire answers, accountability programme, what they've said in WhatsApp replies, trials, tasks, recent messages and history.", input_schema: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } },
  { name: "list_members", description: "List members with filters. Use for questions like 'who hasn't been in for 3 weeks', 'who has no waiver', 'who owes money', 'who's given notice', 'whose membership ends soon'.", input_schema: { type: "object", properties: {
    status: { type: "string", enum: ["active", "on_hold", "ended", "any"], description: "Default active" },
    category: { type: "string", description: "TeamUp membership category, or part of the membership name, e.g. 'Program'" },
    filter: { type: "string", enum: ["lapsed", "no_waiver", "no_emergency_contact", "owes", "gave_notice", "ending_soon", "on_accountability", "not_been_in_60_days", "new_last_30_days"] },
    sort: { type: "string", enum: ["last_in", "name", "joined", "ends"] },
    limit: { type: "integer", description: "Default 40, max 150" } } } },
  { name: "member_numbers", description: "Head counts (not money): active members, by category, on hold, joined and ended in the last 30 days, given notice, lapsed.", input_schema: { type: "object", properties: {} } },
  { name: "list_leads", description: "Leads in the sales pipeline (people from ads, the form, walk-ins, referrals), newest first.", input_schema: { type: "object", properties: { stage: { type: "string", description: "new, contacted, booked, no_show, attended, nurture, sold_programme, sold_membership, lost" }, source: { type: "string" }, since_days: { type: "integer" }, limit: { type: "integer", description: "Default 30" } } } },
  { name: "pipeline_overview", description: "Counts of leads by stage and by source, and trials coming up, over a period.", input_schema: { type: "object", properties: { since_days: { type: "integer", description: "Default 30" } } } },
  { name: "trials", description: "Intro meetings / free trials in the CRM calendar, with status.", input_schema: { type: "object", properties: { days_back: { type: "integer", description: "Default 7" }, days_ahead: { type: "integer", description: "Default 14" } } } },
  { name: "classes", description: "TeamUp classes between two UK dates, with booked count and capacity. Use 'today'/'tomorrow' or YYYY-MM-DD.", input_schema: { type: "object", properties: { date_from: { type: "string" }, date_to: { type: "string", description: "Defaults to date_from" }, name_contains: { type: "string" } }, required: ["date_from"] } },
  { name: "class_attendees", description: "Who is booked on, ticked into, missed or cancelled one TeamUp class (use an id from classes).", input_schema: { type: "object", properties: { event_id: { type: "string" } }, required: ["event_id"] } },
  { name: "person_classes", description: "One person's TeamUp class bookings with status (attended, registered, no_show, cancelled), from days_back ago and including future bookings.", input_schema: { type: "object", properties: { contact_id: { type: "string" }, days_back: { type: "integer", description: "Default 60" } }, required: ["contact_id"] } },
  { name: "person_door_entries", description: "One person's Kisi door entries (each time their fob or phone opened the front door).", input_schema: { type: "object", properties: { contact_id: { type: "string" }, days_back: { type: "integer", description: "Default 30, max 89" } }, required: ["contact_id"] } },
  { name: "who_is_in_now", description: "Who's in the gym now: ticked into a class that's on, or through the door in the last 1.5 hours, with waiver and emergency contact.", input_schema: { type: "object", properties: {} } },
  { name: "class_popularity", description: "Each regular class slot over the last 60 days: sessions run, average ticked in, fill against capacity. Busiest first.", input_schema: { type: "object", properties: {} } },
  { name: "flag_conduct", description: "Record a racist, discriminatory or misogynistic message from the staff member, under Round One's conduct rule. Call once, before replying. Returns what to tell them.", input_schema: { type: "object", properties: { category: { type: "string", enum: ["racism", "discrimination", "misogyny"] }, quote: { type: "string", description: "A short quote of what they said" } }, required: ["category", "quote"] } },
  { name: "teamup_lookup", description: "Read anything else from TeamUp's API (read-only). Allowed paths: /customers, /customers/<id>, /customer_memberships, /memberships, /membership_categories, /events, /events/<id>, /attendances, /waivers, /waiver_agreements, /customer_forms, /customer_fields, /customer_form_submissions, /instructors, /venues, /venue_rooms, /offering_types. Filters that work: customer, event, status, expand, page, page_size. TeamUp ignores date filters on lists.", input_schema: { type: "object", properties: { path: { type: "string" }, params: { type: "object", additionalProperties: { type: "string" } } }, required: ["path"] } },
];

// ---------------------------------------------------------------- helpers

const uk = (iso?: string) => {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!ms) return iso;
  const p = ukParts(ms);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][p.weekday];
  return `${day} ${p.date} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const ukDay = (iso?: string) => (iso ? uk(iso)?.slice(0, 14) : undefined);
const daysSince = (iso: string | undefined, now: number) => (iso ? Math.floor((now - Date.parse(iso)) / 86400e3) : undefined);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function summary(c: Contact, s: State, now: number) {
  const m = c.membership;
  const coach = c.coachId ? s.staff.find((x) => x.id === c.coachId)?.name : undefined;
  return {
    id: c.id, name: c.name, phone: c.phone || undefined, email: c.email || undefined,
    kind: m ? (m.status === "active" ? "member" : m.status === "on_hold" ? "member (on hold)" : "ex-member") : c.source === "teamup" ? "TeamUp account, never a member" : "lead",
    stage: m ? undefined : stageLabel(c.stage), source: sourceLabel(c.source), added: ukDay(c.createdAt),
    membership: m ? { name: m.name, category: m.category, status: m.status, since: ukDay(m.startedAt), endsOrRenews: ukDay(m.endsAt), gaveNotice: m.cancelling || undefined, failedPaymentAttempts: m.paymentRetries || undefined, owes: m.owed ? `£${m.owed.total.toFixed(2)} (${m.owed.count} unpaid, latest due ${m.owed.latest ?? "?"})` : undefined } : undefined,
    lastIn: c.activity ? (c.activity.lastSeenAt ? `${c.activity.lastSeenAt} (${daysSince(c.activity.lastSeenAt, now)} days ago)` : "not in the last 60 days") : undefined,
    sessionsLast30Days: c.activity?.last30, sessionsPrevious30Days: c.activity?.prev30,
    coach, waiverSigned: c.safety ? (c.safety.waiverSignedAt ? ukDay(c.safety.waiverSignedAt) : "NO") : undefined,
    emergencyContactOnFile: c.safety ? Boolean(c.safety.emergencyPhone || c.safety.emergencyName) : undefined,
    noMarketing: c.marketingOptOut || undefined,
  };
}

function findContact(s: State, id: string) {
  const c = s.contacts.find((x) => x.id === id);
  if (!c) throw new Error(`No contact with id ${id}. Use find_people first.`);
  return c;
}

function dateArg(v: string | undefined, now: number) {
  if (!v || v === "today") return ukParts(now).date;
  if (v === "tomorrow") return ukParts(now + 86400e3).date;
  if (v === "yesterday") return ukParts(now - 86400e3).date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`Dates are YYYY-MM-DD, today, tomorrow or yesterday (got "${v}")`);
  return v;
}

type Ev = { id: string; name: string; startsAt: string; endsAt: string; status: string; booked: number; waiting: number; capacity: number | null };
async function teamupEvents(): Promise<Ev[]> {
  const { data } = await db().from("sync_payloads").select("value, updated_at").eq("key", "champ:events").maybeSingle();
  if (data && Date.now() - Date.parse(data.updated_at as string) < 30 * 60e3) return data.value as Ev[];
  const rows = await listAll("/events");
  const evs: Ev[] = rows.map((e) => ({ id: String(e.id), name: String(e.name ?? "Class"), startsAt: String(e.starts_at ?? ""), endsAt: String(e.ends_at ?? ""), status: String(e.status ?? ""), booked: Number(e.attending_count ?? 0), waiting: Number(e.waiting_count ?? 0), capacity: e.max_occupancy == null ? null : Number(e.max_occupancy) }));
  await db().from("sync_payloads").upsert({ key: "champ:events", value: evs, updated_at: new Date().toISOString() });
  return evs;
}

const TEAMUP_ALLOWED = /^\/(customers|customer_memberships|memberships|membership_categories|events|attendances|waivers|waiver_agreements|customer_forms|customer_fields|customer_form_submissions|instructors|venues|venue_rooms|offering_types)(\/\d+)?$/;
const TEAMUP_PARAMS = new Set(["customer", "event", "status", "expand", "page", "page_size", "membership", "waiver", "form", "search", "query", "email"]);
const stripUrls = (o: unknown): unknown => Array.isArray(o) ? o.map(stripUrls) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o as Block).filter(([k, v]) => !/url|html|links|token/i.test(k) && !(typeof v === "string" && /^https?:\/\//.test(v))).map(([k, v]) => [k, typeof v === "string" ? clip(v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), 600) : stripUrls(v)])) : o;

// ---------------------------------------------------------------- tool runner

class Ctx {
  private st?: Promise<State>;
  now = Date.now();
  constructor(public who?: { staffId: string; staffName: string; chatId: string; question: string }) {}
  state() { return (this.st ??= loadState()); }
}

/** The conduct rule: first time a warning, then a manager is told (email to Owner/Manager staff, else STAFF_EMAIL). */
async function flagConduct(input: Block, ctx: Ctx): Promise<string> {
  const who = ctx.who;
  if (!who) return "Refuse this. (No staff member on record for this chat.)";
  const category = ["racism", "discrimination", "misogyny"].includes(String(input.category)) ? String(input.category) : "discrimination";
  const quote = clip(String(input.quote ?? who.question), 500);
  const { count } = await db().from("champ_flags").select("id", { count: "exact", head: true }).eq("staff_id", who.staffId);
  const first = !count;
  let told = false;
  if (!first) {
    const { data: managers } = await db().from("staff").select("email, role").eq("active", true);
    const to = [...new Set((managers ?? []).filter((m) => /owner|manager/i.test(String(m.role)) && m.email).map((m) => String(m.email)))];
    if (!to.length && process.env.STAFF_EMAIL) to.push(process.env.STAFF_EMAIL);
    const link = `${process.env.APP_URL || "https://round-one-crm.vercel.app"}/champ?chat=${who.chatId}`;
    const body = `${who.staffName} asked Champ something that breaks Round One's conduct rule (${category}). They were warned the first time, on ${count === 1 ? "an earlier occasion" : `${count} earlier occasions`}.\n\nWhat they asked:\n"${clip(who.question, 1000)}"\n\nChamp refused it. The chat: ${link}\n\nNothing has been said to anyone else.`;
    for (const addr of to) { const r = await sendEmail(addr, `Champ conduct flag: ${who.staffName}`, body); told ||= r.ok; }
  }
  await db().from("champ_flags").insert({ staff_id: who.staffId, staff_name: who.staffName, chat_id: who.chatId, category, question: clip(who.question, 2000), manager_told: told });
  return first
    ? "FIRST WARNING. Refuse. Tell them this kind of question isn't acceptable at Round One, and that if it happens again a manager will be told."
    : told
      ? "A MANAGER HAS BEEN TOLD. Refuse. Tell them this isn't acceptable at Round One and that, as they were warned, a manager has now been told."
      : "Refuse. Tell them this isn't acceptable at Round One and that it has been recorded for a manager to see.";
}

export async function runTool(name: string, input: Block, ctx: Ctx = new Ctx()): Promise<unknown> {
  const now = ctx.now;
  const num = (v: unknown, d: number, max = 1000) => Math.min(max, Math.max(1, Math.round(Number(v) || d)));
  switch (name) {
    case "find_people": {
      const s = await ctx.state();
      const q = String(input.query ?? "").trim().toLowerCase();
      if (!q) throw new Error("Give a name, email or phone");
      const digits = q.replace(/\D/g, "");
      const words = q.split(/\s+/);
      const hits = s.contacts.filter((c) => {
        if (digits.length >= 6 && c.phone && waNumber(c.phone).endsWith(waNumber(digits).slice(-9))) return true;
        const hay = `${c.name} ${c.email}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      const rank = (c: Contact) => (c.membership?.status === "active" ? 0 : c.membership ? 1 : 2);
      hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      return { matches: hits.length, people: hits.slice(0, num(input.limit, 10, 25)).map((c) => summary(c, s, now)) };
    }
    case "person_details": {
      const s = await ctx.state();
      const c = findContact(s, String(input.contact_id));
      const msgs = s.messages.filter((m) => m.contactId === c.id).slice(-15);
      const evs = s.events.filter((e) => e.contactId === c.id).slice(0, 20);
      const days = await inactiveDays().catch(() => 20);
      const advice = inactivityAdvice(c, now, days);
      return {
        ...summary(c, s, now),
        unpaidInvoices: c.membership?.owed?.invoices?.map((i) => ({ due: i.due, amount: `£${i.amount.toFixed(2)}`, status: i.status === "retry_failed" ? "card retries failed" : "unpaid" })),
        attendanceDaysLast60: c.activity?.days,
        lapsedAdvice: advice ? { priority: advice.priority, reason: advice.reason, suggestedAction: advice.action } : undefined,
        safety: c.safety ? { waiverSigned: ukDay(c.safety.waiverSignedAt) ?? "NO", waiver: c.safety.waiverName, emergencyContact: c.safety.emergencyName || c.safety.emergencyPhone ? { name: c.safety.emergencyName, phone: c.safety.emergencyPhone, relationship: c.safety.emergencyRelationship } : "none on file", dateOfBirth: c.safety.dateOfBirth } : "not synced",
        questionnaire: c.answers.length ? c.answers.map((a) => `${a.question}: ${a.answer}`) : undefined,
        trialAt: uk(c.trialAt), lostReason: c.lostReason, tags: c.tags.length ? c.tags : undefined,
        adAttribution: c.ad || c.campaign ? { campaign: c.campaign, adSet: c.adset, ad: c.ad } : undefined,
        accountability: c.accountability ? { active: c.accountability.active, sessionsAWeekFloor: c.accountability.floor, stretch: c.accountability.stretch, goals: c.accountability.goals, why: c.accountability.why, checkInSlot: c.accountability.slot, recentCheckins: c.accountability.checkins?.slice(0, 3).map((k) => ({ week: k.week, feel: k.feel, blocker: k.blocker, plan: k.play })) } : undefined,
        whatTheyveToldUs: c.insight?.summary,
        trials: s.appointments.filter((a) => a.contactId === c.id).map((a) => ({ at: uk(a.start), status: a.status })),
        openTasks: s.tasks.filter((t) => t.contactId === c.id && !t.done).map((t) => clip(t.text, 200)),
        recentMessages: msgs.map((m) => ({ at: uk(m.at), from: m.dir === "in" ? c.name : m.by ?? "Round One", text: clip(m.text, 300), status: m.status })),
        history: evs.map((e) => ({ at: uk(e.at), what: clip(e.detail, 160) })),
      };
    }
    case "list_members": {
      const s = await ctx.state();
      const status = String(input.status ?? "active");
      const cat = String(input.category ?? "").toLowerCase();
      const days = await inactiveDays().catch(() => 20);
      let list = s.contacts.filter((c) => c.membership && (status === "any" || c.membership.status === status) && (!cat || `${c.membership.category} ${c.membership.name}`.toLowerCase().includes(cat)));
      const f = String(input.filter ?? "");
      const m30 = now - 30 * 86400e3;
      if (f === "lapsed") list = list.filter((c) => inactivityAdvice(c, now, days));
      if (f === "no_waiver") list = list.filter((c) => c.safety && !c.safety.waiverSignedAt);
      if (f === "no_emergency_contact") list = list.filter((c) => c.safety && !(c.safety.emergencyPhone || c.safety.emergencyName));
      if (f === "owes") list = list.filter((c) => c.membership?.owed || (c.membership?.paymentRetries ?? 0) > 0);
      if (f === "gave_notice") list = list.filter((c) => c.membership?.cancelling && c.membership.status !== "ended");
      if (f === "ending_soon") list = list.filter((c) => c.membership?.endsAt && Date.parse(c.membership.endsAt) >= now && Date.parse(c.membership.endsAt) - now < 14 * 86400e3);
      if (f === "on_accountability") list = list.filter((c) => c.accountability?.active);
      if (f === "not_been_in_60_days") list = list.filter((c) => c.activity && !c.activity.lastSeenAt);
      if (f === "new_last_30_days") list = list.filter((c) => c.membership?.startedAt && Date.parse(c.membership.startedAt) >= m30);
      const sort = String(input.sort ?? (f === "lapsed" ? "last_in" : "name"));
      const t = (iso?: string) => (iso ? Date.parse(iso) : 0);
      list.sort((a, b) => sort === "last_in" ? t(a.activity?.lastSeenAt) - t(b.activity?.lastSeenAt) : sort === "joined" ? t(b.membership?.startedAt) - t(a.membership?.startedAt) : sort === "ends" ? (t(a.membership?.endsAt) || Infinity) - (t(b.membership?.endsAt) || Infinity) : a.name.localeCompare(b.name));
      const limit = num(input.limit, 40, 150);
      return {
        total: list.length, showing: Math.min(limit, list.length), lapsedThresholdDays: f === "lapsed" ? days : undefined,
        members: list.slice(0, limit).map((c) => {
          const a = f === "lapsed" ? inactivityAdvice(c, now, days) : null;
          const x = summary(c, s, now);
          return { id: x.id, name: x.name, phone: x.phone, membership: x.membership?.name, status: x.membership?.status, lastIn: x.lastIn, sessionsLast30Days: x.sessionsLast30Days, waiverSigned: x.waiverSigned, owes: x.membership?.owes, failedPaymentAttempts: x.membership?.failedPaymentAttempts, gaveNotice: x.membership?.gaveNotice, endsOrRenews: x.membership?.endsOrRenews, coach: x.coach, ...(a ? { priority: a.priority, why: a.reason } : {}) };
        }),
      };
    }
    case "member_numbers": {
      const s = await ctx.state();
      const days = await inactiveDays().catch(() => 20);
      const ms = s.contacts.filter((c) => c.membership);
      const active = ms.filter((c) => c.membership!.status === "active");
      const m30 = now - 30 * 86400e3;
      const byCat: Record<string, number> = {};
      for (const c of active) byCat[c.membership!.category] = (byCat[c.membership!.category] ?? 0) + 1;
      return {
        activeMembers: active.length, byCategory: byCat, onHold: ms.filter((c) => c.membership!.status === "on_hold").length,
        joinedLast30Days: ms.filter((c) => c.membership!.startedAt && Date.parse(c.membership!.startedAt) >= m30).length,
        endedLast30Days: ms.filter((c) => c.membership!.status === "ended" && c.membership!.endsAt && Date.parse(c.membership!.endsAt) >= m30 && Date.parse(c.membership!.endsAt) <= now).length,
        gaveNotice: active.filter((c) => c.membership!.cancelling).length,
        lapsed: active.filter((c) => inactivityAdvice(c, now, days)).length, lapsedThresholdDays: days,
        noWaiver: active.filter((c) => c.safety && !c.safety.waiverSignedAt).length,
      };
    }
    case "list_leads": {
      const s = await ctx.state();
      const since = input.since_days ? now - num(input.since_days, 30, 3650) * 86400e3 : 0;
      const list = s.contacts.filter((c) => !c.membership && c.source !== "teamup" && (!input.stage || c.stage === input.stage) && (!input.source || c.source === input.source) && Date.parse(c.createdAt) >= since)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const limit = num(input.limit, 30, 100);
      return { total: list.length, leads: list.slice(0, limit).map((c) => ({ id: c.id, name: c.name, phone: c.phone || undefined, stage: stageLabel(c.stage), source: sourceLabel(c.source), ad: c.ad, added: ukDay(c.createdAt), trialAt: uk(c.trialAt), lostReason: c.lostReason })) };
    }
    case "pipeline_overview": {
      const s = await ctx.state();
      const since = now - num(input.since_days, 30, 3650) * 86400e3;
      const leads = s.contacts.filter((c) => c.source !== "teamup" && Date.parse(c.createdAt) >= since);
      const count = (k: (c: Contact) => string) => leads.reduce<Record<string, number>>((o, c) => ((o[k(c)] = (o[k(c)] ?? 0) + 1), o), {});
      return { period: `last ${num(input.since_days, 30, 3650)} days`, newLeads: leads.length, byStage: count((c) => stageLabel(c.stage)), bySource: count((c) => sourceLabel(c.source)), trialsComing: s.appointments.filter((a) => Date.parse(a.start) >= now && a.status !== "cancelled").length };
    }
    case "trials": {
      const s = await ctx.state();
      const from = now - num(input.days_back, 7, 365) * 86400e3, to = now + num(input.days_ahead, 14, 365) * 86400e3;
      const list = s.appointments.filter((a) => Date.parse(a.start) >= from && Date.parse(a.start) <= to).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      return { trials: list.map((a) => { const c = s.contacts.find((x) => x.id === a.contactId); return { at: uk(a.start), status: a.status, name: c?.name, contactId: a.contactId, phone: c?.phone || undefined }; }) };
    }
    case "classes": {
      if (!teamupConfigured()) throw new Error("TeamUp isn't connected");
      const from = dateArg(input.date_from as string, now), to = dateArg((input.date_to as string) ?? from, now);
      const nameQ = String(input.name_contains ?? "").toLowerCase();
      const evs = (await teamupEvents()).filter((e) => { const d = e.startsAt ? ukParts(Date.parse(e.startsAt)).date : ""; return d >= from && d <= to && (!nameQ || e.name.toLowerCase().includes(nameQ)); })
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return { from, to, classes: evs.slice(0, 120).map((e) => ({ id: e.id, name: e.name, starts: uk(e.startsAt), ends: uk(e.endsAt)?.slice(-5), booked: e.booked, waiting: e.waiting || undefined, capacity: e.capacity ?? "no limit", cancelled: e.status === "cancelled" || undefined })) };
    }
    case "class_attendees": {
      if (!teamupConfigured()) throw new Error("TeamUp isn't connected");
      const id = String(input.event_id ?? "").replace(/\D/g, "");
      const [page, s] = await Promise.all([fetchJson("/attendances", { event: id, page_size: "100" }) as Promise<Block>, ctx.state()]);
      const ev = (await teamupEvents()).find((e) => e.id === id);
      const rows = (page.results as Block[]) ?? [];
      const people = await Promise.all(rows.map(async (a) => {
        const cid = String(a.customer ?? "");
        const c = s.contacts.find((x) => (x.teamup?.customerId ?? x.membership?.customerId) === cid);
        let name = c?.name;
        if (!name) { const cu = (await fetchJson(`/customers/${cid}`).catch(() => ({}))) as Block; name = `${cu.first_name ?? ""} ${cu.last_name ?? ""}`.trim() || `TeamUp customer ${cid}`; }
        return { name, contactId: c?.id, status: String(a.status ?? ""), waiverSigned: c?.safety ? (c.safety.waiverSignedAt ? "yes" : "NO") : undefined };
      }));
      return { class: ev ? `${ev.name}, ${uk(ev.startsAt)}` : `event ${id}`, count: people.length, people };
    }
    case "person_classes": {
      const s = await ctx.state();
      const c = findContact(s, String(input.contact_id));
      const cid = c.teamup?.customerId ?? c.membership?.customerId;
      if (!cid) return { note: `${c.name} has no TeamUp account in the CRM, so there are no class bookings to read.` };
      const rows = await fetchAttendance(cid, now - num(input.days_back, 60, 730) * 86400e3);
      rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      return { name: c.name, bookings: rows.slice(0, 80).map((r) => ({ class: r.event, at: uk(r.at), status: r.status })) };
    }
    case "person_door_entries": {
      if (!kisiConfigured()) throw new Error("Kisi isn't connected");
      const s = await ctx.state();
      const c = findContact(s, String(input.contact_id));
      if (!c.email) return { note: `${c.name} has no email in the CRM, and Kisi is matched on email.` };
      const kid = await kisiMemberId(c.email);
      if (!kid) return { note: `No Kisi user with ${c.email}. They may use a different email in Kisi, or have no fob.` };
      const entries = await kisiEntries(kid, now - num(input.days_back, 30, 89) * 86400e3);
      entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      return { name: c.name, entries: entries.length, list: entries.slice(0, 60).map((e) => uk(e.at)) };
    }
    case "who_is_in_now": {
      const r = await whoIsIn(1.5);
      return { classesOnNow: r.classes.map((c) => `${c.name} ${uk(c.startsAt)}`), people: r.people.map((p) => ({ name: p.name, contactId: p.contactId, cameIn: p.via.map((v) => (v.kind === "class" ? `${v.event} (${v.status})` : `door ${uk(v.at)?.slice(-5)}`)), missing: p.missing.length ? p.missing : undefined, spokenToToday: p.checkedAt ? true : undefined, emergencyContact: p.emergency?.phone ? `${p.emergency.name ?? ""} ${p.emergency.phone}`.trim() : undefined })) };
    }
    case "class_popularity": {
      const r = await classStats();
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return { since: ukDay(r.since), slots: r.classes.map((c) => ({ class: c.name, slot: `${day[c.weekday]} ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`, sessions: c.sessions, averageTickedIn: c.avg, fillPercent: c.fill })) };
    }
    case "flag_conduct":
      return await flagConduct(input, ctx);
    case "teamup_lookup": {
      if (!teamupConfigured()) throw new Error("TeamUp isn't connected");
      const path = String(input.path ?? "").trim().replace(/\/+$/, "");
      if (!TEAMUP_ALLOWED.test(path)) throw new Error(`Not an allowed TeamUp path: ${path}. Payments and invoices aren't available here; use person_details for a member's payments.`);
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries((input.params as Block) ?? {})) if (TEAMUP_PARAMS.has(k)) params[k] = String(v);
      if (!/\/\d+$/.test(path)) params.page_size = String(Math.min(100, Number(params.page_size) || 50));
      return stripUrls(await fetchJson(path, params));
    }
  }
  throw new Error(`Unknown tool ${name}`);
}

// ---------------------------------------------------------------- the loop

async function facts(): Promise<string> {
  const { data } = await db().from("settings").select("value").eq("id", "gym_facts").maybeSingle();
  return typeof data?.value === "string" && data.value.trim() ? data.value : "(No facts sheet yet.)";
}

async function callClaude(messages: ChampMessage[], factsSheet: string, knowledge: string, final: boolean): Promise<{ content: Block[]; stop_reason: string; usage?: Block }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json",
      // Server-side fallback: if a safety check declines, the API retries on a suitable model in the same call.
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: CHAMP_MODEL,
      max_tokens: 8000,
      // The prompt, facts and knowledge are the same for every question, so they're cached for an hour.
      system: knowledge
        ? [{ type: "text", text: SYSTEM }, { type: "text", text: `FACTS SHEET\n\n${factsSheet}` }, { type: "text", text: `ROUND ONE'S OWN KNOWLEDGE\n\n${knowledge}`, cache_control: { type: "ephemeral", ttl: "1h" } }]
        : [{ type: "text", text: SYSTEM }, { type: "text", text: `FACTS SHEET\n\n${factsSheet}`, cache_control: { type: "ephemeral", ttl: "1h" } }],
      tools: TOOLS,
      // On the last step Champ answers with what it has rather than looking up more.
      tool_choice: final ? { type: "none" } : { type: "auto" },
      output_config: { effort: "medium" },
      fallbacks: "default",
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { content: Block[]; stop_reason: string; usage?: Block };
  return j;
}

const textOf = (content: Block[]) => content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n").trim();

/**
 * One question. `history` is the chat so far, exactly as saved. Returns the
 * new messages to save (the question, each assistant step and each set of
 * tool results, in order), the answer text and the look-ups made.
 */
export async function askChamp(history: ChampMessage[], question: string, staffName: string, who?: { staffId: string; chatId: string }): Promise<{ added: ChampMessage[]; answer: string; tools: string[] }> {
  if (!champConfigured()) throw new Error("Champ isn’t set up yet (ANTHROPIC_API_KEY)");
  const ctx = new Ctx(who ? { ...who, staffName, question } : undefined);
  const p = ukParts(ctx.now);
  const nowLine = `[${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][p.weekday]} ${p.date}, ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} UK. Asked by ${staffName}.]`;
  const added: ChampMessage[] = [{ role: "user", content: [{ type: "text", text: `${nowLine}\n${question}` }] }];
  const [factsSheet, knowledge] = await Promise.all([facts(), knowledgeForChamp().catch(() => "")]);
  const tools: string[] = [];
  const t0 = Date.now();
  for (let step = 0; step < MAX_STEPS; step++) {
    const final = step === MAX_STEPS - 1 || Date.now() - t0 > TIME_LIMIT_MS;
    const r = await callClaude([...history, ...added], factsSheet, knowledge, final);
    added.push({ role: "assistant", content: r.content });
    if (r.usage) console.log("[champ] usage", JSON.stringify(r.usage));
    if (r.stop_reason === "refusal") return { added, answer: textOf(r.content) || "I can’t help with that one. Ask me about members, classes, training or sales.", tools };
    const calls = r.content.filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !calls.length) return { added, answer: textOf(r.content) || "Sorry, I lost my train of thought there. Try asking again.", tools };
    const results = await Promise.all(calls.map(async (b) => {
      tools.push(String(b.name));
      try {
        const out = JSON.stringify(await runTool(String(b.name), (b.input as Block) ?? {}, ctx));
        return { type: "tool_result", tool_use_id: b.id, content: out.length > MAX_TOOL_CHARS ? `${out.slice(0, MAX_TOOL_CHARS)}… [cut short: ask for fewer results]` : out };
      } catch (e) {
        return { type: "tool_result", tool_use_id: b.id, is_error: true, content: e instanceof Error ? e.message : String(e) };
      }
    }));
    added.push({ role: "user", content: results });
  }
  return { added, answer: textOf(added[added.length - 1].content) || "That took too long to look up. Try a narrower question.", tools };
}
