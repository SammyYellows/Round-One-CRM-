// "Draft a reply" on a WhatsApp, Facebook or Instagram conversation (Sammy,
// 14/10/2026): Claude reads the thread again and leaves a suggested reply on
// the contact. Nothing is sent; staff press Use it, then Send.

import { readContactReplies } from "@/lib/server/insights";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const res = await readContactReplies(params.id, { force: true });
    if ("skipped" in res) {
      const why = res.skipped === "no AI key" ? "The AI isn’t set up." : res.skipped === "nothing to read" ? "Their last message has no words to reply to (a photo, a sticker or STOP)." : "There’s nothing from them to reply to.";
      return Response.json({ error: why }, { status: 422 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[draft]", e);
    return Response.json({ error: "Couldn’t draft a reply. Try again." }, { status: 500 });
  }
}
