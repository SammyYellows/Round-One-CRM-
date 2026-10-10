// The one route that sends a mailout. Only reached after the staff member
// has confirmed the count on screen; needs confirm: true.

import { startMailout } from "@/lib/server/mailouts";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (body.confirm !== true) return Response.json({ ok: false, error: "Not confirmed" }, { status: 400 });
  const result = await startMailout(params.id, auth.staff.name);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
