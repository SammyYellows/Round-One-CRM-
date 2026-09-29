// Runs automation steps that have come due. Called every 5 minutes by a
// Supabase pg_cron job (see CLAUDE.md). Needs CRON_SECRET as a Bearer token.
//
// Most calls find nothing due, so it first asks the database that one small
// question, and only loads the whole CRM when a waiting step's time has come.

import { db } from "@/lib/server/supabase";
import { loadAndTick } from "@/lib/server/state";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await db()
    .from("runs")
    .select("id")
    .eq("status", "waiting")
    .lte("resume_at", new Date().toISOString())
    .limit(1);
  if (error) throw new Error(`Checking for due runs: ${error.message}`);
  if (!data?.length) return Response.json({ ok: true, due: false });

  await loadAndTick();
  return Response.json({ ok: true, due: true });
}
