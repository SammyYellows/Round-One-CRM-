// How many people an audience would reach right now, with a few names.

import { resolveAudience } from "@/lib/server/mailouts";
import { requireManager } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  // ?channel=whatsapp counts mobile numbers instead of email addresses.
  const channel = new URL(req.url).searchParams.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const audience = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const people = await resolveAudience(audience, channel);
  return Response.json({ count: people.length, sample: people.slice(0, 5).map((p) => p.name || p.email) });
}
