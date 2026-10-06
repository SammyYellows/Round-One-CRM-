// Email enquiries (docs/email-enquiries.md). Server-only. An email to info@
// reaches us through Resend's receiving webhook; we keep it, let the AI say
// whether it's an enquiry and draft a reply, and tell the front desk. The
// reply only goes when a staff member presses Send and confirms.

import { addContact } from "@/lib/engine";
import { GYM } from "@/lib/gym";
import { aiConfigured, draftReply, rewriteDraft } from "./ai";
import { appUrl } from "./deliver";
import { fetchReceivedEmail, listReceivedEmailIds, sendEmail } from "./email";
import { applyMany } from "./state";
import { db } from "./supabase";

export type EnquiryStatus = "new" | "drafted" | "sent" | "dismissed";
export type EnquiryKind = "unknown" | "enquiry" | "other";

export interface Enquiry {
  id: string;
  resendId: string;
  messageId: string | null;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null; // where the reply goes when not the sender (form notifications); staff can change it
  toEmail: string | null;
  subject: string;
  text: string;
  receivedAt: string;
  kind: EnquiryKind;
  summary: string | null;
  draft: string | null;
  status: EnquiryStatus;
  contactId: string | null;
  replyText: string | null;
  sentAt: string | null;
  sentBy: string | null;
  error: string | null;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));

const fromRow = (r: Row): Enquiry => ({
  id: r.id as string, resendId: r.resend_id as string, messageId: str(r.message_id), fromEmail: r.from_email as string,
  fromName: str(r.from_name), replyTo: str(r.reply_to), toEmail: str(r.to_email), subject: (r.subject as string) ?? "", text: (r.text as string) ?? "",
  receivedAt: r.received_at as string, kind: (r.kind as EnquiryKind) ?? "unknown", summary: str(r.summary), draft: str(r.draft),
  status: r.status as EnquiryStatus, contactId: str(r.contact_id), replyText: str(r.reply_text), sentAt: str(r.sent_at),
  sentBy: str(r.sent_by), error: str(r.error),
});

const COLUMNS = "id, resend_id, message_id, from_email, from_name, reply_to, to_email, subject, text, received_at, kind, summary, draft, status, contact_id, reply_text, sent_at, sent_by, error";

/** The address replies go out as. info@ so the conversation stays in the gym's inbox. */
export const enquiriesFrom = () => process.env.ENQUIRIES_FROM || `${GYM.name} <info@round1boxfit.co.uk>`;

const addressOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
const nameOf = (s: string) => s.replace(/<[^>]*>/, "").replace(/^"|"$/g, "").trim();

/** Addresses we send from or alert to: mail from them is our own, not an enquiry. */
function ourAddresses() {
  return [process.env.EMAIL_FROM, process.env.ENQUIRIES_FROM, process.env.STAFF_EMAIL, enquiriesFrom()].filter((x): x is string => !!x).map(addressOf);
}

export async function listEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await db().from("enquiries").select(COLUMNS).order("received_at", { ascending: false }).limit(300);
  if (error) throw new Error(`Loading enquiries: ${error.message}`);
  return (data as Row[]).map(fromRow);
}

export async function getEnquiry(id: string): Promise<Enquiry | null> {
  const { data, error } = await db().from("enquiries").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Loading enquiry: ${error.message}`);
  return data ? fromRow(data as Row) : null;
}

export async function getFacts(): Promise<string> {
  const { data } = await db().from("settings").select("value").eq("id", "gym_facts").maybeSingle();
  return typeof data?.value === "string" ? data.value : "";
}

export async function saveFacts(facts: string) {
  const { error } = await db().from("settings").upsert({ id: "gym_facts", value: facts, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Saving facts: ${error.message}`);
}

async function update(id: string, patch: Row) {
  const { error } = await db().from("enquiries").update(patch).eq("id", id);
  if (error) throw new Error(`Saving enquiry: ${error.message}`);
}

async function recordEvent(type: "email.received" | "email.replied", contactId: string, detail: string, data: Record<string, string> = {}) {
  const { error } = await db().from("events").insert({ id: crypto.randomUUID(), type, contact_id: contactId, detail, data });
  if (error) console.error("[enquiries] couldn't record", type, error.message);
}

