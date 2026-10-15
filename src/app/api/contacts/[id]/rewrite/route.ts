// "Ask the AI to change it" under a WhatsApp, Facebook or Instagram reply
// (Sammy, 15/10/2026). Rewrites what's in the box; nothing is sent.

import { aiConfigured, rewriteMessage } from "@/lib/server/ai";
import { getFacts } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";
import { loadState } from "@/lib/server/state";
import { CHANNELS, CHANNEL_LABEL, SOCIAL_MAX_CHARS, type Channel } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  if (!aiConfigured()) return Response.json({ error: "The AI isn’t set up." }, { status: 422 });
  const b = (await req.json().catch(() => ({}))) as { text?: unknown; instruction?: unknown; channel?: unknown };
  const instruction = typeof b.instruction === "string" ? b.instruction.trim().slice(0, 1000) : "";
  if (!instruction) return Response.json({ error: "Say what you’d like changed" }, { status: 400 });
  const channel: Channel = CHANNELS.includes(b.channel as Channel) ? (b.channel as Channel) : "whatsapp";
  const s = await loadState();
  const c = s.contacts.find((x) => x.id === params.id);
  if (!c) return Response.json({ error: "Contact not found" }, { status: 404 });
  const thread = s.messages.filter((m) => m.contactId === c.id).sort((a, x) => Date.parse(a.at) - Date.parse(x.at)).slice(-60).map((m) => ({ dir: m.dir, text: m.text, at: m.at }));
  try {
    const text = await rewriteMessage({
      name: c.name, channel: CHANNEL_LABEL[channel], text: typeof b.text === "string" ? b.text.slice(0, 4000) : "", instruction, thread, facts: await getFacts(),
      maxChars: channel === "whatsapp" ? undefined : SOCIAL_MAX_CHARS[channel as "facebook" | "instagram"],
    });
    if (!text) return Response.json({ error: "The AI came back empty. Try again." }, { status: 502 });
    return Response.json({ text });
  } catch (e) {
    console.error("[rewrite]", e);
    return Response.json({ error: "Couldn’t rewrite it. Try again." }, { status: 500 });
  }
}
