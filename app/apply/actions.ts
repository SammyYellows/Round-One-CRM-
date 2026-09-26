"use server";

import { redirect } from "next/navigation";
import { QUESTIONS } from "@/lib/config";
import { normalisePhone } from "@/lib/leads";
import { submitQuestionnaire } from "@/lib/pipeline";

export type ApplyState = { error?: string };

export async function submitApplication(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const v = get(`q_${q.key}`);
    if (!q.options.some((o) => o.value === v)) return { error: "Please answer every question." };
    answers[q.key] = v;
  }
  const first_name = get("first_name");
  const email = get("email");
  const phone = get("phone");
  if (!first_name) return { error: "Please enter your first name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (normalisePhone(phone).replace(/\D/g, "").length < 10) return { error: "Please enter a valid mobile number." };
  if (form.get("consent") !== "on") return { error: "Please tick the box so we can contact you about your consultation." };

  const { lead, qualified } = submitQuestionnaire({
    first_name,
    last_name: get("last_name"),
    email,
    phone,
    answers,
    source: get("source") || "Instagram",
    campaign: get("campaign") || null,
    whatsapp_opt_in: true,
  });
  redirect(qualified ? `/book/${lead.token}?new=1` : `/apply/thanks`);
}
