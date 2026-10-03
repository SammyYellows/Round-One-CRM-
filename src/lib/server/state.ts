// Loads the whole CRM from Supabase as a State (the same shape the prototype
// kept in the browser), and saves back only the rows an engine function
// changed. Server-only. At a gym's scale (thousands of contacts, not
// millions) loading everything per request is fine; pages can move to
// targeted queries later if it gets slow.

import { tick } from "@/lib/engine";
import { ActionArgs, ActionName, runAction } from "@/lib/actions";
import {
  Ad, Appointment, Automation, CalendarDef, Campaign, Contact, CrmEvent, Form, Message, Run, Staff, State, Task, isSold,
} from "@/lib/types";
import { afterResponse } from "./background";
import { deliver } from "./deliver";
import { db } from "./supabase";

type Row = Record<string, unknown>;

// How long back the dashboard and ad reporting look.
const EVENTS_KEPT = 2000;
const AD_DAYS = 30;

const opt = <T,>(v: unknown) => (v === null || v === undefined ? undefined : (v as T));

// ---- Rows ↔ State ---------------------------------------------------------

const contactFrom = (r: Row): Contact => ({
  id: r.id as string,
  name: r.name as string,
  phone: r.phone as string,
  email: r.email as string,
  source: r.source as Contact["source"],
  campaign: opt(r.campaign),
  adset: opt(r.adset),
  ad: opt(r.ad),
  adId: opt(r.ad_id),
  stage: r.stage as Contact["stage"],
  lostReason: opt(r.lost_reason),
  tags: (r.tags as string[]) ?? [],
  answers: (r.answers as Contact["answers"]) ?? [],
  trialAt: opt(r.trial_at),
  createdAt: r.created_at as string,
  ...(r.membership ? { membership: r.membership as Contact["membership"] } : {}),
  ...(r.marketing_opt_out ? { marketingOptOut: true } : {}),
});
const contactTo = (c: Contact): Row => ({
  id: c.id, name: c.name, phone: c.phone, email: c.email, source: c.source,
  campaign: c.campaign ?? null, adset: c.adset ?? null, ad: c.ad ?? null, ad_id: c.adId ?? null,
  stage: c.stage, lost_reason: c.lostReason ?? null, tags: c.tags, answers: c.answers,
  trial_at: c.trialAt ?? null, created_at: c.createdAt,
  membership: c.membership ?? null, marketing_opt_out: !!c.marketingOptOut,
});

const messageFrom = (r: Row): Message => ({
  id: r.id as string, contactId: r.contact_id as string, dir: r.dir as Message["dir"], text: r.text as string,
  template: opt(r.template), by: opt(r.by), at: r.at as string, status: opt(r.status), error: opt(r.error),
});
// New outgoing messages are saved as queued; deliver.ts sends them and Meta's
// webhook moves them on to sent, delivered, read or failed.
const messageTo = (m: Message): Row => ({
  id: m.id, contact_id: m.contactId, dir: m.dir, text: m.text, template: m.template ?? null, by: m.by ?? null, at: m.at,
  status: m.dir === "in" ? "received" : "queued",
});

const eventFrom = (r: Row): CrmEvent => {
  const data = r.data as Record<string, string> | null;
  return {
    id: r.id as string, type: r.type as CrmEvent["type"], contactId: opt(r.contact_id), detail: r.detail as string, at: r.at as string,
    ...(data && Object.keys(data).length ? { data } : {}),
  };
};
const eventTo = (e: CrmEvent): Row => ({ id: e.id, type: e.type, contact_id: e.contactId ?? null, detail: e.detail, data: e.data ?? {}, at: e.at });

const automationFrom = (r: Row): Automation => ({
  id: r.id as string, name: r.name as string, summary: r.summary as string, enabled: r.enabled as boolean,
  trigger: r.trigger as Automation["trigger"], steps: r.steps as Automation["steps"], runs: r.runs as number,
  ...(r.stop_on_reply ? { stopOnReply: true } : {}),
});
const automationTo = (a: Automation): Row => ({
  id: a.id, name: a.name, summary: a.summary, enabled: a.enabled, trigger: a.trigger, steps: a.steps, runs: a.runs,
  stop_on_reply: !!a.stopOnReply,
});

const runFrom = (r: Row): Run => ({
  id: r.id as string, automationId: r.automation_id as string, contactId: r.contact_id as string, stepIndex: r.step_index as number,
  status: r.status as Run["status"], resumeAt: opt(r.resume_at), startedAt: r.started_at as string,
});
const runTo = (r: Run): Row => ({
  id: r.id, automation_id: r.automationId, contact_id: r.contactId, step_index: r.stepIndex, status: r.status,
  resume_at: r.resumeAt ?? null, started_at: r.startedAt,
});

