// Sends what the engine only recorded. The engine is pure and also runs in
// the browser, so it just logs an "email.sent" event, or adds an outgoing
// WhatsApp, Facebook or Instagram message to the thread; after the server
// has saved a change, this sends each one that change created. Each is
// saved once, so nothing is sent twice. Server-only.

import { placeholders, templateParams } from "@/lib/engine";
import { waNumber } from "@/lib/phone";
import { CHANNEL_LABEL, Contact, Message, SocialChannel, sourceLabel, State } from "@/lib/types";
import { db } from "./supabase";
import { sendEmail } from "./email";
import { emailHtml } from "./emailHtml";
import { sendSocial } from "./social";
import { sendTemplate, sendText } from "./whatsapp";

export const appUrl = () => (process.env.APP_URL || "https://round-one-crm.vercel.app").replace(/\/$/, "");

/** The contact's private booking page. */
export const bookLink = (contactId: string) => `${appUrl()}/book/${contactId}`;

/** The member's weekly check-in form (accountability programme). */
export const checkinLink = (contactId: string) => `${appUrl()}/f/check-in?c=${contactId}`;

/** The contact's unsubscribe page, on every marketing email. */
export const unsubscribeLink = (contactId: string) => `${appUrl()}/u/${contactId}`;
export const unsubscribeFooter = (contactId: string) =>
  `\n\n—\nYou’re getting this because you’re a member of Round One or have been in touch with us. To stop these emails: ${unsubscribeLink(contactId)}`;
export const unsubscribeHeaders = (contactId: string) => ({
  "List-Unsubscribe": `<${unsubscribeLink(contactId)}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

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

type TemplateRow = { name: string; body: string; language: string; category: string; header_video: string | null; button_url: string | null };

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
    else if (t.category === "marketing" && c.marketingOptOut) res = { ok: false as const, error: "Not sent: they’ve opted out of marketing messages" };
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

/**
 * A staff reply on Facebook or Instagram (Sammy, 14/10/2026). Meta takes it
 * within 24 hours of their last message, or up to 7 days as a person's reply
 * (the human agent tag); after that, not at all.
 */
async function sendSocialReply(m: Message, c: Contact | undefined, s: State) {
  const channel = m.channel as SocialChannel;
  const label = CHANNEL_LABEL[channel];
  const userId = c?.social?.[channel === "facebook" ? "facebookId" : "instagramId"];
  const lastIn = s.messages.filter((x) => x.contactId === m.contactId && x.dir === "in" && x.channel === channel).at(-1);
  const hours = lastIn ? (Date.parse(m.at) - Date.parse(lastIn.at)) / 3600e3 : Infinity;
  const res = !userId ? { ok: false as const, error: `They haven’t messaged us on ${label}` }
    : hours > 24 * 7 ? { ok: false as const, error: `More than 7 days since their last ${label} message, so Meta won’t take a reply` }
    : await sendSocial(channel, userId, m.text, hours > 24);
  if (res.ok) {
    if (!res.dryRun) await setMessage(m.id, { status: "sent", ...(res.id ? { provider_id: res.id } : {}) });
  } else {
    console.error("[deliver]", label, res.error);
    await setMessage(m.id, { status: "failed", error: res.error });
    await recordEvent("social.failed", c?.id, `${label} reply to ${c?.name ?? "unknown"} wasn’t sent: ${res.error}`);
  }
}

export async function deliver(before: State, after: State) {
  // Messages and emails go out side by side. Each stays in order within
  // itself: a contact's messages arrive in the order they were written, and
  // emails go one at a time (Resend limits how fast we can send).
  await Promise.all([deliverMessages(before, after), deliverEmails(before, after)]);
}

async function deliverMessages(before: State, after: State) {
  const sentBefore = new Set(before.messages.map((m) => m.id));
  // Replies staff sent from the Facebook or Instagram app have already gone.
  const outgoing = after.messages.filter((m) => m.dir === "out" && !m.external && !sentBefore.has(m.id));
  if (!outgoing.length) return;
  let templates: Map<string, TemplateRow> | undefined;
  for (const m of outgoing) {
    const c = after.contacts.find((x) => x.id === m.contactId);
    if (m.channel === "facebook" || m.channel === "instagram") { await sendSocialReply(m, c, after); continue; }
    if (!templates) {
      const { data } = await db().from("templates").select("name, body, language, category, header_video, button_url");
      templates = new Map(((data ?? []) as TemplateRow[]).map((t) => [t.name, t]));
    }
    await sendWhatsApp(m, c, templates);
  }
}

async function deliverEmails(before: State, after: State) {
  const seen = new Set(before.events.map((e) => e.id));
  const emails = after.events.filter((e) => e.type === "email.sent" && !seen.has(e.id) && e.data);
  for (const e of emails) {
    const { to, subject } = e.data!;
    if (e.data!.marketing === "yes" && after.contacts.find((x) => x.id === e.contactId)?.marketingOptOut) continue; // opted out
    const body = e.data!.body?.replaceAll("{bookLink}", bookLink(e.contactId ?? "")).replaceAll("{checkinLink}", checkinLink(e.contactId ?? ""));
    const contact = after.contacts.find((x) => x.id === e.contactId);
    let address: string | undefined;
    let text: string | undefined;
    if (to === "staff") {
      // A particular staff member (e.g. the member's coach), else the front desk.
      address = e.data!.address || process.env.STAFF_EMAIL || "info@round1boxfit.co.uk";
      text = [body, staffBody(after, e.contactId)].filter(Boolean).join("\n\n");
    } else if (contact?.email && body) {
      address = contact.email;
      text = body;
    }
    if (!address || !text) continue; // nothing to send (e.g. no email address for this person)
    // Marketing emails (e.g. the win-back) go from info@ like mailouts, so
    // replies land in the inbox and flow into Enquiries; service emails stay on bookings@.
    const marketing = e.data!.marketing === "yes" && to === "contact" && contact;
    // Emails to the person get light HTML for the link buttons; staff alerts stay plain.
    const res = marketing
      ? await sendEmail(address, subject, text.trimEnd() + unsubscribeFooter(contact.id), { from: process.env.ENQUIRIES_FROM || "Round One <info@round1boxfit.co.uk>", headers: unsubscribeHeaders(contact.id), html: emailHtml(text, { unsubscribe: unsubscribeLink(contact.id) }) })
      : await sendEmail(address, subject, text, to === "contact" ? { html: emailHtml(text) } : {});
    if (!res.ok) {
      console.error("[deliver]", subject, res.error);
      await recordEvent("email.failed", e.contactId, `Email “${subject}” to ${address} wasn’t sent: ${res.error}`);
    }
  }
}
