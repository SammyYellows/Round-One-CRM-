// Runs automation steps that have come due, for a scheduler to call (e.g. a
// Vercel Cron job). Needs CRON_SECRET as a Bearer token.

import { loadAndTick } from "@/lib/server/state";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Forbidden" }, { status: 403 });
  await loadAndTick();
  return Response.json({ ok: true });
}
