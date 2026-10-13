// Sends the mailout to the signed-in staff member only, so they can see it
// (a WhatsApp one to the mobile they type in).

import { getMailout, sendTest, sendWhatsAppTest } from "@/lib/server/mailouts";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  // WhatsApp mailouts: the test goes to the mobile the staff member types in.
  const m = await getMailout(params.id);
  if (m?.channel === "whatsapp") {
    const { to } = (await req.json().catch(() => ({}))) as { to?: string };
    const result = await sendWhatsAppTest(params.id, String(to ?? ""));
    return Response.json({ ...result, to }, { status: result.ok ? 200 : 400 });
  }
  const to = auth.staff.email || process.env.STAFF_EMAIL;
  if (!to) return Response.json({ ok: false, error: "No email address for you to send the test to" }, { status: 400 });
  const result = await sendTest(params.id, to, auth.staff.name);
  return Response.json({ ...result, to }, { status: result.ok ? 200 : 400 });
}
