// Change a WhatsApp template's wording by picking one of three versions
// (Sammy, 15/10/2026). Management only. Nothing is sent to anyone.
//   GET   → any new wording waiting on Meta for this template
//   POST  {instruction?} → three versions to choose from
//   PUT   {body} → use it (in place if Meta hasn't seen it, else a new version to Meta)

import { aiConfigured, templateOptions } from "@/lib/server/ai";
import { getFacts } from "@/lib/server/enquiries";
import { requireManager } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import { chooseWording, swaps } from "@/lib/server/templateEdit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { data } = await db().from("templates").select("meta_status").eq("name", params.name).maybeSingle();
  return Response.json({ status: data?.meta_status ?? null, pending: (await swaps()).find((x) => x.from === params.name) ?? null });
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  if (!aiConfigured()) return Response.json({ error: "The AI isn’t set up." }, { status: 422 });
  const b = (await req.json().catch(() => ({}))) as { instruction?: unknown };
  const { data } = await db().from("templates").select("body").eq("name", params.name).maybeSingle();
  if (!data) return Response.json({ error: "Template not found" }, { status: 404 });
  try {
    const options = await templateOptions({ body: data.body as string, instruction: typeof b.instruction === "string" ? b.instruction.slice(0, 500) : "", facts: await getFacts() });
    if (!options.length) return Response.json({ error: "The AI didn’t come back with usable versions. Try again." }, { status: 502 });
    return Response.json({ options });
  } catch (e) {
    console.error("[template options]", e);
    return Response.json({ error: "Couldn’t write versions. Try again." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { name: string } }) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { body?: unknown };
  const body = typeof b.body === "string" ? b.body.trim() : "";
  if (!body || body.length > 1024) return Response.json({ error: "The wording is empty or too long for WhatsApp" }, { status: 400 });
  const r = await chooseWording(params.name, body, auth.staff.name);
  if ("error" in r) return Response.json({ error: r.error }, { status: 400 });
  return Response.json(r);
}
