// Champ's chats (src/lib/server/champ.ts). Staff only.
//   GET               your chats (owners and managers: ?all=1 for everyone's)
//   GET ?chat=<id>    one chat's messages (yours, or anyone's for owners)
//   POST {chatId?, text}  ask Champ; starts a chat when there's no chatId

import { askChamp, champConfigured, type ChampMessage } from "@/lib/server/champ";
import { requireStaff, type StaffMember } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 160; // a long chat gets slow and costly; start a new one
const isOwner = (s: StaffMember) => isManagerRole(s.role);

async function chatFor(id: string, staff: StaffMember) {
  const { data } = await db().from("champ_chats").select("id, staff_id, staff_name, title, updated_at").eq("id", id).maybeSingle();
  if (!data) return null;
  return data.staff_id === staff.id || isOwner(staff) ? data : null;
}

export async function GET(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chat");
  if (chatId) {
    const chat = await chatFor(chatId, auth.staff);
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });
    const { data, error } = await db().from("champ_messages").select("id, role, text, tools, created_at").eq("chat_id", chatId).neq("text", "").order("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ chat, mine: chat.staff_id === auth.staff.id, messages: data ?? [] });
  }
  const all = url.searchParams.get("all") === "1" && isOwner(auth.staff);
  let q = db().from("champ_chats").select("id, staff_id, staff_name, title, updated_at").order("updated_at", { ascending: false }).limit(100);
  if (!all) q = q.eq("staff_id", auth.staff.id);
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ chats: data ?? [], canSeeAll: isOwner(auth.staff), configured: champConfigured() });
}

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; text?: unknown };
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 2000) : "";
  if (!text) return Response.json({ error: "Ask Champ something" }, { status: 400 });

  let chatId = typeof b.chatId === "string" ? b.chatId : "";
  let history: ChampMessage[] = [];
  if (chatId) {
    const chat = await chatFor(chatId, auth.staff);
    if (!chat || chat.staff_id !== auth.staff.id) return Response.json({ error: "You can only carry on your own chats" }, { status: 403 });
    const { data, error } = await db().from("champ_messages").select("role, content").eq("chat_id", chatId).order("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if ((data?.length ?? 0) > MAX_ROWS) return Response.json({ error: "This chat is getting long. Start a new chat to keep Champ quick." }, { status: 400 });
    history = (data ?? []).map((r) => ({ role: r.role as ChampMessage["role"], content: r.content as ChampMessage["content"] }));
  }

  // A new chat is made first, so anything Champ records (a conduct flag) can point at it.
  const isNew = !chatId;
  if (isNew) {
    const { data, error } = await db().from("champ_chats").insert({ staff_id: auth.staff.id, staff_name: auth.staff.name, title: text.slice(0, 80) }).select("id").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    chatId = data.id as string;
  }

  let result;
  try {
    result = await askChamp(history, text, auth.staff.name, { staffId: auth.staff.id, chatId, role: auth.staff.role });
  } catch (e) {
    console.error("[champ]", e instanceof Error ? e.message : e);
    if (isNew) await db().from("champ_chats").delete().eq("id", chatId);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  const last = result.added.length - 1;
  const rows = result.added.map((m, i) => ({
    chat_id: chatId, role: m.role, content: m.content,
    text: i === 0 ? text : i === last && m.role === "assistant" ? result.answer : "",
    tools: i === last ? [...new Set(result.tools)] : [],
  }));
  // If the loop ended on tool results, the answer still needs showing: put it on a closing assistant row.
  if (result.added[last].role !== "assistant") rows.push({ chat_id: chatId, role: "assistant", content: [{ type: "text", text: result.answer }], text: result.answer, tools: [...new Set(result.tools)] });
  const { error } = await db().from("champ_messages").insert(rows);
  if (error) console.error("[champ] saving", error.message);
  await db().from("champ_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  return Response.json({ chatId, answer: result.answer, tools: [...new Set(result.tools)] });
}
