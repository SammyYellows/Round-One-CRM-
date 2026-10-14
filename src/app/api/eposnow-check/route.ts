// Checks the CRM can read Epos Now (Sammy, 14/10/2026): counts and field
// names only, nothing saved, nothing changed on the till. Needs CRON_SECRET,
// like /api/cron, so the till's keys never leave Vercel.

import { eposCheck } from "@/lib/server/eposnow";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  return Response.json(await eposCheck());
}
