// Sends what the engine only recorded. The engine is pure and also runs in
// the browser, so it just logs an "email.sent" event, or adds an outgoing
// WhatsApp message to the thread; after the server has saved a change, this
// sends each email and WhatsApp that change created. Each is saved once, so
// nothing is sent twice. Server-only.

import { placeholders, templateParams } from "@/lib/engine";
import { waNumber } from "@/lib/phone";
import { Contact, Message, sourceLabel, State } from "@/lib/types";
import { db } from "./supabase";
import { sendEmail } from "./email";
import { sendTemplate, sendText } from "./whatsapp";

export const appUrl = () => (process.env.APP_URL || "https://round-one-crm.vercel.app").replace(/\/$/, "");

/** The contact's private booking page. */
export const bookLink = (contactId: string) => `${appUrl()}/book/${contactId}`;

/** What the front desk needs to act on a lead, in plain text. */
function staffBody(s: State, contactId: string | undefined) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return "";
  const campaign = s.campaigns.find((k) => k.utm === c.campaign)?.name ?? c.campaign;
  const lines = [
    c.name,
    "",
    `Mobile: ${c.phone || "not given"}`,
    `Email: ${c.email || "not given"}`,
    `Source: ${sourceLabel(c.source)}`,
    ...(c.ad || campaign ? [`Ad: ${[c.ad, [campaign, c.adset].filter(Boolean).join(" · ")].filter(Boolean).join(" – ")}`] : []),
    ...(c.answers.length ? ["", ...c.answers.map((a) => `${a.question} ${a.answer || "(skipped)"}`)] : []),
    "",
    `Open in the CRM: ${appUrl()}/contacts/${c.id}`,
  ];
  return lines.join("\n");
}

async function recordEvent(type: string, contactId: string | undefined, detail: string) {
  const { error } = await db().from("events").insert({ id: crypto.randomUUID(), type, contact_id: contactId ?? null, detail, data: {} });
  if (error) console.error("[deliver] couldn't record", type, error.message);
}

async function setMessage(id: string, patch: { status: string; provider_id?: string; error?: string }) {
  const { error } = await db().from("messages").update(patch).eq("id", id);
  if (error) console.error("[deliver] couldn't update message", id, error.message);
}

type TemplateRow = { name: string; body: string; language: string; header_video: string | null; button_url: string | null };

/** A public link to a file in the whatsapp-media storage bucket. */
const mediaUrl = (file: string) =>
  /^https?:/.test(file) ? file : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${file}`;

async function sendWhatsApp(m: Message, c: Contact | undefined, templates: Map<string, TemplateRow>) {
  const to = c ? waNumber(c.phone) : "";
  let res;
  if (!c || to.length < 10) {
    res = { ok: false as const, error: "No mobile number for this contact" };
  } else if (m.template) {
    const t = templates.get(m.template);
    if (!t) res = { ok: false as const, error: `No template called ${m.template}` };
    else {
      const v = placeholders(c);
      res = await sendTemplate(to, {
        name: t.name,
        language: t.language,
        params: templateParams(t.body).map((k) => v[k] ?? k),
        videoUrl: t.header_video ? mediaUrl(t.header_video) : undefined,
        buttonParam: t.button_url?.includes("{{1}}") ? c.id : undefined,
      });
    }
  } else {
    res = await sendText(to, m.text);
  }
  if (res.ok) {
    if (!res.dryRun) await setMessage(m.id, { status: "sent", ...(res.id ? { provider_id: res.id } : {}) });
  } else {
    console.error("[deliver] WhatsApp", m.template ?? "reply", res.error);
    await setMessage(m.id, { status: "failed", error: res.error });
    await recordEvent("whatsapp.failed", c?.id, `WhatsApp ${m.template ?? "reply"} to ${c?.name ?? "unknown"} wasn’t sent: ${res.error}`);
  }
}

export async function deliver(before: State, after: State) {
  const sentBefore = new Set(before.messages.map((m) => m.id));
  const outgoing = after.messages.filter((m) => m.dir === "out" && !sentBefore.has(m.id));
  if (outgoing.length) {
    const { data } = await db().from("templates").select("name, body, language, header_video, button_url");
    const templates = new Map(((data ?? []) as TemplateRow[]).map((t) => [t.name, t]));
    for (const m of outgoing) await sendWhatsApp(m, after.contacts.find((x) => x.id === m.contactId), templates);
  }

  const seen = new Set(before.events.map((e) => e.id));
  const emails = after.events.filter((e) => e.type === "email.sent" && !seen.has(e.id) && e.data);
  for (const e of emails) {
    const { to, subject } = e.data!;
    const body = e.data!.body?.replaceAll("{bookLink}", bookLink(e.contactId ?? ""));
    const contact = after.contacts.find((x) => x.id === e.contactId);
    let address: string | undefined;
    let text: string | undefined;
    if (to === "staff") {
      address = process.env.STAFF_EMAIL || "info@round1boxfit.co.uk";
      text = [body, staffBody(after, e.contactId)].filter(Boolean).join("\n\n");
    } else if (contact?.email && body) {
      address = contact.email;
      text = body;
    }
    if (!address || !text) continue; // nothing to send (e.g. no email address for this person)
    const res = await sendEmail(address, subject, text);
    if (!res.ok) {
      console.error("[deliver]", subject, res.error);
      await recordEvent("email.failed", e.contactId, `Email “${subject}” to ${address} wasn’t sent: ${res.error}`);
    }
  }
}
