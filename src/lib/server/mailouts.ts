// Mailouts (docs/mailouts.md): one email to many people, picked from the
// CRM's contacts (TeamUp members and ex-members, old trial leads). Server-
// only. Staff write it, send themselves a test, then press Send and confirm;
// the CRM queues one row per person and works through the queue in the
// background and from the 5-minute scheduler, inside Resend's daily
// allowance. Every email carries an unsubscribe link; anyone opted out or
// bounced is skipped.
//
// WhatsApp mailouts (Sammy, 13/10/2026) work the same way with one approved
// template instead of a subject and message: one queued row per mobile
// number, sent through the engine (so each lands in the person's thread),
// a few dozen every 5 minutes inside WHATSAPP_MAILOUT_DAILY_LIMIT, because
// Meta caps how many new people a number can message a day. Opted-out
// people are skipped.

import { fill, placeholders, sendTemplate, setMarketingOptOut, templateParams } from "@/lib/engine";
import { waNumber } from "@/lib/phone";
import { GYM } from "@/lib/gym";
import { Contact, Membership, STAGES, Stage } from "@/lib/types";
import { unsubscribeFooter, unsubscribeHeaders, unsubscribeLink } from "./deliver";
import { enquiriesFrom } from "./enquiries";
import { sendEmail } from "./email";
import { sendTemplate as sendWhatsAppTemplate } from "./whatsapp";
import { applyMany } from "./state";
import { db } from "./supabase";

export interface Audience {
  /** Which members: current, ended, both, or none (leads only). */
  membership: "any" | "active" | "ended" | "none";
  /** TeamUp categories to include; empty means all. */
  categories: string[];
  /** For ended memberships: only those that ended within this many days. */
  endedWithinDays?: number;
  /** Pipeline stages of non-member leads to include; empty means no leads. */
  leadStages: Stage[];
  /** TeamUp customers who never had a membership (old enquiries, free-class sign-ups). */
  neverJoined?: boolean;
  /** For those: only people who came in within this many days. */
  cameInWithinDays?: number;
  /** Anyone who has chatted with the gym on WhatsApp (in the CRM or before, in GymGrow). */
  chattedOnWhatsApp?: boolean;
}

export type Channel = "email" | "whatsapp";

export type MailoutStatus = "draft" | "sending" | "sent";
export type RecipientStatus = "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed";

export interface Mailout {
  id: string;
  channel: Channel;
  /** WhatsApp mailouts: the approved template that goes. */
  template: string | null;
  subject: string;
  body: string;
  audience: Audience;
  status: MailoutStatus;
  createdAt: string;
  createdBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  counts: Record<RecipientStatus, number> & { total: number };
}

type Row = Record<string, unknown>;

/** Resend's free plan allows 100 emails a day across everything; keep room for the automations. */
export const dailyLimit = () => {
  const n = Number(process.env.MAILOUT_DAILY_LIMIT ?? 80);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
};

/** WhatsApp: a new number may message about 250 new people a day; stay under it. */
export const whatsappDailyLimit = () => {
  const n = Number(process.env.WHATSAPP_MAILOUT_DAILY_LIMIT ?? 200);
  return Number.isFinite(n) && n > 0 ? n : 200;
};
const WA_PER_RUN = 40; // each one goes through the engine and a save, so keep a run short

const BATCH = 100; // Resend's batch endpoint takes up to 100 emails
const PER_RUN = 300; // at most three batches per call, well inside a function's time

export const emptyAudience = (): Audience => ({ membership: "active", categories: [], leadStages: [] });

