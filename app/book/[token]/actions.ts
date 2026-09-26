"use server";

import { redirect } from "next/navigation";
import { getLeadByToken, upcomingAppointment } from "@/lib/leads";
import { bookAppointment, confirmUpcoming, setAppointmentStatus } from "@/lib/pipeline";

export type BookState = { error?: string };

export async function bookSlot(_prev: BookState, form: FormData): Promise<BookState> {
  const lead = getLeadByToken(String(form.get("token")));
  if (!lead || !lead.qualified) return { error: "This booking link isn't valid." };
  const slot = String(form.get("slot") ?? "");
  if (!slot) return { error: "Please pick a time." };
  const res = bookAppointment(lead.id, slot, { by: "lead via booking page" });
  if (!res.ok) return { error: res.error };
  redirect(`/book/${lead.token}?booked=1`);
}

export async function confirmBooking(form: FormData) {
  const lead = getLeadByToken(String(form.get("token")));
  if (lead) confirmUpcoming(lead.id, "lead via booking page");
  redirect(`/book/${form.get("token")}?confirmed=1`);
}

export async function cancelBooking(form: FormData) {
  const lead = getLeadByToken(String(form.get("token")));
  const appt = lead && upcomingAppointment(lead.id);
  if (appt) setAppointmentStatus(appt.id, "cancelled", "lead via booking page");
  redirect(`/book/${form.get("token")}?cancelled=1`);
}
