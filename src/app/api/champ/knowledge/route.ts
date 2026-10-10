// Champ's knowledge (champKnowledge.ts). Owners and managers only.
//   GET                                   every entry, with the size used
//   POST {action:"note", title, body}     add a written note
//   POST {action:"upload-url", name, size}  a signed address to upload a file straight to storage
//   POST {action:"document", path, name, title}  read an uploaded file's text and add it
//   PATCH {id, title?, body?, active?}    edit, switch on or off
//   DELETE ?id=                           remove (and its file)

import { BUCKET, MAX_FILE_BYTES, MAX_TOTAL_CHARS, extractText, listKnowledge, totalChars } from "@/lib/server/champKnowledge";
import { requireStaff, type StaffMember } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // reading a long PDF takes a while

const isManager = (s: StaffMember) => isManagerRole(s.role);
async function manager() {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  if (!isManager(auth.staff)) return { error: Response.json({ error: "Only management can change what Champ knows" }, { status: 403 }) };
  return auth;
}
const tooBig = async (adding: number, exceptId?: string) => (await totalChars(exceptId)) + adding > MAX_TOTAL_CHARS;
const FULL = `Champ's knowledge is full (about ${MAX_TOTAL_CHARS.toLocaleString("en-GB")} characters). Switch off or remove something first.`;

export async function GET() {
  const auth = await manager();
  if ("error" in auth) return auth.error;
  const rows = await listKnowledge();
  return Response.json({ rows: rows.map((r) => ({ ...r, chars: r.body.length })), used: rows.filter((r) => r.active).reduce((n, r) => n + r.body.length, 0), max: MAX_TOTAL_CHARS, maxFile: MAX_FILE_BYTES });
}

export async function POST(req: Request) {
  const auth = await manager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";

  if (b.action === "note") {
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (!title || !body) return Response.json({ error: "Give the note a title and some text" }, { status: 400 });
    if (await tooBig(body.length)) return Response.json({ error: FULL }, { status: 400 });
    const { data, error } = await db().from("champ_knowledge").insert({ title, body, kind: "note", created_by: auth.staff.name }).select("id").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, id: data.id });
  }

  if (b.action === "upload-url") {
    const name = typeof b.name === "string" ? b.name : "";
    const size = Number(b.size);
    if (!name || !/\.(pdf|docx|txt|md|csv)$/i.test(name)) return Response.json({ error: "Upload a PDF, Word (.docx) or text file" }, { status: 400 });
    if (!(size > 0) || size > MAX_FILE_BYTES) return Response.json({ error: "Files can be up to 20 MB" }, { status: 400 });
    const path = `${Date.now()}-${name.replace(/[^\w.\-]+/g, "_").slice(-100)}`;
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ path, signedUrl: data.signedUrl });
  }

  if (b.action === "document") {
    const path = typeof b.path === "string" ? b.path : "";
    const name = typeof b.name === "string" ? b.name.slice(0, 200) : path;
    if (!path || path.includes("/")) return Response.json({ error: "Missing file" }, { status: 400 });
    const { data: file, error } = await db().storage.from(BUCKET).download(path);
    if (error || !file) return Response.json({ error: "The upload didn't arrive. Try again." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const row = { title: title || name.replace(/\.[^.]+$/, ""), kind: "document", file_name: name, file_path: path, mime: file.type || null, size: buf.length, created_by: auth.staff.name };
    try {
      const { text, note } = await extractText(buf, name, file.type || "");
      if (!text) throw new Error("No text found in this file. If it's a scan, Champ can only read it as a PDF.");
      if (await tooBig(text.length)) throw new Error(FULL);
      const { data, error: e2 } = await db().from("champ_knowledge").insert({ ...row, body: text, status: "ready", error: note ?? null }).select("id").single();
      if (e2) throw new Error(e2.message);
      return Response.json({ ok: true, id: data.id, chars: text.length, note });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db().from("champ_knowledge").insert({ ...row, status: "failed", error: message, active: false });
      return Response.json({ error: message }, { status: 400 });
    }
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const auth = await manager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; title?: unknown; body?: unknown; active?: unknown };
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  const { data: cur } = await db().from("champ_knowledge").select("body, active, status").eq("id", id).maybeSingle();
  if (!cur) return Response.json({ error: "Not found" }, { status: 404 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 120);
  if (typeof b.body === "string") patch.body = b.body.trim();
  if (typeof b.active === "boolean") patch.active = b.active && cur.status === "ready";
  const willBeActive = (patch.active ?? cur.active) as boolean;
  const bodyLen = ((patch.body as string | undefined) ?? (cur.body as string)).length;
  if (willBeActive && (await tooBig(bodyLen, id))) return Response.json({ error: FULL }, { status: 400 });
  const { error } = await db().from("champ_knowledge").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await manager();
  if ("error" in auth) return auth.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const { data } = await db().from("champ_knowledge").select("file_path").eq("id", id).maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  if (data.file_path) await db().storage.from(BUCKET).remove([data.file_path as string]);
  const { error } = await db().from("champ_knowledge").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
