import crypto from "node:crypto";
import { db, nowIso } from "./db";
import type { StageKey } from "./stages";

export type Lead = {
  id: number;
  token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  campaign: string | null;
  stage: StageKey;
  value_pence: number;
  qualified: number;
  disqualify_reason: string | null;
  answers_json: string;
  whatsapp_opt_in: number;
  sms_fallback: number;
  last_inbound_at: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
};

export type Appointment = {
  id: number;
  lead_id: number;
  starts_at: string;
  ends_at: string;
  status: "booked" | "confirmed" | "attended" | "no_show" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type AppointmentWithLead = Appointment & { first_name: string; last_name: string; phone: string; stage: StageKey };

export type Activity = { id: number; lead_id: number; type: string; body: string; created_at: string };

export const fullName = (l: { first_name: string; last_name: string }) => `${l.first_name} ${l.last_name}`.trim();

/** Normalise UK phone numbers to E.164 (+44...). */
export function normalisePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("07")) p = "+44" + p.slice(1);
  if (p.startsWith("447")) p = "+" + p;
  if (!p.startsWith("+") && p.length > 0) p = "+" + p;
  return p;
}

export function getLead(id: number): Lead | undefined {
  return db().prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
}

export function getLeadByToken(token: string): Lead | undefined {
  return db().prepare("SELECT * FROM leads WHERE token = ?").get(token) as Lead | undefined;
}

export function findExistingLead(email: string, phone: string): Lead | undefined {
  return db()
    .prepare("SELECT * FROM leads WHERE (phone != '' AND phone = ?) OR (email != '' AND lower(email) = lower(?)) ORDER BY id DESC LIMIT 1")
    .get(phone, email) as Lead | undefined;
}

export function listLeads(opts: { stage?: string; q?: string; limit?: number } = {}): Lead[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.stage) {
    where.push("stage = ?");
    args.push(opts.stage);
  }
  if (opts.q) {
    where.push("(first_name || ' ' || last_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
    const like = `%${opts.q}%`;
    args.push(like, like, like);
  }
  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY stage_changed_at DESC LIMIT ?`;
  return db().prepare(sql).all(...args, opts.limit ?? 500) as Lead[];
}

export function insertLead(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  campaign?: string | null;
  stage: StageKey;
  qualified: boolean;
  disqualify_reason?: string | null;
  answers?: Record<string, string>;
  whatsapp_opt_in?: boolean;
  created_at?: string;
}): Lead {
  const now = data.created_at ?? nowIso();
  const token = crypto.randomBytes(12).toString("base64url");
  const info = db()
    .prepare(
      `INSERT INTO leads (token, first_name, last_name, email, phone, source, campaign, stage, qualified, disqualify_reason,
        answers_json, whatsapp_opt_in, created_at, updated_at, stage_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      token,
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.source,
      data.campaign ?? null,
      data.stage,
      data.qualified ? 1 : 0,
      data.disqualify_reason ?? null,
      JSON.stringify(data.answers ?? {}),
      data.whatsapp_opt_in === false ? 0 : 1,
      now,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  db().prepare("INSERT INTO stage_history (lead_id, stage, at) VALUES (?, ?, ?)").run(id, data.stage, now);
  return getLead(id)!;
}

export function updateLeadFields(
  id: number,
  fields: Partial<Pick<Lead, "first_name" | "last_name" | "email" | "phone" | "source" | "value_pence" | "whatsapp_opt_in">>,
) {
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  db()
    .prepare(`UPDATE leads SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), nowIso(), id);
}

export function logActivity(leadId: number, type: string, body: string, at = nowIso()) {
  db().prepare("INSERT INTO activities (lead_id, type, body, created_at) VALUES (?, ?, ?, ?)").run(leadId, type, body, at);
}

export function listActivities(leadId: number): Activity[] {
  return db().prepare("SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC, id DESC").all(leadId) as Activity[];
}

export function getAppointment(id: number): Appointment | undefined {
  return db().prepare("SELECT * FROM appointments WHERE id = ?").get(id) as Appointment | undefined;
}

export function leadAppointments(leadId: number): Appointment[] {
  return db().prepare("SELECT * FROM appointments WHERE lead_id = ? ORDER BY starts_at DESC").all(leadId) as Appointment[];
}

/** The lead's next appointment that is still going ahead. */
export function upcomingAppointment(leadId: number): Appointment | undefined {
  return db()
    .prepare(
      "SELECT * FROM appointments WHERE lead_id = ? AND status IN ('booked','confirmed') AND ends_at >= ? ORDER BY starts_at LIMIT 1",
    )
    .get(leadId, nowIso()) as Appointment | undefined;
}

export function appointmentsBetween(fromIso: string, toIso: string): AppointmentWithLead[] {
  return db()
    .prepare(
      `SELECT a.*, l.first_name, l.last_name, l.phone, l.stage FROM appointments a JOIN leads l ON l.id = a.lead_id
       WHERE a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at`,
    )
    .all(fromIso, toIso) as AppointmentWithLead[];
}