function normaliseAudience(a: Partial<Audience> | null | undefined): Audience {
  const stageIds = new Set(STAGES.map((s) => s.id));
  return {
    membership: a?.membership === "any" || a?.membership === "ended" || a?.membership === "none" ? a.membership : "active",
    categories: Array.isArray(a?.categories) ? a!.categories.filter((x): x is string => typeof x === "string").slice(0, 20) : [],
    endedWithinDays: typeof a?.endedWithinDays === "number" && a.endedWithinDays > 0 ? Math.round(a.endedWithinDays) : undefined,
    leadStages: Array.isArray(a?.leadStages) ? a!.leadStages.filter((x): x is Stage => stageIds.has(x as Stage)) : [],
    neverJoined: a?.neverJoined === true,
    cameInWithinDays: typeof a?.cameInWithinDays === "number" && a.cameInWithinDays > 0 ? Math.round(a.cameInWithinDays) : undefined,
    chattedOnWhatsApp: a?.chattedOnWhatsApp === true,
  };
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Pick { id: string; name: string; email: string; phone: string; source: string; stage: Stage; trialAt?: string; membership: Membership | null; teamup?: boolean; createdAt?: string }

async function allContacts(channel: Channel = "email"): Promise<Pick[]> {
  const out: Pick[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = db()
      .from("contacts")
      .select("id, name, email, phone, source, stage, trial_at, membership, teamup, created_at, marketing_opt_out, email_bounced")
      .eq("marketing_opt_out", false)
      .is("removed", null);
    if (channel === "email") q = q.eq("email_bounced", false);
    const { data, error } = await q.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading contacts: ${error.message}`);
    for (const r of data as Row[]) {
      out.push({
        id: r.id as string, name: (r.name as string) ?? "", email: ((r.email as string) ?? "").trim().toLowerCase(), phone: (r.phone as string) ?? "",
        source: r.source as string, stage: r.stage as Stage, trialAt: (r.trial_at as string) ?? undefined, membership: (r.membership as Membership | null) ?? null,
        teamup: !!r.teamup, createdAt: (r.created_at as string) ?? undefined,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Everyone who has a WhatsApp conversation with the gym, in the CRM or from GymGrow. */
async function whatsappChatters(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const table of ["messages", "gymgrow_messages"] as const) {
    for (let from = 0; ; from += 1000) {
      let q = db().from(table).select("contact_id");
      if (table === "gymgrow_messages") q = q.eq("channel", "whatsapp");
      const { data, error } = await q.range(from, from + 999);
      if (error) throw new Error(`Loading WhatsApp chats: ${error.message}`);
      for (const r of data as Row[]) if (r.contact_id) ids.add(r.contact_id as string);
      if (!data || data.length < 1000) break;
    }
  }
  return ids;
}

/** Who a mailout would go to right now: one row per email address (or, for WhatsApp, per mobile number). */
export async function resolveAudience(input: Partial<Audience>, channel: Channel = "email"): Promise<Pick[]> {
  const a = normaliseAudience(input);
  const now = Date.now();
  const seen = new Set<string>();
  const out: Pick[] = [];
  const chatters = a.chattedOnWhatsApp ? await whatsappChatters() : null;
  for (const c of await allContacts(channel)) {
    const key = channel === "whatsapp" ? waNumber(c.phone) : c.email;
    if ((channel === "whatsapp" ? key.length < 10 : !EMAIL_OK.test(c.email)) || seen.has(key)) continue;
    const m = c.membership;
    let wanted = !!chatters?.has(c.id);
    if (wanted) {
      // already in, as someone who has chatted on WhatsApp
    } else if (m && a.membership !== "none") {
      const active = m.status === "active" || m.status === "on_hold";
      const ended = m.status === "ended";
      const recentEnough = !a.endedWithinDays || !m.endsAt || now - Date.parse(m.endsAt) <= a.endedWithinDays * 86400e3;
      const statusOk = a.membership === "any" ? active || (ended && recentEnough) : a.membership === "active" ? active : ended && recentEnough;
      const categoryOk = a.categories.length === 0 || a.categories.includes(m.category);
      wanted = statusOk && categoryOk;
    } else if (!m && c.teamup) {
      const recent = !a.cameInWithinDays || !c.createdAt || now - Date.parse(c.createdAt) <= a.cameInWithinDays * 86400e3;
      wanted = !!a.neverJoined && recent;
    } else if (!m && a.leadStages.length) {
      wanted = c.source !== "teamup" && a.leadStages.includes(c.stage);
    }
    if (!wanted) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function membershipCategories(): Promise<string[]> {
  const { data } = await db().from("contacts").select("membership->>category").not("membership", "is", null);
  return [...new Set(((data as Row[] | null) ?? []).map((r) => r.category as string).filter(Boolean))].sort();
}

// ---- Mailouts -------------------------------------------------------------

const mailoutFrom = (r: Row, counts: Mailout["counts"]): Mailout => ({
  id: r.id as string, channel: r.channel === "whatsapp" ? "whatsapp" : "email", template: (r.template as string) ?? null, subject: (r.subject as string) ?? "", body: (r.body as string) ?? "", audience: normaliseAudience(r.audience as Partial<Audience>),
  status: r.status as MailoutStatus, createdAt: r.created_at as string, createdBy: (r.created_by as string) ?? null,
  startedAt: (r.started_at as string) ?? null, finishedAt: (r.finished_at as string) ?? null, counts,
});

const zeroCounts = (): Mailout["counts"] => ({ total: 0, queued: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 });

async function countsFor(ids: string[]): Promise<Map<string, Mailout["counts"]>> {
  const map = new Map<string, Mailout["counts"]>();
  if (!ids.length) return map;
  const { data, error } = await db().from("mailout_recipients").select("mailout_id, status").in("mailout_id", ids);
  if (error) throw new Error(`Counting recipients: ${error.message}`);
  for (const r of data as Row[]) {
    const id = r.mailout_id as string;
    const c = map.get(id) ?? zeroCounts();
    c.total++;
    c[r.status as RecipientStatus]++;
    map.set(id, c);
  }
  return map;
}

export async function listMailouts(): Promise<Mailout[]> {
  const { data, error } = await db().from("mailouts").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Loading mailouts: ${error.message}`);
  const rows = data as Row[];
  const counts = await countsFor(rows.map((r) => r.id as string));
  return rows.map((r) => mailoutFrom(r, counts.get(r.id as string) ?? zeroCounts()));
}

export async function getMailout(id: string): Promise<Mailout | null> {
  const { data, error } = await db().from("mailouts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Loading mailout: ${error.message}`);
  if (!data) return null;
  const counts = await countsFor([id]);
  return mailoutFrom(data as Row, counts.get(id) ?? zeroCounts());
}

export async function createMailout(input: { subject: string; body: string; audience: Partial<Audience>; channel?: Channel; template?: string | null }, by: string) {
  const id = crypto.randomUUID();
  const channel: Channel = input.channel === "whatsapp" ? "whatsapp" : "email";
  const { error } = await db().from("mailouts").insert({ id, channel, template: channel === "whatsapp" ? input.template ?? null : null, subject: input.subject.slice(0, 200), body: input.body.slice(0, 20000), audience: normaliseAudience(input.audience), created_by: by });
  if (error) throw new Error(`Saving mailout: ${error.message}`);
  return id;
}

export async function updateMailout(id: string, input: { subject?: string; body?: string; audience?: Partial<Audience>; template?: string | null }) {
  const m = await getMailout(id);
  if (!m || m.status !== "draft") return false;
  const patch: Row = {};
  if (typeof input.subject === "string") patch.subject = input.subject.slice(0, 200);
  if (typeof input.body === "string") patch.body = input.body.slice(0, 20000);
  if (input.audience) patch.audience = normaliseAudience(input.audience);
  if (m.channel === "whatsapp" && (typeof input.template === "string" || input.template === null)) patch.template = input.template;
  const { error } = await db().from("mailouts").update(patch).eq("id", id);
  if (error) throw new Error(`Saving mailout: ${error.message}`);
  return true;
}

export async function deleteMailout(id: string) {
  const m = await getMailout(id);
  if (!m || m.status !== "draft") return false;
  await db().from("mailouts").delete().eq("id", id);
  return true;
}

// ---- The email itself ----------------------------------------------------

/** The text one person receives: their placeholders filled, with the unsubscribe line. */
export function renderBody(body: string, c: Pick) {
  const contact = { ...c, tags: [], answers: [], createdAt: "" } as unknown as Contact;
  const main = fill(body, contact).replace(/\{unsubscribe\}/g, unsubscribeLink(c.id));
  return main.trimEnd() + unsubscribeFooter(c.id);
}

const headersFor = unsubscribeHeaders;

/** Sends the mailout to one staff address, filled in as if for the first recipient (or the staff member). */
export async function sendTest(id: string, to: string, staffName: string) {
  const m = await getMailout(id);
  if (!m) return { ok: false as const, error: "That mailout isn’t there any more" };
  const sample = (await resolveAudience(m.audience))[0];
  const asIf: Pick = sample ?? { id: "test", name: staffName, email: to, phone: "", source: "walk_in", stage: "new", membership: null };
  const res = await sendEmail(to, `[Test] ${m.subject || "(no subject)"}`, renderBody(m.body, asIf), { from: enquiriesFrom(), headers: headersFor(asIf.id) });
  return res.ok ? { ok: true as const, dryRun: res.dryRun, asIf: asIf.name } : { ok: false as const, error: res.error };
}

/** Sends a WhatsApp mailout's template to one mobile (a staff member's), filled in as if for the first recipient. Not recorded on any contact. */
export async function sendWhatsAppTest(id: string, to: string) {
  const m = await getMailout(id);
  if (!m || m.channel !== "whatsapp" || !m.template) return { ok: false as const, error: "Pick the template first" };
  const mobile = waNumber(to);
  if (mobile.length < 10) return { ok: false as const, error: "That mobile number doesn’t look right" };
  const { data: t } = await db().from("templates").select("name, body, language, header_video, button_url").eq("name", m.template).maybeSingle();
  if (!t) return { ok: false as const, error: `No template called ${m.template}` };
  const sample = (await resolveAudience(m.audience, "whatsapp"))[0];
  const v = placeholders({ ...(sample ?? { id: "test", name: "Sam Taylor", email: "", phone: mobile, source: "walk_in", stage: "new" }), tags: [], answers: [], createdAt: "" } as unknown as Contact);
  const row = t as Row;
  const res = await sendWhatsAppTemplate(mobile, {
    name: row.name as string, language: (row.language as string) || "en_GB",
    params: templateParams(row.body as string).map((k) => v[k] ?? k),
    videoUrl: row.header_video ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${row.header_video}` : undefined,
    buttonParam: (row.button_url as string | null)?.includes("{{1}}") ? (sample?.id ?? "test") : undefined,
  });
  return res.ok ? { ok: true as const, dryRun: res.dryRun, asIf: sample?.name } : { ok: false as const, error: res.error };
}

/** WhatsApp templates a mailout can use: approved, from the templates table. */
export async function whatsappTemplates() {
  const { data, error } = await db().from("templates").select("name, body, category, meta_status, button_text").order("name");
  if (error) throw new Error(`Loading templates: ${error.message}`);
  return (data as Row[]).map((t) => ({ name: t.name as string, body: t.body as string, category: t.category as string, status: (t.meta_status as string) ?? "draft", button: (t.button_text as string) ?? null }));
}

/** Staff pressed Send and confirmed: queue everyone, then start working through it. */
export async function startMailout(id: string, staffName: string) {
  const m = await getMailout(id);
  if (!m) return { ok: false as const, error: "That mailout isn’t there any more" };
  if (m.status !== "draft") return { ok: false as const, error: "This mailout has already been sent" };
  if (m.channel === "whatsapp") return startWhatsAppMailout(m, staffName);
  if (!m.subject.trim() || !m.body.trim()) return { ok: false as const, error: "It needs a subject and a message" };
  const people = await resolveAudience(m.audience);
  if (!people.length) return { ok: false as const, error: "Nobody matches this audience" };
  const now = new Date().toISOString();
  const rows = people.map((p) => ({ id: crypto.randomUUID(), mailout_id: id, contact_id: p.id, email: p.email }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("mailout_recipients").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Queueing recipients: ${error.message}`);
  }
  const { error } = await db().from("mailouts").update({ status: "sending", started_at: now, created_by: m.createdBy ?? staffName }).eq("id", id);
  if (error) throw new Error(`Starting mailout: ${error.message}`);
  const first = await drainQueue();
  return { ok: true as const, queued: people.length, ...first };
}

async function startWhatsAppMailout(m: Mailout, staffName: string) {
  if (!m.template) return { ok: false as const, error: "Pick the WhatsApp template to send" };
  const t = (await whatsappTemplates()).find((x) => x.name === m.template);
  if (!t) return { ok: false as const, error: `No template called ${m.template}` };
  if (t.status !== "approved") return { ok: false as const, error: `${m.template} isn’t approved by Meta yet` };
  const people = await resolveAudience(m.audience, "whatsapp");
  if (!people.length) return { ok: false as const, error: "Nobody with a mobile number matches this audience" };
  const rows = people.map((p) => ({ id: crypto.randomUUID(), mailout_id: m.id, contact_id: p.id, phone: waNumber(p.phone) }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("mailout_recipients").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Queueing recipients: ${error.message}`);
  }
  const { error } = await db().from("mailouts").update({ status: "sending", started_at: new Date().toISOString(), created_by: m.createdBy ?? staffName }).eq("id", m.id);
  if (error) throw new Error(`Starting mailout: ${error.message}`);
  const first = await drainWhatsApp();
  return { ok: true as const, queued: people.length, ...first };
}

/** Start of today (UK) in UTC, for the daily allowances. */
function ukDayStart() {
  const uk = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // yyyy-mm-dd
  const start = new Date(`${uk}T00:00:00`);
  const offsetMin = (new Date(start.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime() - start.getTime()) / 60000;
  return new Date(start.getTime() - offsetMin * 60000).toISOString();
}

/** How many mailout emails (or WhatsApps) have gone today (UK day), for the daily allowance. */
async function sentToday(channel: Channel = "email") {
  const q = db().from("mailout_recipients").select("id", { count: "exact", head: true }).gte("sent_at", ukDayStart()).neq("status", "queued");
  const { count, error } = await (channel === "whatsapp" ? q.not("phone", "is", null) : q.is("phone", null));
  if (error) throw new Error(`Counting today’s sends: ${error.message}`);
  return count ?? 0;
}

/** Are there emails waiting? Cheap check for the scheduler. */
export async function queuedCount() {
  const { count } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).eq("status", "queued").is("phone", null);
  return count ?? 0;
}

/**
 * Sends the next batch of queued emails, within today's allowance. Called
 * right after Send, and by /api/cron every 5 minutes until the queue is
 * empty. Each row is marked sent (with Resend's id) or failed.
 */
export async function drainQueue() {
  const limit = dailyLimit();
  const room = limit === Infinity ? PER_RUN : Math.min(PER_RUN, Math.max(0, limit - (await sentToday())));
  if (room <= 0) return { sent: 0, waitingForTomorrow: true };
  const { data, error } = await db().from("mailout_recipients").select("id, mailout_id, contact_id, email").eq("status", "queued").is("phone", null).order("mailout_id").limit(room);
  if (error) throw new Error(`Reading the queue: ${error.message}`);
  const queue = data as Row[];
  if (!queue.length) return { sent: 0 };

  const mailoutIds = [...new Set(queue.map((r) => r.mailout_id as string))];
  const { data: mrows } = await db().from("mailouts").select("id, subject, body").in("id", mailoutIds);
  const mailouts = new Map((mrows as Row[]).map((r) => [r.id as string, r]));
  const contactIds = [...new Set(queue.map((r) => r.contact_id as string))];
  const { data: crows } = await db().from("contacts").select("id, name, email, phone, source, stage, trial_at, membership").in("id", contactIds);
  const contacts = new Map((crows as Row[]).map((r) => [r.id as string, r]));

  const key = process.env.RESEND_API_KEY;
  const from = enquiriesFrom();
  let sent = 0;
  for (let i = 0; i < queue.length; i += BATCH) {
    const slice = queue.slice(i, i + BATCH);
    const emails = slice.map((r) => {
      const m = mailouts.get(r.mailout_id as string)!;
      const c = contacts.get(r.contact_id as string)!;
      const pick: Pick = { id: c.id as string, name: (c.name as string) ?? "", email: r.email as string, phone: (c.phone as string) ?? "", source: c.source as string, stage: c.stage as Stage, trialAt: (c.trial_at as string) ?? undefined, membership: (c.membership as Membership | null) ?? null };
      return { from, to: r.email as string, subject: m.subject as string, text: renderBody(m.body as string, pick), headers: headersFor(pick.id) };
    });
    const now = new Date().toISOString();
    if (!key) {
      for (const e of emails) console.log(`[mailout dry run] to ${e.to}: ${e.subject}`);
      await Promise.all(slice.map((r) => db().from("mailout_recipients").update({ status: "sent", sent_at: now, updated_at: now, resend_id: null }).eq("id", r.id)));
      sent += slice.length;
      continue;
    }
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(emails),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string }[]; message?: string };
      if (!res.ok || !json.data) throw new Error(json.message || `Resend said ${res.status}`);
      await Promise.all(slice.map((r, k) => db().from("mailout_recipients").update({ status: "sent", sent_at: now, updated_at: now, resend_id: json.data![k]?.id ?? null }).eq("id", r.id)));
      sent += slice.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[mailout] batch failed", msg);
      await Promise.all(slice.map((r) => db().from("mailout_recipients").update({ status: "failed", error: msg.slice(0, 300), updated_at: now }).eq("id", r.id)));
    }
  }

  // Any mailout with nothing left queued is finished.
  for (const id of mailoutIds) {
    const { count } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).eq("mailout_id", id).eq("status", "queued");
    if (!count) await db().from("mailouts").update({ status: "sent", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "sending");
  }
  return { sent, remaining: Math.max(0, queue.length - sent) };
}

/**
 * Sends the next few queued WhatsApps, within today's allowance. Each goes
 * through the engine as an ordinary template send by "Mailout", so it shows
 * in the person's thread and Meta's delivery updates land on it. Called
 * right after Send and by /api/cron every 5 minutes until the queue is empty.
 */
export async function drainWhatsApp() {
  const room = Math.min(WA_PER_RUN, Math.max(0, whatsappDailyLimit() - (await sentToday("whatsapp"))));
  if (room <= 0) return { sent: 0, waitingForTomorrow: true };
  const { data, error } = await db().from("mailout_recipients").select("id, mailout_id, contact_id").eq("status", "queued").not("phone", "is", null).order("mailout_id").limit(room);
  if (error) throw new Error(`Reading the WhatsApp queue: ${error.message}`);
  const queue = data as Row[];
  if (!queue.length) return { sent: 0 };
  const mailoutIds = [...new Set(queue.map((r) => r.mailout_id as string))];
  const { data: mrows } = await db().from("mailouts").select("id, template").in("id", mailoutIds);
  const templateFor = new Map((mrows as Row[]).map((r) => [r.id as string, r.template as string]));
  const outcome = new Map<string, string | null>(); // row id -> error, or null when handed over
  await applyMany((s) => {
    for (const r of queue) {
      const c = s.contacts.find((x) => x.id === r.contact_id && !x.removed);
      const t = templateFor.get(r.mailout_id as string);
      if (!c) { outcome.set(r.id as string, "Contact no longer in the CRM"); continue; }
      if (c.marketingOptOut) { outcome.set(r.id as string, "Opted out"); continue; }
      if (!t || !s.templates[t]) { outcome.set(r.id as string, `No template called ${t}`); continue; }
      sendTemplate(s, c, t, "Mailout");
      outcome.set(r.id as string, null);
    }
  });
  const now = new Date().toISOString();
  let sent = 0;
  await Promise.all(queue.map((r) => {
    const err = outcome.get(r.id as string);
    if (err === null) sent++;
    return db().from("mailout_recipients").update(err === null ? { status: "sent", sent_at: now, updated_at: now } : { status: "failed", error: err ?? "Not sent", updated_at: now }).eq("id", r.id);
  }));
  for (const id of mailoutIds) {
    const { count } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).eq("mailout_id", id).eq("status", "queued");
    if (!count) await db().from("mailouts").update({ status: "sent", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "sending");
  }
  return { sent };
}

/** Are there WhatsApps waiting? Cheap check for the scheduler. */
export async function whatsappQueuedCount() {
  const { count } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).eq("status", "queued").not("phone", "is", null);
  return count ?? 0;
}

// ---- What Resend tells us afterwards --------------------------------------

const RANK: Record<RecipientStatus, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4, failed: 5, bounced: 6, complained: 7 };

/** A delivery event from Resend's webhook, matched to a recipient by email id. */
export async function recordDeliveryEvent(type: string, emailId: string) {
  const status = ({ "email.delivered": "delivered", "email.opened": "opened", "email.clicked": "clicked", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed" } as Record<string, RecipientStatus | undefined>)[type];
  if (!status) return;
  const { data } = await db().from("mailout_recipients").select("id, contact_id, status").eq("resend_id", emailId).maybeSingle();
  if (!data) return; // not a mailout email (e.g. an automation email)
  if (RANK[status] > RANK[data.status as RecipientStatus]) {
    await db().from("mailout_recipients").update({ status, updated_at: new Date().toISOString() }).eq("id", data.id);
  }
  if (status === "bounced") await db().from("contacts").update({ email_bounced: true }).eq("id", data.contact_id);
  if (status === "complained") await applyMany((s) => setMarketingOptOut(s, data.contact_id as string, true, "marked as spam"));
}

/** Someone clicked the unsubscribe link (or their mail app did, one-click). */
export async function unsubscribe(contactId: string) {
  const { data } = await db().from("contacts").select("id").eq("id", contactId).maybeSingle();
  if (!data) return false;
  await applyMany((s) => setMarketingOptOut(s, contactId, true, "unsubscribe link"));
  return true;
}
