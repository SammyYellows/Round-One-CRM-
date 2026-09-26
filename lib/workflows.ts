// Automations: a code version of the GymGrow workflows.
//
// Entering a pipeline stage removes the lead from any other active workflow and
// enrols them in the workflow for that stage (see STAGE_RULES). Enrolling
// schedules every step's WhatsApp message; a background ticker sends them when due.

import { db, nowIso } from "./db";
import { APP_URL, GYM } from "./config";
import { getAppointment, getLead, logActivity, type Appointment, type Lead } from "./leads";
import type { StageKey } from "./stages";
import { formatSlot, formatTime, outsideQuietHours } from "./time";
import { sendTemplate } from "./whatsapp";
import { sendSms } from "./sms";
import { sendEmail } from "./email";

type Delay = { afterMinutes: number } | { beforeAppointmentMinutes: number };

export type Channel = "whatsapp" | "email" | "internal";

export type Step = {
  key: string;
  delay: Delay;
  // whatsapp: falls back to SMS automatically if WhatsApp can't be delivered.
  // email: sent to the lead. internal: notification to the team (STAFF_EMAIL).
  channel: Channel;
  // WhatsApp template name registered with Meta (whatsapp steps only).
  template?: string;
  subject?: string;
  // Message text; {{placeholders}} become template parameters in order.
  text: string;
  // Only send on this branch (e.g. workflow 3: "cancelled" vs "no_show").
  variant?: string;
  // Kept for reference but not scheduled (mirrors steps disabled in GymGrow).
  disabled?: boolean;
};

export type Workflow = {
  key: string;
  number: number;
  name: string;
  trigger: string;
  // Stop the remaining messages as soon as the lead replies.
  stopOnReply?: boolean;
  steps: Step[];
};

const HOUR = 60;
const DAY = 24 * HOUR;

