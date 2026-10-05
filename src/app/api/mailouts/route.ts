// Mailouts for the staff screen: the list with counts, the TeamUp categories
// to pick from, and today's allowance. POST makes a new draft.

import { createMailout, dailyLimit, listMailouts, membershipCategories } from "@/lib/server/mailouts";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [mailouts, categories] = await Promise.all([listMailouts(), membershipCategories()]);
  const limit = dailyLimit();
  return Response.json({ mailouts, categories, dailyLimit: limit === Infinity ? null : limit, sending: Boolean(process.env.RESEND_API_KEY) });
}

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string; audience?: Record<string, unknown> };
  const id = await createMailout({ subject: body.subject ?? "", body: body.body ?? "", audience: body.audience ?? {} }, auth.staff.name);
  return Response.json({ ok: true, id });
}