/** Resend told us an email arrived: fetch it, keep it, read it. */
export async function ingestReceived(resendId: string) {
  const existing = await db().from("enquiries").select("id").eq("resend_id", resendId).maybeSingle();
  if (existing.data) return { ok: true, duplicate: true };
  const mail = await fetchReceivedEmail(resendId);
  const fromEmail = addressOf(mail.from);
  if (!fromEmail || ourAddresses().includes(fromEmail)) return { ok: true, skipped: "our own mail" };
  const id = crypto.randomUUID();
  const { error } = await db().from("enquiries").insert({
    id, resend_id: resendId, message_id: mail.messageId || null, from_email: fromEmail, from_name: nameOf(mail.from) || null,
    to_email: mail.to[0] ?? null, subject: mail.subject, text: mail.text || stripHtml(mail.html), html: mail.html, received_at: mail.createdAt,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true }; // two webhooks for one email
    throw new Error(`Saving enquiry: ${error.message}`);
  }
  await processEnquiry(id);
  return { ok: true, id };
}

/**
 * Safety net, run by /api/cron: any received email Resend has that we don't
 * (a missed or failed webhook call) is pulled in. Newest 50 are checked.
 */
export async function catchUpReceived(maxPerRun = 5) {
  if (!process.env.RESEND_API_KEY) return { checked: 0, added: 0, reprocessed: 0 };
  let budget = maxPerRun; // each email costs an AI call; stay well inside the function's time
  // First, anything a cut-off run left without a verdict.
  const { data: stuck } = await db().from("enquiries").select("id").eq("kind", "unknown").eq("status", "new").is("error", null).order("received_at").limit(budget);
  let reprocessed = 0;
  for (const r of (stuck as { id: string }[] | null) ?? []) {
    try { await processEnquiry(r.id); reprocessed++; budget--; } catch (e) { console.error("[enquiries] reprocess failed for", r.id, e instanceof Error ? e.message : e); }
  }
  if (budget <= 0) return { checked: 0, added: 0, reprocessed };
  // Then anything Resend has that we don't.
  const ids = await listReceivedEmailIds(50);
  if (!ids.length) return { checked: 0, added: 0, reprocessed };
  const { data } = await db().from("enquiries").select("resend_id").in("resend_id", ids);
  const known = new Set(((data as { resend_id: string }[] | null) ?? []).map((r) => r.resend_id));
  let added = 0;
  for (const id of ids.filter((x) => !known.has(x)).reverse().slice(0, budget)) {
    try {
      const r = await ingestReceived(id);
      if ("id" in r) added++;
    } catch (e) {
      console.error("[enquiries] catch-up failed for", id, e instanceof Error ? e.message : e);
    }
  }
  return { checked: ids.length, added, reprocessed };
}