export const WORKFLOWS: Workflow[] = [
  {
    // Mirrors GymGrow: notify team → email → WhatsApp 1 → wait 2 days (reply ends it)
    // → WhatsApp 2 → wait 2 days → WhatsApp 3 → wait 2 days → end. Undelivered WhatsApp → SMS.
    key: "new_lead",
    number: 1,
    name: "New Lead – Booking Push",
    trigger: "Pipeline stage changed to Lead",
    stopOnReply: true,
    steps: [
      {
        key: "notify_team",
        delay: { afterMinutes: 0 },
        channel: "internal",
        subject: "New lead: {{full_name}}",
        text: "New qualified lead {{full_name}} ({{phone}}) just completed the questionnaire. {{crm_link}}",
      },
      {
        key: "email",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "You're eligible – book your free consultation at {{gym}}",
        text: "Hi {{first_name}},\n\nThanks for applying – great news, you're eligible for a free consultation at {{gym}}.\n\nPick a time that suits you here: {{booking_link}}\n\nSee you soon,\nThe {{gym}} team",
      },
      {
        key: "whatsapp_1",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_new_lead_1",
        text: "Hi {{first_name}}, it's the team at {{gym}} 🥊 Great news – you're eligible for a free consultation! Grab a time that suits you here: {{booking_link}}",
      },
      {
        key: "whatsapp_2",
        delay: { afterMinutes: 2 * DAY },
        channel: "whatsapp",
        template: "r1_new_lead_2",
        text: "Hey {{first_name}}, just checking you saw this – consultation spaces go quickly. Book yours here: {{booking_link}}",
      },
      {
        key: "whatsapp_3",
        delay: { afterMinutes: 4 * DAY },
        channel: "whatsapp",
        template: "r1_new_lead_3",
        text: "Last one from us {{first_name}} – is anything holding you back? Reply here with any questions, or pick a time: {{booking_link}}",
      },
    ],
  },
  {
    // Mirrors GymGrow: remove from other workflows → stage Booked → notify team → email
    // → WhatsApp 1 → wait → WhatsApp 2 → wait → WhatsApp 3 → end. Undelivered WhatsApp → SMS.
    key: "booked",
    number: 2,
    name: "Meeting Booked – Show-up Reminders",
    trigger: "Appointment booked",
    steps: [
      {
        key: "notify_team",
        delay: { afterMinutes: 0 },
        channel: "internal",
        subject: "Consultation booked: {{full_name}}",
        text: "{{full_name}} ({{phone}}) booked a consultation for {{appointment_time}}. {{crm_link}}",
      },
      {
        key: "email",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "You're booked in – {{appointment_time}}",
        text: "Hi {{first_name}},\n\nYou're booked in for your free consultation at {{gym}} on {{appointment_time}}.\n\nWear comfy clothes and bring some water. Need to change it? {{manage_link}}\n\nSee you soon,\nThe {{gym}} team",
      },
      {
        key: "whatsapp_1",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_booked_1",
        text: "You're booked in {{first_name}}! ✅ {{appointment_time}} at {{gym}}. Need to change it? {{manage_link}}",
      },
      {
        key: "whatsapp_2",
        delay: { beforeAppointmentMinutes: 1 * DAY },
        channel: "whatsapp",
        template: "r1_booked_2",
        text: "Hi {{first_name}}, looking forward to seeing you {{appointment_time}}. Please reply YES to confirm your spot.",
      },
      {
        key: "whatsapp_3",
        delay: { beforeAppointmentMinutes: 2 * HOUR },
        channel: "whatsapp",
        template: "r1_booked_3",
        text: "See you soon {{first_name}}! Your consultation is today at {{appointment_clock}}. Wear comfy clothes and bring water 💧",
      },
    ],
  },
  {
    // Mirrors GymGrow: triggered by stage Missed, appointment cancelled or appointment missed.
    // Condition: cancelled → cancelled email + WhatsApp; otherwise → no-show email + WhatsApp.
    key: "rebook",
    number: 3,
    name: "No-Show / Cancelled – Rebooking Push",
    trigger: "Stage changed to Missed, or appointment cancelled / missed",
    stopOnReply: true,
    steps: [
      {
        key: "email_cancelled",
        variant: "cancelled",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "Let's find you a new time",
        text: "Hi {{first_name}},\n\nNo problem at all about cancelling your consultation. Whenever you're ready, pick a new time here: {{booking_link}}\n\nThe {{gym}} team",
      },
      {
        key: "whatsapp_cancelled",
        variant: "cancelled",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_rebook_cancelled",
        text: "Hi {{first_name}}, no worries about cancelling! When you're ready, grab a new time for your free consultation here: {{booking_link}}",
      },
      {
        key: "email_no_show",
        variant: "no_show",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "Sorry we missed you!",
        text: "Hi {{first_name}},\n\nSorry we missed you today – life happens! Your free consultation is still available, just pick a new time here: {{booking_link}}\n\nThe {{gym}} team",
      },
      {
        key: "whatsapp_no_show",
        variant: "no_show",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_rebook_no_show",
        text: "Hi {{first_name}}, sorry we missed you! No worries – life happens. Pick a new time here: {{booking_link}}",
      },
    ],
  },
  {
    // Mirrors GymGrow: stage Attended → remove from other workflows → wait → WhatsApp (SMS if undelivered).
    key: "attended",
    number: 4,
    name: "Meeting Attended – Remove from other workflows, send follow-up",
    trigger: "Pipeline stage changed to Attended",
    steps: [
      {
        key: "whatsapp",
        delay: { afterMinutes: 2 * HOUR },
        channel: "whatsapp",
        template: "r1_attended_follow_up",
        text: "Great to meet you today {{first_name}}! 🥊 Any questions about the Intro Programme, just reply here.",
      },
    ],
  },
  {
    // Mirrors GymGrow: stage Intro Programme → notify team → email → WhatsApp 1 → wait 2 days
    // (reply ends it) → WhatsApp 2 (disabled in GymGrow). Undelivered WhatsApp → SMS.
    key: "intro",
    number: 5,
    name: "Intro Programme – Encourage Engagement",
    trigger: "Pipeline stage changed to Intro Programme",
    stopOnReply: true,
    steps: [
      {
        key: "notify_team",
        delay: { afterMinutes: 0 },
        channel: "internal",
        subject: "Intro Programme started: {{full_name}}",
        text: "{{full_name}} ({{phone}}) has started the Intro Programme. {{crm_link}}",
      },
      {
        key: "email",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "Welcome to the Intro Programme!",
        text: "Hi {{first_name}},\n\nWelcome to the Intro Programme at {{gym}} 🎉 Get your sessions booked in and let us know if you need anything at all.\n\nThe {{gym}} team",
      },
      {
        key: "whatsapp_1",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_intro_1",
        text: "Welcome to the Intro Programme {{first_name}}! 🎉 Book your sessions and let us know if you need anything.",
      },
      {
        key: "whatsapp_2",
        disabled: true,
        delay: { afterMinutes: 2 * DAY },
        channel: "whatsapp",
        template: "r1_intro_2",
        text: "How are you finding the first few sessions {{first_name}}? Feeling it in the shoulders yet? 😅",
      },
      {
        key: "whatsapp_3",
        disabled: true,
        delay: { afterMinutes: 4 * DAY },
        channel: "whatsapp",
        template: "r1_intro_3",
        text: "Hi {{first_name}}, your Intro Programme is flying by! Let's chat about the best membership to keep your progress going.",
      },
    ],
  },
  {
    // Mirrors GymGrow: stage Recurring → notify team → email → WhatsApp 1 → wait 2 days
    // (reply ends it) → WhatsApp 2/3 (disabled in GymGrow). Undelivered WhatsApp → SMS.
    key: "recurring",
    number: 6,
    name: "Recurring Member – Welcome",
    trigger: "Pipeline stage changed to Recurring",
    stopOnReply: true,
    steps: [
      {
        key: "notify_team",
        delay: { afterMinutes: 0 },
        channel: "internal",
        subject: "New recurring member: {{full_name}}",
        text: "{{full_name}} ({{phone}}) is now a recurring member 🎉 {{crm_link}}",
      },
      {
        key: "email",
        delay: { afterMinutes: 0 },
        channel: "email",
        subject: "Welcome to the {{gym}} family!",
        text: "Hi {{first_name}},\n\nWelcome to the {{gym}} family 🥊 We're proud to have you on board and can't wait to see your progress.\n\nThe {{gym}} team",
      },
      {
        key: "whatsapp_1",
        delay: { afterMinutes: 0 },
        channel: "whatsapp",
        template: "r1_member_welcome",
        text: "Welcome to the {{gym}} family {{first_name}}! 🥊 Proud to have you on board. Any questions, just reply here.",
      },
      {
        key: "whatsapp_2",
        disabled: true,
        delay: { afterMinutes: 2 * DAY },
        channel: "whatsapp",
        template: "r1_member_2",
        text: "Hi {{first_name}}, how are your first sessions as a member going? Anything we can help with?",
      },
      {
        key: "whatsapp_3",
        disabled: true,
        delay: { afterMinutes: 4 * DAY },
        channel: "whatsapp",
        template: "r1_member_3",
        text: "Hey {{first_name}}, loving seeing you in the gym! Don't forget to book your sessions for next week 🥊",
      },
    ],
  },
];

