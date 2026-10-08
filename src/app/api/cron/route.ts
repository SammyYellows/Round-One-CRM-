// Runs automation steps that have come due. Called every 5 minutes by a
// Supabase pg_cron job (see CLAUDE.md). Needs CRON_SECRET as a Bearer token.
//
// Most calls find nothing due, so it first asks the database that one small
// question, and only loads the whole CRM when a waiting step's time has come.

import { db } from "@/lib/server/supabase";
import { loadAndTick } from "@/lib/server/state";
import { syncTeamUp } from "@/lib/server/teamupSync";
import { drainQueue, queuedCount } from "@/lib/server/mailouts";
import { catchUpReceived } from "@/lib/server/enquiries";
import { runDueReports } from "@/lib/server/reports";
import { accountabilityTick } from "@/lib/server/accountability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Forbidden" }, { status: 403 });

  // ?job=teamup: the nightly members sync (a second pg_cron job calls this).
  if (new URL(req.url).searchParams.get("job") === "teamup") return Response.json(await syncTeamUp());

  // Mailout emails still queued (within today's allowance) go out first.
  const mailout = (await queuedCount()) > 0 ? await drainQueue() : undefined;
  // Any received email the webhook missed is pulled in.
  const enquiries = await catchUpReceived().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  // The managers' reports, when their time has come (Reports → Settings).
  const reports = await runDueReports().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  // Accountability check-ins whose slot time has come (docs/accountability.md).
  const accountability = await accountabilityTick().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));

  const { data, error } = await db()
    .from("runs")
    .select("id")
    .eq("status", "waiting")
    .lte("resume_at", new Date().toISOString())
    .limit(1);
  if (error) throw new Error(`Checking for due runs: ${error.message}`);
  if (!data?.length) return Response.json({ ok: true, due: false, mailout, enquiries, reports, accountability });

  await loadAndTick();
  return Response.json({ ok: true, due: true, mailout, enquiries, reports, accountability });
}
