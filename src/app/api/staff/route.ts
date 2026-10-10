// Staff logins (Sammy, 10/10/2026). Management only.
//   GET                                   everyone, with whether they've logged in
//   POST {action:"add", name, email, role}  add (or bring back) and email an invite
//   POST {action:"resend", id}            send the set-password email again
//   PATCH {id, name?, role?, active?}     change role or name, remove or bring back
// Removing sets active = false: their login stops working at once (staffFor
// only lets active staff in). Nothing is deleted, so their history stays.

import { requireManager } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { ROLES } from "@/lib/roles";
import { checkEmail } from "@/lib/emailCheck";

export const dynamic = "force-dynamic";

const appUrl = () => (process.env.APP_URL || "https://round-one-crm.vercel.app").replace(/\/$/, "");

/** An invite for someone new; a set-password email if they already have a login. */
async function sendInvite(email: string): Promise<{ ok: boolean; note: string }> {
  const { error } = await db().auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl()}/auth/confirm` });
  if (!error) return { ok: true, note: `Invite sent to ${email}. They choose their own password from the email.` };
  if (/already|registered|exists/i.test(error.message)) {
    const r = await db().auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/confirm` });
    if (!r.error) return { ok: true, note: `${email} already had a login, so they've been sent a link to set a new password.` };
    return { ok: false, note: r.error.message };
  }
  return { ok: false, note: error.message };
}

export async function GET() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { data, error } = await db().from("staff").select("id, name, role, email, active, auth_user_id, created_at").order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    me: auth.staff.id,
    roles: ROLES,
    staff: (data ?? []).filter((s) => s.id !== "champ-test").map((s) => ({ id: s.id, name: s.name, role: s.role, email: s.email, active: s.active, joined: Boolean(s.auth_user_id), createdAt: s.created_at })),
  });
}

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "add") {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
    const check = checkEmail(typeof b.email === "string" ? b.email : "");
    const role = ROLES.find((r) => r === b.role) ?? "Staff";
    if (!name) return Response.json({ error: "Add their name" }, { status: 400 });
    if (!check.ok) return Response.json({ error: check.reason ?? "That email doesn’t look right" }, { status: 400 });
    const email = check.value;
    const { data: existing } = await db().from("staff").select("id, active").ilike("email", email).maybeSingle();
    if (existing) {
      const { error } = await db().from("staff").update({ name, role, active: true }).eq("id", existing.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await db().from("staff").insert({ name, role, email });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    const sent = await sendInvite(email);
    return Response.json({ ok: sent.ok, note: sent.ok ? sent.note : `Added, but the email didn’t send: ${sent.note}` });
  }
  if (b.action === "resend") {
    const { data } = await db().from("staff").select("email, active").eq("id", String(b.id ?? "")).maybeSingle();
    if (!data?.email || !data.active) return Response.json({ error: "Not found" }, { status: 404 });
    const sent = await sendInvite(data.email);
    return Response.json({ ok: sent.ok, note: sent.note }, { status: sent.ok ? 200 : 502 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; name?: unknown; role?: unknown; active?: unknown };
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  // You can't lock yourself out.
  if (id === auth.staff.id && (b.active === false || (typeof b.role === "string" && !/owner|manager/i.test(b.role)))) return Response.json({ error: "You can’t remove yourself or take away your own management access" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
  if (typeof b.role === "string") patch.role = ROLES.find((r) => r === b.role) ?? "Staff";
  if (typeof b.active === "boolean") patch.active = b.active;
  const { error } = await db().from("staff").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