// What happens when a lead enters each stage.
const STAGE_RULES: Partial<Record<StageKey, { enrol?: string; keep?: string[] }>> = {
  lead: { enrol: "new_lead" },
  booked: { enrol: "booked" },
  confirmed: { keep: ["booked"] },
  missed: { enrol: "rebook" },
  attended: { enrol: "attended" },
  intro: { enrol: "intro" },
  recurring: { enrol: "recurring" },
};

export function getWorkflow(key: string) {
  return WORKFLOWS.find((w) => w.key === key);
}

type Context = { lead: Lead; appointment?: Appointment };

function variables({ lead, appointment }: Context): Record<string, string> {
  return {
    first_name: lead.first_name,
    full_name: `${lead.first_name} ${lead.last_name}`.trim(),
    phone: lead.phone,
    gym: GYM.name,
    booking_link: `${APP_URL}/book/${lead.token}`,
    manage_link: `${APP_URL}/book/${lead.token}`,
    crm_link: `${APP_URL}/admin/leads/${lead.id}`,
    appointment_time: appointment ? formatSlot(appointment.starts_at) : "",
    appointment_clock: appointment ? formatTime(appointment.starts_at) : "",
  };
}

function fill(template: string, vars: Record<string, string>, params?: string[]): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    params?.push(vars[name] ?? "");
    return vars[name] ?? "";
  });
}

