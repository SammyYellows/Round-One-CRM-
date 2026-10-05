// The Enquiries screen: every kept email plus the facts sheet the AI uses.

import { getFacts, listEnquiries } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";
import { aiConfigured } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [enquiries, facts] = await Promise.all([listEnquiries(), getFacts()]);
  return Response.json({ enquiries, facts, ai: aiConfigured(), receiving: Boolean(process.env.RESEND_WEBHOOK_SECRET) });
}
