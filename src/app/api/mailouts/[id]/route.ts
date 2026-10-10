// Edit or delete a draft. Sending has its own route.

import { deleteMailout, updateMailout } from "@/lib/server/mailouts";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string; audience?: Record<string, unknown> };
  const ok = await updateMailout(params.id, body);
  return Response.json({ ok }, { status: ok ? 200 : 409 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const ok = await deleteMailout(params.id);
  return Response.json({ ok }, { status: ok ? 200 : 409 });
}