export function renderStep(step: Step, ctx: Context): { text: string; subject: string; params: string[] } {
  const vars = variables(ctx);
  const params: string[] = [];
  const text = fill(step.text, vars, params);
  return { text, subject: step.subject ? fill(step.subject, vars) : "", params };
}

function sendTime(step: Step, enrolledAt: Date, appointment?: Appointment): Date | null {
  if ("afterMinutes" in step.delay) {
    const t = new Date(enrolledAt.getTime() + step.delay.afterMinutes * 60000);
    return step.delay.afterMinutes === 0 ? t : outsideQuietHours(t);
  }
  if (!appointment) return null;
  const t = new Date(new Date(appointment.starts_at).getTime() - step.delay.beforeAppointmentMinutes * 60000);
  // Booked too late for this reminder – skip it rather than send it late.
  if (t.getTime() < enrolledAt.getTime()) return null;
  return t;
}

export type EnrolOptions = { appointmentId?: number; variant?: string };

export function enrol(leadId: number, workflowKey: string, { appointmentId, variant }: EnrolOptions = {}) {
  const wf = getWorkflow(workflowKey);
  const lead = getLead(leadId);
  if (!wf || !lead) return;
  const appointment = appointmentId ? getAppointment(appointmentId) : undefined;
  const now = new Date();
  const d = db();
  const info = d
    .prepare("INSERT INTO enrollments (lead_id, workflow, appointment_id, variant, status, enrolled_at) VALUES (?, ?, ?, ?, 'active', ?)")
    .run(leadId, wf.key, appointmentId ?? null, variant ?? null, now.toISOString());
  const enrollmentId = Number(info.lastInsertRowid);
  const insert = d.prepare(
    "INSERT INTO scheduled_messages (enrollment_id, lead_id, workflow, step, channel, send_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
  );
  for (const step of wf.steps) {
    if (step.disabled) continue;
    if (step.variant && step.variant !== (variant ?? "no_show")) continue;
    const at = sendTime(step, now, appointment);
    if (at) insert.run(enrollmentId, leadId, wf.key, step.key, step.channel, at.toISOString());
  }
  logActivity(leadId, "automation", `Enrolled in workflow ${wf.number}. ${wf.name}`);
  // Send "immediately" steps now rather than on the next ticker run.
  if (process.env.NODE_ENV !== "test") setTimeout(() => void processDueMessages().catch(console.error), 0);
}

function endEnrollment(leadId: number, enrollmentId: number, workflow: string, reason: string) {
  const d = db();
  d.prepare("UPDATE enrollments SET status = 'removed', ended_at = ? WHERE id = ?").run(nowIso(), enrollmentId);
  d.prepare("UPDATE scheduled_messages SET status = 'cancelled' WHERE enrollment_id = ? AND status = 'pending'").run(enrollmentId);
  const wf = getWorkflow(workflow);
  if (wf) logActivity(leadId, "automation", `Removed from workflow ${wf.number}. ${wf.name} – ${reason}`);
}

function activeEnrollments(leadId: number) {
  return db()
    .prepare("SELECT id, workflow FROM enrollments WHERE lead_id = ? AND status = 'active'")
    .all(leadId) as { id: number; workflow: string }[];
}

/** Removes the lead from active workflows (except `keep`) and cancels their pending messages. */
export function exitWorkflows(leadId: number, keep: string[] = [], reason = "stage changed") {
  for (const e of activeEnrollments(leadId)) {
    if (!keep.includes(e.workflow)) endEnrollment(leadId, e.id, e.workflow, reason);
  }
}

/** A lead replied: stop any workflow that is set to end on reply. */
export function stopWorkflowsOnReply(leadId: number) {
  for (const e of activeEnrollments(leadId)) {
    if (getWorkflow(e.workflow)?.stopOnReply) endEnrollment(leadId, e.id, e.workflow, "contact replied");
  }
}

