// Stops marketing emails to one contact. POSTed by the button on /u/<id>, and
// by mail apps' one-click unsubscribe (List-Unsubscribe-Post). Public: the
// contact id is the key, as on the booking page.

import { unsubscribe } from "@/lib/server/mailouts";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ok = await unsubscribe(params.id);
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  if (wantsHtml) return Response.redirect(new URL(`/u/${params.id}?done=1`, req.url), 303);
  return Response.json({ ok });
}
