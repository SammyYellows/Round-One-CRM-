// Runs one named change from the staff screens (see src/lib/actions.ts) on
// the server, saves it, and returns the updated CRM.

import { SERVER_REFUSES, isActionName } from "@/lib/actions";
import { applyAction } from "@/lib/server/state";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { name?: unknown; args?: unknown } | null;
  if (!body || !isActionName(body.name) || SERVER_REFUSES.has(body.name) || !Array.isArray(body.args)) {
    return Response.json({ error: "Unknown change" }, { status: 400 });
  }
  try {
    return Response.json(await applyAction(body.name, body.args as never));
  } catch (e) {
    console.error("[actions]", body.name, e);
    return Response.json({ error: "Couldn’t save that change. Try again." }, { status: 500 });
  }
}