export function onStageEntered(leadId: number, stage: StageKey, opts: EnrolOptions = {}) {
  const rule = STAGE_RULES[stage] ?? {};
  exitWorkflows(leadId, rule.keep ?? []);
  if (rule.enrol) enrol(leadId, rule.enrol, opts);
}

function completeFinishedEnrollments() {
  db()
    .prepare(
      `UPDATE enrollments SET status = 'completed', ended_at = ?
       WHERE status = 'active' AND NOT EXISTS (
         SELECT 1 FROM scheduled_messages m WHERE m.enrollment_id = enrollments.id AND m.status IN ('pending','sending'))`,
    )
    .run(nowIso());
}

type SendOutcome = { ok: true; dryRun: boolean; channel: string; providerId?: string } | { ok: false; error: string };

/** WhatsApp first; SMS if the lead is flagged for fallback or WhatsApp rejects the message. */
async function sendToLead(lead: Lead, step: Step, rendered: ReturnType<typeof renderStep>): Promise<SendOutcome> {
  if (step.channel === "internal") {
    const to = process.env.STAFF_EMAIL;
    if (!to) return { ok: true, dryRun: true, channel: "internal" };
    const r = await sendEmail(to, rendered.subject || "Round 1 CRM notification", rendered.text);
    return r.ok ? { ok: true, dryRun: r.dryRun, channel: "internal" } : r;
  }
  if (step.channel === "email") {
    if (!lead.email) return { ok: false, error: "No email address" };
    const r = await sendEmail(lead.email, rendered.subject, rendered.text);
    return r.ok ? { ok: true, dryRun: r.dryRun, channel: "email" } : r;
  }
  if (!lead.phone) return { ok: false, error: "No phone number" };
  if (!lead.sms_fallback) {
    const r = await sendTemplate(lead.phone, step.template!, rendered.params);
    if (r.ok) return { ok: true, dryRun: r.dryRun, channel: "whatsapp", providerId: r.id };
    markSmsFallback(lead.id, r.error);
  }
  const s = await sendSms(lead.phone, rendered.text);
  return s.ok ? { ok: true, dryRun: s.dryRun, channel: "sms" } : s;
}

function markSmsFallback(leadId: number, reason: string) {
  db().prepare("UPDATE leads SET sms_fallback = 1 WHERE id = ?").run(leadId);
  logActivity(leadId, "automation", `WhatsApp undelivered (${reason}) – switching to SMS`);
}

type DueRow = { id: number; lead_id: number; workflow: string; step: string; appointment_id: number | null };

/** Sends every message that is due. Safe to call often. */
export async function processDueMessages(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const d = db();
  const due = d
    .prepare(
      `SELECT m.id, m.lead_id, m.workflow, m.step, e.appointment_id
       FROM scheduled_messages m JOIN enrollments e ON e.id = m.enrollment_id
       WHERE m.status = 'pending' AND m.send_at <= ? ORDER BY m.send_at, m.id LIMIT ?`,
    )
    .all(nowIso(), limit) as DueRow[];
  const result = { sent: 0, failed: 0, skipped: 0 };

  for (const row of due) {
    // Claim the row so concurrent tickers can't double-send.
    const claimed = d.prepare("UPDATE scheduled_messages SET status = 'sending' WHERE id = ? AND status = 'pending'").run(row.id);
    if (!claimed.changes) continue;

    const lead = getLead(row.lead_id);
    const step = getWorkflow(row.workflow)?.steps.find((s) => s.key === row.step);
    const appointment = row.appointment_id ? getAppointment(row.appointment_id) : undefined;
    const finish = (status: string, body: string | null, extra: { error?: string; channel?: string; providerId?: string } = {}) =>
      d
        .prepare(
          "UPDATE scheduled_messages SET status = ?, body = ?, error = ?, channel = COALESCE(?, channel), provider_id = ?, sent_at = ? WHERE id = ?",
        )
        .run(status, body, extra.error ?? null, extra.channel ?? null, extra.providerId ?? null, nowIso(), row.id);

    if (!lead || !step) {
      finish("skipped", null, { error: "Lead or step no longer exists" });
      result.skipped++;
      continue;
    }
    if (step.channel === "whatsapp" && !lead.whatsapp_opt_in) {
      finish("skipped", null, { error: "Not opted in to messages" });
      result.skipped++;
      continue;
    }
    const rendered = renderStep(step, { lead, appointment });
    try {
      const res = await sendToLead(lead, step, rendered);
      if (res.ok) {
        finish("sent", rendered.text, { channel: res.channel, providerId: res.providerId });
        const label = { whatsapp: "WhatsApp", sms: "SMS", email: "Email", internal: "Team notification" }[res.channel];
        logActivity(lead.id, res.channel === "internal" ? "automation" : "message_out", `${res.dryRun ? "[dry run] " : ""}${label}: ${rendered.text}`);
        result.sent++;
      } else {
        finish("failed", rendered.text, { error: res.error });
        logActivity(lead.id, "automation", `${step.channel} message failed: ${res.error}`);
        result.failed++;
      }
    } catch (e) {
      finish("failed", rendered.text, { error: String(e) });
      result.failed++;
    }
  }
  completeFinishedEnrollments();
  return result;
}

