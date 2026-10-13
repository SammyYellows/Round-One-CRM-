// Mailouts for the staff screen: the list with counts, the TeamUp categories
// to pick from, the WhatsApp templates, and today's allowances. POST makes a
// new draft (email, or WhatsApp with a template).

import { createMailout, dailyLimit, listMailouts, membershipCategories, whatsappDailyLimit, whatsappTemplates } from "@/lib/server/mailouts";
import { whatsappConfigured } from "@/lib/server/whatsapp";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const [mailouts, categories, templates] = await Promise.all([listMailouts(), membershipCategories(), whatsappTemplates()]);
  const limit = dailyLimit();
  return Response.json({
    mailouts, categories, dailyLimit: limit === Infinity ? null : limit, sending: Boolean(process.env.RESEND_API_KEY),
    templates, whatsappDailyLimit: whatsappDailyLimit(), whatsappSending: whatsappConfigured(),
  });
}

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string; audience?: Record<string, unknown>; channel?: string; template?: string };
  const id = await createMailout({ subject: body.subject ?? "", body: body.body ?? "", audience: body.audience ?? {}, channel: body.channel === "whatsapp" ? "whatsapp" : "email", template: body.template ?? null }, auth.staff.name);
  return Response.json({ ok: true, id });
}
