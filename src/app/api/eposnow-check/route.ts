// Checks the CRM can read Epos Now (Sammy, 14/10/2026): counts and field
// names only, nothing saved, nothing changed on the till. ?probe=1 looks at
// payments, tills and end-of-day reports, for planning the cash-up;
// ?compare=1 sets the till's last cash-ups beside the CRM's own sums. Needs CRON_SECRET,
// like /api/cron, so the till's keys never leave Vercel.

import { eposCheck, eposProbe } from "@/lib/server/eposnow";
import { tillCompare } from "@/lib/server/till";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  if (p.get("compare")) return Response.json(await tillCompare().catch((e) => ({ error: e instanceof Error ? e.message : String(e) })));
  return Response.json(p.get("probe") ? await eposProbe() : await eposCheck());
}
