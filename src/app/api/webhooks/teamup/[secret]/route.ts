// TeamUp's webhook: a nudge that something changed for a customer. TeamUp
// doesn't sign these, so the address carries a secret, the payload is only
// used for the customer id, and the real data is re-read from TeamUp with
// our token. TeamUp wants a 2xx within 10 seconds and retries otherwise.

import { afterResponse } from "@/lib/server/background";
import { syncTeamUpCustomer } from "@/lib/server/teamupSync";

export const dynamic = "force-dynamic";

type Body = { feed_items?: { id?: number; type?: string; resources?: { customer?: number | string } }[] };

export async function POST(req: Request, { params }: { params: { secret: string } }) {
  const secret = process.env.TEAMUP_WEBHOOK_SECRET;
  if (!secret || params.secret !== secret) return new Response("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const customers = new Set<string>();
  for (const item of body?.feed_items ?? []) {
    const id = item.resources?.customer;
    if (id !== undefined && id !== null) customers.add(String(id));
  }
  // Answer straight away; the re-read happens in the background.
  await afterResponse(
    (async () => {
      for (const id of customers) await syncTeamUpCustomer(id);
    })(),
  );
  return Response.json({ ok: true, customers: customers.size });
}
