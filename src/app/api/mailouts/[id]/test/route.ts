// Sends the mailout to the signed-in staff member only, so they can see it.

import { sendTest } from "@/lib/server/mailouts";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const to = auth.staff.email || process.env.STAFF_EMAIL;
  if (!to) return Response.json({ ok: false, error: "No email address for you to send the test to" }, { status: 400 });
  const result = await sendTest(params.id, to, auth.staff.name);
  return Response.json({ ...result, to }, { status: result.ok ? 200 : 400 });
}
