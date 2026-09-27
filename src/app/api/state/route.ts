// The whole CRM for the staff screens. Also runs any automation steps that
// have come due, so waits move on whenever someone has the CRM open.

import { loadAndTick } from "@/lib/server/state";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  return Response.json(await loadAndTick());
}
