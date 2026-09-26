// Business operations that move a lead through the pipeline and fire automations.

import { AVAILABILITY, disqualifyReason } from "./config";
import { db, nowIso } from "./db";
import {
  findExistingLead,
  getAppointment,
  getLead,
  insertLead,
  logActivity,
  normalisePhone,
  upcomingAppointment,
  type Appointment,
  type Lead,
} from "./leads";
import { stageInfo, type StageKey } from "./stages";
import { isSlotAvailable } from "./availability";
import { onStageEntered, stopWorkflowsOnReply } from "./workflows";
import { formatSlot } from "./time";

export function setStage(leadId: number, stage: StageKey, opts: { appointmentId?: number; variant?: string; by?: string } = {}) {
  const lead = getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const now = nowIso();
  const d = db();
  if (lead.stage !== stage) {
    d.prepare("UPDATE leads SET stage = ?, stage_changed_at = ?, updated_at = ? WHERE id = ?").run(stage, now, now, leadId);
    d.prepare("INSERT INTO stage_history (lead_id, stage, at) VALUES (?, ?, ?)").run(leadId, stage, now);
    logActivity(leadId, "stage", `${stageInfo(lead.stage).label} → ${stageInfo(stage).label}${opts.by ? ` (${opts.by})` : ""}`);
  }
  onStageEntered(leadId, stage, { appointmentId: opts.appointmentId, variant: opts.variant });
}

export type QuestionnaireInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
  source?: string;
  campaign?: string | null;
  whatsapp_opt_in: boolean;
};

/** Workflow 0: questionnaire → CRM. Creates (or refreshes) the lead and returns it. */
export function submitQuestionnaire(input: QuestionnaireInput): { lead: Lead; qualified: boolean } {
  const phone = normalisePhone(input.phone);
  const email = input.email.trim().toLowerCase();
  const reason = disqualifyReason(input.answers);
  const qualified = reason === null;
  const existing = findExistingLead(email, phone);

  if (existing) {
    db()
      .prepare(
        `UPDATE leads SET first_name = ?, last_name = ?, email = ?, phone = ?, answers_json = ?, qualified = ?,
         disqualify_reason = ?, whatsapp_opt_in = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.first_name.trim(),
        input.last_name.trim(),
        email,
        phone,
        JSON.stringify(input.answers),
        qualified ? 1 : 0,
        reason,
        input.whatsapp_opt_in ? 1 : 0,
        nowIso(),
        existing.id,
      );
    logActivity(existing.id, "form", qualified ? "Re-submitted questionnaire (qualified)" : `Re-submitted questionnaire – not qualified: ${reason}`);
    // Only restart the booking push for leads that aren't already further along.
    if (qualified && ["lead", "unqualified", "missed", "did_not_convert"].includes(existing.stage)) setStage(existing.id, "lead", { by: "questionnaire" });
    return { lead: getLead(existing.id)!, qualified };
  }

  const lead = insertLead({
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email,
    phone,
    source: input.source || "Instagram",
    campaign: input.campaign,
    stage: qualified ? "lead" : "unqualified",
    qualified,
    disqualify_reason: reason,
    answers: input.answers,
    whatsapp_opt_in: input.whatsapp_opt_in,
  });
  logActivity(lead.id, "form", qualified ? "Submitted questionnaire – qualified" : `Submitted questionnaire – not qualified: ${reason}`);
  if (qualified) onStageEntered(lead.id, "lead");
  return { lead, qualified };
}

/** Books (or reschedules) a consultation. Returns an error message on failure. */
export function bookAppointment(leadId: number, startIso: string, opts: { by?: string; skipAvailabilityCheck?: boolean } = {}):
  | { ok: true; appointment: Appointment }
  | { ok: false; error: string } {
  const lead = getLead(leadId);
  if (!lead) return { ok: false, error: "Lead not found" };
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid time" };
  const iso = start.toISOString();

  const d = db();
  const run = d.transaction(() => {
    if (!opts.skipAvailabilityCheck && !isSlotAvailable(iso)) return null;
    const now = nowIso();
    const existing = upcomingAppointment(leadId);
    if (existing) {
      d.prepare("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, existing.id);
      logActivity(leadId, "booking", `Rescheduled from ${formatSlot(existing.starts_at)}`);
    }
    const end = new Date(start.getTime() + AVAILABILITY.slotMinutes * 60000).toISOString();
    const info = d
      .prepare("INSERT INTO appointments (lead_id, starts_at, ends_at, status, created_at, updated_at) VALUES (?, ?, ?, 'booked', ?, ?)")
      .run(leadId, iso, end, now, now);
    return Number(info.lastInsertRowid);
  });
  const id = run();
  if (!id) return { ok: false, error: "Sorry, that time has just been taken. Please pick another." };

  logActivity(leadId, "booking", `Consultation booked for ${formatSlot(iso)}${opts.by ? ` (${opts.by})` : ""}`);
  setStage(leadId, "booked", { appointmentId: id, by: opts.by });
  return { ok: true, appointment: getAppointment(id)! };
}

const STATUS_TO_STAGE: Partial<Record<Appointment["status"], StageKey>> = {
  confirmed: "confirmed",
  attended: "attended",
  no_show: "missed",
  cancelled: "missed",
};

export function setAppointmentStatus(appointmentId: number, status: Appointment["status"], by?: string) {
  const appt = getAppointment(appointmentId);
  if (!appt || appt.status === status) return;
  db().prepare("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), appointmentId);
  const label = { booked: "Booked", confirmed: "Confirmed", attended: "Attended", no_show: "No-show", cancelled: "Cancelled" }[status];
  logActivity(appt.lead_id, "booking", `Consultation on ${formatSlot(appt.starts_at)} marked ${label}${by ? ` (${by})` : ""}`);
  const stage = STATUS_TO_STAGE[status];
  if (stage) setStage(appt.lead_id, stage, { appointmentId, variant: status, by });
}

/** Lead replied YES on WhatsApp or pressed confirm on the booking page. */
export function confirmUpcoming(leadId: number, by: string): boolean {
  const appt = upcomingAppointment(leadId);
  if (!appt || appt.status !== "booked") return false;
  setAppointmentStatus(appt.id, "confirmed", by);
  return true;
}

/** Inbound WhatsApp/SMS message from a lead. */
export function handleInboundMessage(phone: string, text: string, channel = "WhatsApp"): Lead | undefined {
  const normalised = normalisePhone(phone);
  const lead = db().prepare("SELECT * FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1").get(normalised) as Lead | undefined;
  if (!lead) return undefined;
  const now = nowIso();
  db().prepare("UPDATE leads SET last_inbound_at = ?, updated_at = ? WHERE id = ?").run(now, now, lead.id);
  logActivity(lead.id, "message_in", `${channel}: ${text}`);
  if (/^\s*(yes|yep|yeah|y|confirm(ed)?)\b/i.test(text) && confirmUpcoming(lead.id, `replied "${text.trim().slice(0, 20)}"`)) {
    return lead;
  }
  stopWorkflowsOnReply(lead.id);
  return lead;
}
