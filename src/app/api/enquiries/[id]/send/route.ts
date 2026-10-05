// The one route that sends a reply. Only reached by the Send button after
// the staff member has confirmed; the text sent is exactly what they saw.

import { sendReply } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { text?: string; confirm?: boolean };
  if (body.confirm !== true) return Response.json({ error: "Not confirmed" }, { status: 400 });
  const result = await sendReply(params.id, body.text ?? "", auth.staff.name);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