const formFrom = (r: Row): Form => ({
  id: r.id as string, slug: r.slug as string, name: r.name as string, questions: r.questions as Form["questions"],
  thanks: r.thanks as string, responses: r.responses as number,
  thanksTitle: opt(r.thanks_title), bookButton: opt(r.book_button),
});
const formTo = (f: Form): Row => ({
  id: f.id, slug: f.slug, name: f.name, questions: f.questions, thanks: f.thanks, responses: f.responses,
  thanks_title: f.thanksTitle ?? null, book_button: f.bookButton ?? null,
});

const taskFrom = (r: Row): Task => ({
  id: r.id as string, contactId: opt(r.contact_id), text: r.text as string, done: r.done as boolean, at: r.at as string,
});
const taskTo = (t: Task): Row => ({ id: t.id, contact_id: t.contactId ?? null, text: t.text, done: t.done, at: t.at });

const apptFrom = (r: Row): Appointment => ({
  id: r.id as string, contactId: r.contact_id as string, calendarId: r.calendar_id as string, staffId: (r.staff_id as string) ?? "",
  start: r.start as string, end: r.end as string, status: r.status as Appointment["status"], notes: opt(r.notes),
  createdAt: r.created_at as string,
});
const apptTo = (a: Appointment): Row => ({
  id: a.id, contact_id: a.contactId, calendar_id: a.calendarId, staff_id: a.staffId || null, start: a.start, end: a.end,
  status: a.status, notes: a.notes ?? null, created_at: a.createdAt,
});

const calendarFrom = (r: Row): CalendarDef => ({
  id: r.id as string, name: r.name as string, durationMin: r.duration_min as number, style: r.style as CalendarDef["style"],
  bookTrial: r.book_trial as boolean, availability: opt(r.availability),
});
const calendarTo = (c: CalendarDef): Row => ({
  id: c.id, name: c.name, duration_min: c.durationMin, style: c.style, book_trial: !!c.bookTrial, availability: c.availability ?? null,
});
const staffFrom = (r: Row): Staff => ({ id: r.id as string, name: r.name as string, role: r.role as string });

// ---- Load ------------------------------------------------------------------

type Query = ReturnType<ReturnType<ReturnType<typeof db>["from"]>["select"]>;