const stripHtml = (html: string | null) =>
  (html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();

/**
 * Reads one saved email: is it an enquiry, who is it from, what should we
 * say back. Also used by "Draft again". Never sends the reply.
 */
export async function processEnquiry(id: string) {
  const e = await getEnquiry(id);
  if (!e || e.status === "sent") return;
  let match: Row | null = null;
  let contactId: string | null = e.contactId ?? null;
  let kind: EnquiryKind = "unknown";
  let summary = "";
  let draft = "";
  let replyTo: string | null = e.replyTo;
  let error: string | null = null;
  const findContact = async (email: string) => (await db().from("contacts").select("id, name, stage, trial_at, membership").ilike("email", email).limit(1).maybeSingle()).data as Row | null;
  match = await findContact(e.fromEmail);
  if (aiConfigured()) {
    try {
      const facts = await getFacts();
      const membership = (match?.membership as { name?: string; status?: string } | null) ?? null;
      const out = await draftReply({
        fromName: e.fromName ?? "", fromEmail: e.fromEmail, subject: e.subject, text: e.text, facts,
        contact: match
          ? { name: match.name as string, stage: match.stage as string, trialAt: (match.trial_at as string) ?? undefined, membership: membership ? `${membership.name} (${membership.status})` : undefined }
          : undefined,
      });
      kind = out.kind;
      summary = out.summary;
      draft = out.draft;
      if (out.replyTo && out.replyTo !== e.fromEmail) {
        replyTo = out.replyTo;
        match = (await findContact(out.replyTo)) ?? match; // the real person, not the form's no-reply address
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error("[enquiries] AI failed", error);
    }
  }

  // An enquiry from someone new becomes a contact, so the thread has a home.
  if (!contactId && match) contactId = match.id as string;
  if (kind !== "other" && !contactId) {
    const address = replyTo ?? e.fromEmail;
    const name = replyTo ? address.split("@")[0] : e.fromName || e.fromEmail.split("@")[0];
    contactId = await applyMany((s) => addContact(s, { name, phone: "", email: address, source: "email" }));
  }
  if (kind !== "other" && contactId) await recordEvent("email.received", contactId, `Email: ${e.subject || "(no subject)"}`, { enquiryId: id });

  await update(id, {
    kind, summary: summary || null, draft: draft || null, contact_id: contactId, error, reply_to: replyTo,
    status: e.status === "dismissed" ? "dismissed" : draft ? "drafted" : "new",
  });

  // Tell the front desk, unless it's clearly not an enquiry.
  if (kind !== "other" && process.env.STAFF_EMAIL) {
    const who = e.fromName ? `${e.fromName} (${e.fromEmail})` : e.fromEmail;
    const lines = [
      draft ? "A reply is drafted and waiting for you to check and send." : aiConfigured() ? "No draft could be made; please reply by hand." : "The AI isn’t set up yet, so there’s no draft; please reply by hand.",
      "",
      `From: ${who}`,
      `Subject: ${e.subject || "(no subject)"}`,
      ...(summary ? [`In short: ${summary}`] : []),
      ...(error ? [`AI problem: ${error}`] : []),
      "",
      `Open it: ${appUrl()}/enquiries?id=${id}`,
    ];
    await sendEmail(process.env.STAFF_EMAIL, `${draft ? "Draft ready" : "New email enquiry"}: ${e.subject || who}`, lines.join("\n"));
  }
}

/** Staff pressed Send and confirmed. Sends the reply as info@, in the same thread. */
export async function sendReply(id: string, text: string, staffName: string) {
  const e = await getEnquiry(id);
  if (!e) return { ok: false as const, error: "That enquiry isn’t there any more" };
  if (e.status === "sent") return { ok: false as const, error: "This reply has already been sent" };
  const body = text.trim();
  if (!body) return { ok: false as const, error: "The reply is empty" };
  const subject = /^re:/i.test(e.subject) ? e.subject : `Re: ${e.subject || "Your message to Round One"}`;
  const headers = e.messageId ? { "In-Reply-To": e.messageId, References: e.messageId } : undefined;
  const to = (e.replyTo ?? e.fromEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false as const, error: "That send-to address doesn’t look right" };
  const sent = await sendEmail(to, subject, body, { from: enquiriesFrom(), headers });
  if (!sent.ok) {
    await update(id, { error: sent.error });
    return { ok: false as const, error: sent.error };
  }
  const now = new Date().toISOString();
  await update(id, { status: "sent", reply_text: body, sent_at: now, sent_by: staffName, sent_id: sent.id ?? null, error: null, draft: body });
  if (e.contactId) await recordEvent("email.replied", e.contactId, `Replied by email to ${to}: ${subject}`, { enquiryId: id, by: staffName });
  return { ok: true as const, dryRun: sent.dryRun };
}

/** Staff changed where the reply should go. */
export async function setReplyTo(id: string, replyTo: string) {
  const e = await getEnquiry(id);
  if (!e || e.status === "sent") return false;
  const v = replyTo.trim().toLowerCase();
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
  await update(id, { reply_to: v && v !== e.fromEmail ? v : null });
  return true;
}

export async function saveDraft(id: string, draft: string) {
  const e = await getEnquiry(id);
  if (!e || e.status === "sent") return;
  await update(id, { draft: draft || null, status: e.status === "dismissed" ? "dismissed" : draft.trim() ? "drafted" : "new" });
}

export async function setDismissed(id: string, dismissed: boolean) {
  const e = await getEnquiry(id);
  if (!e || e.status === "sent") return;
  await update(id, { status: dismissed ? "dismissed" : e.draft ? "drafted" : "new" });
}

/** Staff typed what they want changed; the AI rewrites the draft (saved, never sent). */
export async function rewriteEnquiryDraft(id: string, currentDraft: string, instruction: string) {
  const e = await getEnquiry(id);
  if (!e || e.status === "sent") return { ok: false as const, error: "This one has already been sent" };
  if (!aiConfigured()) return { ok: false as const, error: "The AI isn’t set up" };
  if (!instruction.trim()) return { ok: false as const, error: "Say what you’d like changed" };
  try {
    const facts = await getFacts();
    const draft = await rewriteDraft({ fromName: e.fromName ?? "", fromEmail: e.fromEmail, subject: e.subject, text: e.text, facts, currentDraft, instruction: instruction.slice(0, 1000) });
    if (!draft) return { ok: false as const, error: "The AI came back empty" };
    await update(id, { draft, status: e.status === "dismissed" ? "dismissed" : "drafted", error: null });
    return { ok: true as const, draft };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error };
  }
}
