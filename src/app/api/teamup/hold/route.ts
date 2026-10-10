// Put a member's TeamUp membership on hold from the Failed payments screen.
// Needs confirm:true. TeamUp stays the place to lift it.

import { requireManager } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { holdMembership, teamupConfigured } from "@/lib/server/teamup";
import { syncTeamUpCustomer } from "@/lib/server/teamupSync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { contactId?: string; confirm?: boolean };
  if (b.confirm !== true || !b.contactId) return Response.json({ error: "Confirm first" }, { status: 400 });
  if (!teamupConfigured()) return Response.json({ error: "TeamUp isn’t connected on this server" }, { status: 400 });
  const { data: c } = await db().from("contacts").select("id, name, membership").eq("id", b.contactId).maybeSingle();
  const m = c?.membership as { id?: string; name?: string; customerId?: string; status?: string } | null;
  if (!c || !m?.id || m.status === "ended") return Response.json({ error: "No current membership to hold" }, { status: 400 });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
  try {
    const hold = await holdMembership(m.id, today);
    await db().from("events").insert({ id: crypto.randomUUID(), type: "membership.held", contact_id: c.id, detail: `${c.name}’s ${m.name} put on hold in TeamUp by ${auth.staff.name} (unpaid)`, data: { hold: hold.id } });
    if (m.customerId) await syncTeamUpCustomer(m.customerId).catch(() => undefined);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
