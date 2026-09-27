// Sends what the engine only recorded. The engine is pure and also runs in
// the browser, so it just logs an "email.sent" event with the details; after
// the server has saved a change, this sends an email for each such event
// that change created. Each event is saved once, so nothing is sent twice.
// Server-only.

import { sourceLabel, State } from "@/lib/types";
import { db } from "./supabase";
import { sendEmail } from "./email";

const appUrl = () => (process.env.APP_URL || "https://round-one-crm.vercel.app").replace(/\/$/, "");

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

async function recordFailure(contactId: string | undefined, detail: string) {
  const { error } = await db()
    .from("events")
    .insert({ id: crypto.randomUUID(), type: "email.failed", contact_id: contactId ?? null, detail, data: {} });
  if (error) console.error("[deliver] couldn't record failure", error.message);
}

export async function deliver(before: State, after: State) {
  const seen = new Set(before.events.map((e) => e.id));
  const emails = after.events.filter((e) => e.type === "email.sent" && !seen.has(e.id) && e.data);
  for (const e of emails) {
    const { to, subject, body } = e.data!;
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
      await recordFailure(e.contactId, `Email “${subject}” to ${address} wasn’t sent: ${res.error}`);
    }
  }
}
