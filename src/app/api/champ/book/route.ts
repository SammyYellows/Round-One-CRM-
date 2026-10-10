// Champ's class bookings (Sammy, 10/10/2026).
//   POST {id, action: "book" | "dismiss"}  the staff member presses Book (or
//                                          drops it); only their own, or any
//                                          for management
//   PUT {autobook: boolean}                management switch Auto-book on or
//                                          off for themselves

import { performBooking } from "@/lib/server/champ";
import { requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = typeof b.id === "string" ? b.id : "";
  const { data: row } = await db().from("champ_bookings").select("id, staff_id, status").eq("id", id).maybeSingle();
  if (!row) return Response.json({ error: "Booking not found" }, { status: 404 });
  if (row.staff_id !== auth.staff.id && !isManagerRole(auth.staff.role)) return Response.json({ error: "That isn’t your booking to confirm" }, { status: 403 });
  if (row.status !== "pending") return Response.json({ error: `Already ${row.status}` }, { status: 400 });
  if (b.action === "dismiss") {
    await db().from("champ_bookings").update({ status: "dismissed", decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ ok: true, message: "Not booked." });
  }
  if (b.action !== "book") return Response.json({ error: "Unknown action" }, { status: 400 });
  const r = await performBooking(id, auth.staff.name);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}

export async function PUT(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  if (!isManagerRole(auth.staff.role)) return Response.json({ error: "Only management can use Auto-book" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { autobook?: unknown };
  const { error } = await db().from("staff").update({ champ_autobook: b.autobook === true }).eq("id", auth.staff.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, autobook: b.autobook === true });
}
