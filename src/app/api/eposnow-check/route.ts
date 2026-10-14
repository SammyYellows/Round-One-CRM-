// Checks the CRM can read Epos Now (Sammy, 14/10/2026): counts and field
// names only, nothing saved, nothing changed on the till. ?probe=1 looks at
// payments, tills and end-of-day reports, for planning the cash-up. Needs CRON_SECRET,
// like /api/cron, so the till's keys never leave Vercel.

import { eposCheck, eposProbe } from "@/lib/server/eposnow";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  return Response.json(new URL(req.url).searchParams.get("probe") ? await eposProbe() : await eposCheck());
}
