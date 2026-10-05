// Claude, over plain fetch to Anthropic's Messages API. Server-only. Used to
// read an email enquiry and draft a reply for staff to check; nothing it
// writes is ever sent without a person pressing Send. Without
// ANTHROPIC_API_KEY it answers "not set up" and no draft is made.

import { GYM } from "@/lib/gym";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export interface DraftInput {
  fromName: string;
  fromEmail: string;
  subject: string;
  text: string;
  facts: string;
  /** What the CRM already knows about the sender, if anything. */
  contact?: { name: string; stage: string; trialAt?: string; membership?: string };
}

export interface DraftResult {
  kind: "enquiry" | "other";
  summary: string;
  draft: string;
}

const VOICE = `You work on the front desk at ${GYM.name}, a boxing and strength gym in Bristol, answering emails sent to the gym's inbox. A staff member reads and edits everything you write before it is sent, so write the reply as them, ready to send.

How to write: British English, plain and friendly, like a good front desk. Sentence case. Short paragraphs. No exclamation marks, no emoji, no marketing fluff. Answer what was asked, then offer the obvious next step (usually booking a free intro session, which staff do by sending a booking link, or pointing at the TeamUp app). Sign off with "${GYM.signOff}".

Facts: only state things that are in the facts sheet below or in the email itself. Never invent prices, class times, opening hours, availability or policies. If the facts sheet doesn't cover something, say a colleague will confirm it, and don't guess. Where the facts sheet says "check" or "ask staff", say you'll confirm rather than quoting it as certain.

First decide what the email is. "enquiry" means a person asking the gym something or wanting something: trials, memberships, prices, classes, kids, personal training, bookings, cancellations, complaints, lost property, anything a human wrote that wants a human answer. "other" means newsletters, receipts, invoices, automated notifications, delivery reports, spam, cold sales pitches to the gym, and out-of-office replies. For "other", leave the draft empty.`;

/** Classifies an email and drafts the reply. Throws if the API fails. */
export async function draftReply(input: DraftInput): Promise<DraftResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY isn’t set");
  const body = input.text.length > 8000 ? input.text.slice(0, 8000) + "\n[trimmed]" : input.text;
  const known = input.contact
    ? `\n\nThe CRM already knows this sender: ${input.contact.name}, pipeline stage "${input.contact.stage}"${input.contact.trialAt ? `, free trial booked for ${input.contact.trialAt}` : ""}${input.contact.membership ? `, membership: ${input.contact.membership}` : ""}.`
    : "\n\nThe sender isn't in the CRM yet.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: VOICE },
        // The facts sheet is the same for every email, so it's cached.
        { type: "text", text: `FACTS SHEET\n\n${input.facts}`, cache_control: { type: "ephemeral" } },
      ],
      // Structured output: the reply comes back as JSON matching this shape.
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["enquiry", "other"] },
              summary: { type: "string", description: "One plain sentence saying who is asking what, for the staff list." },
              draft: { type: "string", description: "The full reply, ready to send, or empty for 'other'." },
            },
            required: ["kind", "summary", "draft"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `From: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}\nSubject: ${input.subject || "(no subject)"}\n\n${body || "(no text)"}${known}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Anthropic said ${res.status}`);
  }
  const json = (await res.json()) as { stop_reason?: string; content: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new Error("The AI declined to answer this email");
  const text = json.content.find((c) => c.type === "text")?.text ?? "{}";
  let out: Partial<DraftResult> = {};
  try { out = JSON.parse(text) as Partial<DraftResult>; } catch { throw new Error("The AI's answer wasn’t valid JSON"); }
  const kind = out.kind === "other" ? "other" : "enquiry";
  return { kind, summary: String(out.summary ?? "").trim(), draft: kind === "other" ? "" : String(out.draft ?? "").trim() };
}
