// Runs one named change from the staff screens (see src/lib/actions.ts) on
// the server, saves it, and returns the updated CRM.

import { SERVER_REFUSES, isActionName } from "@/lib/actions";
import { applyAction } from "@/lib/server/state";
import { requireStaff } from "@/lib/server/staff";
import { MANAGEMENT_ACTIONS, isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { name?: unknown; args?: unknown } | null;
  if (!body || !isActionName(body.name) || SERVER_REFUSES.has(body.name) || !Array.isArray(body.args)) {
    return Response.json({ error: "Unknown change" }, { status: 400 });
  }
  // Messages to customers and settings are management's to change (Sammy, 10/10/2026).
  if (MANAGEMENT_ACTIONS.has(body.name) && !isManagerRole(auth.staff.role)) return Response.json({ error: "Only management can change that" }, { status: 403 });
  // Who removed, put back wrote a note or marked a WhatsApp done is whoever is signed in, whatever the page sent.
  const args = body.name === "removeContact" || body.name === "restoreContact" ? [body.args[0], auth.staff.name]
    : body.name === "addNote" || body.name === "setWhatsAppDone" ? [body.args[0], body.args[1], auth.staff.name]
    : body.args;
  try {
    return Response.json(await applyAction(body.name, args as never));
  } catch (e) {
    console.error("[actions]", body.name, e);
    return Response.json({ error: "Couldn’t save that change. Try again." }, { status: 500 });
  }
}
