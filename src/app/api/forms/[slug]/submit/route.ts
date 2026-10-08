// Public: someone submitting a trial form from an ad or the website. No login.
// Creates (or updates) the contact with its ad attribution, and fires the
// form's automations, exactly as the prototype did in the browser. Bots are
// kept out by src/lib/server/spam.ts.

import { uid, type Attribution } from "@/lib/engine";
import { applyAction } from "@/lib/server/state";
import { checkFormToken, clientIp, overLimit } from "@/lib/server/spam";
import { db } from "@/lib/server/supabase";
import type { Question } from "@/lib/types";
import { checkEmail } from "@/lib/emailCheck";

export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const { data: form } = await db().from("forms").select("id, questions").eq("slug", params.slug).maybeSingle();
  if (!form) return Response.json({ error: "Form not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { answers?: unknown; utm?: unknown; token?: unknown; hp?: unknown; contactId?: unknown } | null;
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "Bad request" }, { status: 400 });

  // The hidden trap field: only bots fill it in. Pretend it worked.
  if (typeof body.hp === "string" && body.hp.trim()) return Response.json({ ok: true });

  // Faster than a person could answer: the page waits and sends again.
  const timing = checkFormToken(body.token, params.slug);
  if (!timing.ok) {
    if (timing.reason === "too_fast") return Response.json({ error: "too_fast", waitMs: timing.waitMs }, { status: 425 });
    return Response.json({ error: "Please reload the page and try again." }, { status: 400 });
  }

  // Keep only short strings: this is untrusted input from the internet.
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.answers).slice(0, 40)) answers[text(k, 40)] = text(v, 1000);
  const u = (body.utm ?? {}) as Record<string, unknown>;
  const utm: Attribution = {};
  for (const k of ["source", "campaign", "adset", "ad", "adId", "fbclid"] as const) {
    const v = text(u[k], 300);
    if (v) utm[k] = v;
  }

  // The email address has to pass the same check as the form applied, tidied the same way.
  const emailQ = (form.questions as Question[]).find((q) => q.field === "email");
  if (emailQ && answers[emailQ.id] !== undefined) {
    const check = checkEmail(answers[emailQ.id]);
    if (!check.ok) return Response.json({ error: check.reason ?? "That doesn’t look like an email address." }, { status: 400 });
    answers[emailQ.id] = check.value;
  }
  const phoneQ = (form.questions as Question[]).find((q) => q.field === "phone");
  if (await overLimit(clientIp(req), phoneQ ? answers[phoneQ.id] ?? "" : "")) {
    return Response.json({ error: "We’ve had a lot of tries from you in the last hour. Please try again later, or message us on WhatsApp." }, { status: 429 });
  }

  try {
    // The contact's id makes the link to their booking page, shown on the
    // form's end screen. If their number matched an existing contact, it's theirs.
    // Events are newest first, so the first form.submitted is this one.
    const known = text(body.contactId, 40) || undefined; // from a personalised link (?c=…)
    const after = await applyAction("submitForm", [form.id as string, answers, utm, uid(), known]);
    const contactId = after.events.find((e) => e.type === "form.submitted")?.contactId;
    return Response.json({ ok: true, contactId });
  } catch (e) {
    console.error("[form submit]", params.slug, e);
    return Response.json({ error: "Couldn’t save your answers. Please try again." }, { status: 500 });
  }
}
