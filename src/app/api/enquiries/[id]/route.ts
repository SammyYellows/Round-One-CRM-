// Changes to one enquiry that don't send anything: save the edited draft,
// dismiss or reopen it, or ask the AI to draft again.

import { processEnquiry, saveDraft, setDismissed } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

type Body = { draft?: string; action?: "dismiss" | "reopen" | "redraft" };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as Body;
  if (typeof body.draft === "string") await saveDraft(params.id, body.draft);
  if (body.action === "dismiss") await setDismissed(params.id, true);
  if (body.action === "reopen") await setDismissed(params.id, false);
  if (body.action === "redraft") await processEnquiry(params.id);
  return Response.json({ ok: true });
}
