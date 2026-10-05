// The facts sheet the AI is allowed to use, edited on the Enquiries screen.

import { saveFacts } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { facts?: string };
  if (typeof body.facts !== "string") return Response.json({ error: "No facts" }, { status: 400 });
  await saveFacts(body.facts.slice(0, 20000));
  return Response.json({ ok: true });
}
