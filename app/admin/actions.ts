"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireAdmin } from "@/lib/auth";
import { getLead, insertLead, logActivity, normalisePhone, updateLeadFields, type Appointment } from "@/lib/leads";
import { bookAppointment, setAppointmentStatus, setStage } from "@/lib/pipeline";
import { isStage } from "@/lib/stages";
import { onStageEntered, processDueMessages } from "@/lib/workflows";
import { sendText } from "@/lib/whatsapp";

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function moveStage(leadId: number, stage: string) {
  await requireAdmin();
  if (!isStage(stage)) return;
  setStage(leadId, stage, { by: "staff" });
  revalidatePath("/admin", "layout");
}

export async function moveStageForm(form: FormData) {
  await moveStage(Number(form.get("id")), String(form.get("stage")));
}

export async function addNote(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const body = String(form.get("body") ?? "").trim();
  if (body) logActivity(id, "note", body);
  revalidatePath(`/admin/leads/${id}`);
}

export async function updateLead(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const value = Number(String(form.get("value") ?? "0").replace(/[£,]/g, ""));
  updateLeadFields(id, {
    first_name: String(form.get("first_name") ?? "").trim(),
    last_name: String(form.get("last_name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    phone: normalisePhone(String(form.get("phone") ?? "")),
    source: String(form.get("source") ?? "").trim(),
    value_pence: Number.isFinite(value) ? Math.round(value * 100) : 0,
    whatsapp_opt_in: form.get("whatsapp_opt_in") === "on" ? 1 : 0,
  });
  revalidatePath(`/admin/leads/${id}`);
}

export async function bookForLead(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const local = String(form.get("when") ?? ""); // "YYYY-MM-DDTHH:mm" in UK time
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return;
  const { localToUtc } = await import("@/lib/time");
  const start = localToUtc(+m[1], +m[2], +m[3], +m[4], +m[5]);
  bookAppointment(id, start.toISOString(), { by: "staff", skipAvailabilityCheck: true });
  revalidatePath("/admin", "layout");
}

export async function appointmentStatus(form: FormData) {
  await requireAdmin();
  setAppointmentStatus(Number(form.get("appointment")), String(form.get("status")) as Appointment["status"], "staff");
  revalidatePath("/admin", "layout");
}

export async function sendManualMessage(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const body = String(form.get("body") ?? "").trim();
  const lead = getLead(id);
  if (!lead || !body) return;
  const res = await sendText(lead.phone, body);
  logActivity(id, "message_out", res.ok ? `${res.dryRun ? "[dry run] " : ""}WhatsApp (staff): ${body}` : `WhatsApp failed: ${res.error}`);
  revalidatePath(`/admin/leads/${id}`);
}

export async function createLead(form: FormData) {
  await requireAdmin();
  const lead = insertLead({
    first_name: String(form.get("first_name") ?? "").trim() || "Unknown",
    last_name: String(form.get("last_name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    phone: normalisePhone(String(form.get("phone") ?? "")),
    source: String(form.get("source") ?? "Walk-in"),
    stage: "lead",
    qualified: true,
  });
  logActivity(lead.id, "form", "Added manually by staff");
  if (form.get("automations") === "on") onStageEntered(lead.id, "lead");
  redirect(`/admin/leads/${lead.id}`);
}

export async function runAutomationsNow() {
  await requireAdmin();
  await processDueMessages();
  revalidatePath("/admin", "layout");
}