async function all(table: string, build: (q: Query) => Query = (q) => q) {
  const { data, error } = await build(db().from(table).select("*"));
  if (error) throw new Error(`Loading ${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Meta ads with spend from the nightly sync, and trials/sales counted from the CRM. */
function buildCampaigns(ads: Row[], insights: Row[], contacts: Contact[], appts: Appointment[]): Campaign[] {
  const byCampaign = new Map<string, Campaign>();
  for (const r of ads) {
    const adId = r.ad_id as string;
    const spend = insights.filter((i) => i.ad_id === adId);
    const people = contacts.filter((c) => c.adId === adId);
    const trialled = people.filter((c) => appts.some((a) => a.contactId === c.id && a.status !== "cancelled"));
    const ad: Ad = {
      id: adId,
      name: r.name as string,
      adset: (r.adset as string) ?? "",
      format: ((r.format as Ad["format"]) ?? "image"),
      spend: spend.reduce((n, i) => n + Number(i.spend), 0),
      impressions: spend.reduce((n, i) => n + Number(i.impressions), 0),
      clicks: spend.reduce((n, i) => n + Number(i.clicks), 0),
      leads: spend.reduce((n, i) => n + Number(i.leads), 0) || people.length,
      trials: trialled.length,
      sold: people.filter((c) => isSold(c.stage)).length,
    };
    const utm = (r.campaign_utm as string) || (r.campaign as string) || "other";
    const k = byCampaign.get(utm) ?? { name: (r.campaign as string) || utm, utm, ads: [] };
    k.ads.push(ad);
    byCampaign.set(utm, k);
  }
  return [...byCampaign.values()];
}

export async function loadState(): Promise<State> {
  const since = new Date(Date.now() - AD_DAYS * 86400e3).toISOString().slice(0, 10);
  const [contacts, messages, events, automations, runs, forms, tasks, calendars, staff, appts, templates, ads, insights, settings] = await Promise.all([
    all("contacts", (q) => q.order("created_at", { ascending: false })),
    all("messages", (q) => q.order("at", { ascending: true })),
    all("events", (q) => q.order("at", { ascending: false }).limit(EVENTS_KEPT)),
    all("automations", (q) => q.order("created_at", { ascending: true })),
    all("runs", (q) => q.order("started_at", { ascending: false })),
    all("forms", (q) => q.order("created_at", { ascending: true })),
    all("tasks", (q) => q.order("at", { ascending: false })),
    all("calendars"),
    all("staff", (q) => q.eq("active", true).order("created_at", { ascending: true })),
    all("appointments", (q) => q.order("start", { ascending: true })),
    all("templates"),
    all("ads"),
    all("ad_insights_daily", (q) => q.gte("day", since)),
    all("settings"),
  ]);
  const cs = contacts.map(contactFrom);
  const as = appts.map(apptFrom);
  return {
    version: 7,
    seededAt: new Date(0).toISOString(), // no made-up history: every day is counted from real data
    history: [],
    clockOffset: 0,
    contacts: cs,
    messages: messages.map(messageFrom),
    events: events.map(eventFrom),
    automations: automations.map(automationFrom),
    runs: runs.map(runFrom),
    forms: forms.map(formFrom),
    tasks: tasks.map(taskFrom),
    templates: Object.fromEntries(templates.map((t) => [t.name as string, t.body as string])),
    campaigns: buildCampaigns(ads, insights, cs, as),
    calendars: calendars.map(calendarFrom),
    staff: staff.map(staffFrom),
    appointments: as,
    quickReplies: (settings.find((r) => r.id === "quick_replies")?.value as string[] | undefined) ?? [],
  };
}

// ---- Save ------------------------------------------------------------------

type Table<T extends { id: string }> = { table: string; pick: (s: State) => T[]; to: (x: T) => Row; appendOnly?: boolean };

// Each table's rows are compared by id, so any row type with an id will do.
const table = <T extends { id: string }>(t: Table<T>) => t as unknown as Table<{ id: string }>;

// Saved in two rounds, in foreign-key order: the rows others point at
// (contacts, automations, calendars), then the rows that point at them. Each
// round's tables are written at the same time.
const ROUNDS = [
  [
    table({ table: "contacts", pick: (s) => s.contacts, to: contactTo }),
    table({ table: "forms", pick: (s) => s.forms, to: formTo }),
    table({ table: "automations", pick: (s) => s.automations, to: automationTo }),
    table({ table: "calendars", pick: (s) => s.calendars, to: calendarTo }),
  ],
  [
    table({ table: "appointments", pick: (s) => s.appointments, to: apptTo }),
    table({ table: "runs", pick: (s) => s.runs, to: runTo }),
    table({ table: "tasks", pick: (s) => s.tasks, to: taskTo }),
    table({ table: "messages", pick: (s) => s.messages, to: messageTo, appendOnly: true }),
    table({ table: "events", pick: (s) => s.events, to: eventTo, appendOnly: true }),
  ],
];

async function saveTable(t: Table<{ id: string }>, before: State, after: State) {
  const old = new Map(t.pick(before).map((x) => [x.id, JSON.stringify(t.to(x))]));
  const changed = t
    .pick(after)
    .filter((x) => (t.appendOnly ? !old.has(x.id) : old.get(x.id) !== JSON.stringify(t.to(x))))
    .map(t.to);
  if (!changed.length) return;
  const { error } = t.appendOnly ? await db().from(t.table).insert(changed) : await db().from(t.table).upsert(changed);
  if (error) throw new Error(`Saving ${t.table}: ${error.message}`);
}

/** Shared settings, one row each in the settings table. */
async function saveSettings(before: State, after: State) {
  if (JSON.stringify(before.quickReplies) === JSON.stringify(after.quickReplies)) return;
  const { error } = await db().from("settings").upsert({ id: "quick_replies", value: after.quickReplies, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Saving settings: ${error.message}`);
}

/** Writes every row that is new or different in `after`. Nothing is ever deleted. */
export async function saveChanges(before: State, after: State) {
  for (const round of ROUNDS) await Promise.all(round.map((t) => saveTable(t, before, after)));
  await saveSettings(before, after);
}

/** Load, run one named change (plus any automation steps now due), save. */
export async function applyAction<N extends ActionName>(name: N, args: ActionArgs<N>, check?: (s: State) => void): Promise<State> {
  const before = await loadState();
  const after = structuredClone(before);
  check?.(before); // throws to refuse the change, e.g. a slot that's just been taken
  runAction(after, name, args);
  tick(after);
  await saveChanges(before, after);
  // Reply now; emails and WhatsApps finish sending in the background.
  await afterResponse(deliver(before, after));
  return after;
}

/**
 * Load, run a pure change written for the server (e.g. the TeamUp import,
 * which touches many contacts at once), save, deliver. Returns what it did.
 */
export async function applyMany<T>(fn: (s: State) => T): Promise<T> {
  const before = await loadState();
  const after = structuredClone(before);
  const result = fn(after);
  tick(after);
  await saveChanges(before, after);
  await afterResponse(deliver(before, after));
  return result;
}

/** Load, run any automation steps that have come due, save if anything moved. */
export async function loadAndTick(): Promise<State> {
  const before = await loadState();
  const after = structuredClone(before);
  tick(after);
  await saveChanges(before, after);
  await afterResponse(deliver(before, after));
  return after;
}
