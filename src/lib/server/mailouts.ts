// Mailouts (docs/mailouts.md): one email to many people, picked from the
// CRM's contacts (TeamUp members and ex-members, old trial leads). Server-
// only. Staff write it, send themselves a test, then press Send and confirm;
// the CRM queues one row per person and works through the queue in the
// background and from the 5-minute scheduler, inside Resend's daily
// allowance. Every email carries an unsubscribe link; anyone opted out or
// bounced is skipped.

import { fill, setMarketingOptOut } from "@/lib/engine";
import { GYM } from "@/lib/gym";
import { Contact, Membership, STAGES, Stage } from "@/lib/types";
import { appUrl } from "./deliver";
import { enquiriesFrom } from "./enquiries";
import { sendEmail } from "./email";
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
}

export type MailoutStatus = "draft" | "sending" | "sent";
export type RecipientStatus = "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed";

export interface Mailout {
  id: string;
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
  };
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Pick { id: string; name: string; email: string; phone: string; source: string; stage: Stage; trialAt?: string; membership: Membership | null }

async function allContacts(): Promise<Pick[]> {
  const out: Pick[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from("contacts")
      .select("id, name, email, phone, source, stage, trial_at, membership, marketing_opt_out, email_bounced")
      .eq("marketing_opt_out", false)
      .eq("email_bounced", false)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading contacts: ${error.message}`);
    for (const r of data as Row[]) {
      out.push({
        id: r.id as string, name: (r.name as string) ?? "", email: ((r.email as string) ?? "").trim().toLowerCase(), phone: (r.phone as string) ?? "",
        source: r.source as string, stage: r.stage as Stage, trialAt: (r.trial_at as string) ?? undefined, membership: (r.membership as Membership | null) ?? null,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Who a mailout would go to right now: one row per email address. */
export async function resolveAudience(input: Partial<Audience>): Promise<Pick[]> {
  const a = normaliseAudience(input);
  const now = Date.now();
  const seen = new Set<string>();
  const out: Pick[] = [];
  for (const c of await allContacts()) {
    if (!EMAIL_OK.test(c.email) || seen.has(c.email)) continue;
    const m = c.membership;
    let wanted = false;
    if (m && a.membership !== "none") {
      const active = m.status === "active" || m.status === "on_hold";
      const ended = m.status === "ended";
      const recentEnough = !a.endedWithinDays || !m.endsAt || now - Date.parse(m.endsAt) <= a.endedWithinDays * 86400e3;
      const statusOk = a.membership === "any" ? active || (ended && recentEnough) : a.membership === "active" ? active : ended && recentEnough;
      const categoryOk = a.categories.length === 0 || a.categories.includes(m.category);
      wanted = statusOk && categoryOk;
    } else if (!m && a.leadStages.length) {
      wanted = c.source !== "teamup" && a.leadStages.includes(c.stage);
    }
    if (!wanted) continue;
    seen.add(c.email);
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
  id: r.id as string, subject: (r.subject as string) ?? "", body: (r.body as string) ?? "", audience: normaliseAudience(r.audience as Partial<Audience>),
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

export async function createMailout(input: { subject: string; body: string; audience: Partial<Audience> }, by: string) {
  const id = crypto.randomUUID();
  const { error } = await db().from("mailouts").insert({ id, subject: input.subject.slice(0, 200), body: input.body.slice(0, 20000), audience: normaliseAudience(input.audience), created_by: by });
  if (error) throw new Error(`Saving mailout: ${error.message}`);
  return id;
}

export async function updateMailout(id: string, input: { subject?: string; body?: string; audience?: Partial<Audience> }) {
  const m = await getMailout(id);
  if (!m || m.status !== "draft") return false;
  const patch: Row = {};
  if (typeof input.subject === "string") patch.subject = input.subject.slice(0, 200);
  if (typeof input.body === "string") patch.body = input.body.slice(0, 20000);
  if (input.audience) patch.audience = normaliseAudience(input.audience);
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

export const unsubscribeLink = (contactId: string) => `${appUrl()}/u/${contactId}`;

/** The text one person receives: their placeholders filled, with the unsubscribe line. */
export function renderBody(body: string, c: Pick) {
  const contact = { ...c, tags: [], answers: [], createdAt: "" } as unknown as Contact;
  const main = fill(body, contact).replace(/\{unsubscribe\}/g, unsubscribeLink(c.id));
  const footer = `\n\n—\nYou’re getting this because you’re a member of ${GYM.name} or have been in touch with us. To stop these emails: ${unsubscribeLink(c.id)}`;
  return main.trimEnd() + footer;
}

const headersFor = (contactId: string) => ({
  "List-Unsubscribe": `<${unsubscribeLink(contactId)}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/** Sends the mailout to one staff address, filled in as if for the first recipient (or the staff member). */
export async function sendTest(id: string, to: string, staffName: string) {
  const m = await getMailout(id);
  if (!m) return { ok: false as const, error: "That mailout isn’t there any more" };
  const sample = (await resolveAudience(m.audience))[0];
  const asIf: Pick = sample ?? { id: "test", name: staffName, email: to, phone: "", source: "walk_in", stage: "new", membership: null };
  const res = await sendEmail(to, `[Test] ${m.subject || "(no subject)"}`, renderBody(m.body, asIf), { from: enquiriesFrom(), headers: headersFor(asIf.id) });
  return res.ok ? { ok: true as const, dryRun: res.dryRun, asIf: asIf.name } : { ok: false as const, error: res.error };
}

/** Staff pressed Send and confirmed: queue everyone, then start working through it. */
export async function startMailout(id: string, staffName: string) {
  const m = await getMailout(id);
  if (!m) return { ok: false as const, error: "That mailout isn’t there any more" };
  if (m.status !== "draft") return { ok: false as const, error: "This mailout has already been sent" };
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

/** How many mailout emails have gone today (UK day), for the daily allowance. */
async function sentToday() {
  const uk = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // yyyy-mm-dd
  const start = new Date(`${uk}T00:00:00`);
  const offsetMin = (new Date(start.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime() - start.getTime()) / 60000;
  const startUtc = new Date(start.getTime() - offsetMin * 60000).toISOString();
  const { count, error } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).gte("sent_at", startUtc).neq("status", "queued");
  if (error) throw new Error(`Counting today’s sends: ${error.message}`);
  return count ?? 0;
}

/** Are there emails waiting? Cheap check for the scheduler. */
export async function queuedCount() {
  const { count } = await db().from("mailout_recipients").select("id", { count: "exact", head: true }).eq("status", "queued");
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
  const { data, error } = await db().from("mailout_recipients").select("id, mailout_id, contact_id, email").eq("status", "queued").order("mailout_id").limit(room);
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
