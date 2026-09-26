// Public: someone submitting a trial form from an ad or the website. No login.
// Creates (or updates) the contact with its ad attribution, and fires the
// form's automations, exactly as the prototype did in the browser.

import type { Attribution } from "@/lib/engine";
import { applyAction } from "@/lib/server/state";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const { data: form } = await db().from("forms").select("id").eq("slug", params.slug).maybeSingle();
  if (!form) return Response.json({ error: "Form not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { answers?: unknown; utm?: unknown } | null;
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "Bad request" }, { status: 400 });

  // Keep only short strings: this is untrusted input from the internet.
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.answers).slice(0, 40)) answers[text(k, 40)] = text(v, 1000);
  const u = (body.utm ?? {}) as Record<string, unknown>;
  const utm: Attribution = {};
  for (const k of ["source", "campaign", "adset", "ad", "adId", "fbclid"] as const) {
    const v = text(u[k], 300);
    if (v) utm[k] = v;
  }

  try {
    await applyAction("submitForm", [form.id as string, answers, utm]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[form submit]", params.slug, e);
    return Response.json({ error: "Couldn’t save your answers. Please try again." }, { status: 500 });
  }
}