/** Delivery status from the WhatsApp webhook. A failed delivery is re-sent by SMS. */
export async function handleWhatsappStatus(providerId: string, status: string, error?: string) {
  if (status !== "failed") return;
  const row = db()
    .prepare("SELECT id, lead_id, body FROM scheduled_messages WHERE provider_id = ? AND channel = 'whatsapp'")
    .get(providerId) as { id: number; lead_id: number; body: string | null } | undefined;
  if (!row) return;
  const lead = getLead(row.lead_id);
  if (!lead) return;
  markSmsFallback(lead.id, error || "delivery failed");
  db().prepare("UPDATE scheduled_messages SET channel = 'sms', error = ? WHERE id = ?").run(`WhatsApp failed: ${error ?? ""}`, row.id);
  if (row.body) {
    const r = await sendSms(lead.phone, row.body);
    logActivity(lead.id, "message_out", r.ok ? `${r.dryRun ? "[dry run] " : ""}SMS: ${row.body}` : `SMS failed: ${r.error}`);
  }
}

export function workflowStats() {
  const rows = db()
    .prepare(
      `SELECT workflow, COUNT(*) AS total, SUM(status = 'active') AS active FROM enrollments GROUP BY workflow`,
    )
    .all() as { workflow: string; total: number; active: number }[];
  const msgs = db()
    .prepare(`SELECT workflow, SUM(status = 'sent') AS sent, SUM(status = 'pending') AS pending FROM scheduled_messages GROUP BY workflow`)
    .all() as { workflow: string; sent: number; pending: number }[];
  return Object.fromEntries(
    WORKFLOWS.map((w) => {
      const r = rows.find((x) => x.workflow === w.key);
      const m = msgs.find((x) => x.workflow === w.key);
      return [w.key, { total: r?.total ?? 0, active: r?.active ?? 0, sent: m?.sent ?? 0, pending: m?.pending ?? 0 }];
    }),
  );
}

export type QueuedMessage = {
  id: number;
  lead_id: number;
  first_name: string;
  last_name: string;
  workflow: string;
  step: string;
  send_at: string;
  status: string;
  body: string | null;
  error: string | null;
};

export function messageQueue(opts: { leadId?: number; status?: string; limit?: number } = {}): QueuedMessage[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.leadId) {
    where.push("m.lead_id = ?");
    args.push(opts.leadId);
  }
  if (opts.status) {
    where.push("m.status = ?");
    args.push(opts.status);
  }
  return db()
    .prepare(
      `SELECT m.id, m.lead_id, l.first_name, l.last_name, m.workflow, m.step, m.send_at, m.status, m.body, m.error
       FROM scheduled_messages m JOIN leads l ON l.id = m.lead_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY m.send_at ${opts.status === "pending" ? "ASC" : "DESC"} LIMIT ?`,
    )
    .all(...args, opts.limit ?? 100) as QueuedMessage[];
}
