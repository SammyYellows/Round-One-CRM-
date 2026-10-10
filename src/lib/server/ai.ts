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
  /** Where the reply should go when the sender address can't be replied to (e.g. a website form notification). */
  replyTo?: string;
}

const VOICE = `You work on the front desk at ${GYM.name}, a boxing and strength gym in Bristol, answering emails sent to the gym's inbox. A staff member reads and edits everything you write before it is sent, so write the reply as them, ready to send.

How to write: British English, plain and friendly, like a good front desk. Sentence case. Short paragraphs. No exclamation marks, no emoji, no marketing fluff. Answer what was asked, then offer the obvious next step (usually booking a free intro session, which staff do by sending a booking link, or pointing at the TeamUp app). Sign off with "${GYM.signOff}".

Facts: only state things that are in the facts sheet below or in the email itself. Never invent prices, class times, opening hours, availability or policies. If the facts sheet doesn't cover something, say a colleague will confirm it, and don't guess. Where the facts sheet says "check" or "ask staff", say you'll confirm rather than quoting it as certain.

Some emails are notifications from a website contact form or a booking system, sent from a no-reply address with the real person's name and email address inside the body. Those are enquiries from that person: address the draft to them, and put their email address in replyTo. Otherwise leave replyTo empty.

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
              replyTo: { type: "string", description: "The real person's email address when the email is a form or system notification; otherwise an empty string." },
            },
            required: ["kind", "summary", "draft", "replyTo"],
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
  const replyTo = String(out.replyTo ?? "").trim().toLowerCase();
  return { kind, summary: String(out.summary ?? "").trim(), draft: kind === "other" ? "" : String(out.draft ?? "").trim(), replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? replyTo : undefined };
}

/**
 * Rewrites the current draft the way the staff member asks ("shorter",
 * "mention the Saturday class", "firmer about the refund"). Same voice and
 * facts rules; the email and the current draft are both in front of it.
 */
export async function rewriteDraft(input: DraftInput & { currentDraft: string; instruction: string }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY isn’t set");
  const body = input.text.length > 8000 ? input.text.slice(0, 8000) + "\n[trimmed]" : input.text;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: VOICE },
        { type: "text", text: `FACTS SHEET\n\n${input.facts}`, cache_control: { type: "ephemeral" } },
      ],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object", properties: { draft: { type: "string" } }, required: ["draft"], additionalProperties: false } },
      },
      messages: [
        {
          role: "user",
          content:
            `The email we're replying to:\nFrom: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}\nSubject: ${input.subject || "(no subject)"}\n\n${body || "(no text)"}` +
            `\n\n---\nThe current draft reply:\n\n${input.currentDraft || "(empty)"}` +
            `\n\n---\nThe staff member's instruction for the rewrite: ${input.instruction}` +
            `\n\nRewrite the draft to follow that instruction. Keep everything else that still fits. Same rules as always: only facts from the facts sheet or the email, no exclamation marks, sign off with "${GYM.signOff}". Return the full new draft.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Anthropic said ${res.status}`);
  }
  const json = (await res.json()) as { stop_reason?: string; content: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new Error("The AI declined to rewrite this");
  const text = json.content.find((c) => c.type === "text")?.text ?? "{}";
  const out = JSON.parse(text) as { draft?: string };
  return String(out.draft ?? "").trim();
}

/**
 * Rewrites an email template (sent to many people, so it keeps the
 * placeholders) the way the staff member asks. Returns subject and body.
 */
export async function rewriteTemplate(input: { subject: string; body: string; instruction: string; facts: string; purpose: string }): Promise<{ subject: string; body: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY isn’t set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: VOICE },
        { type: "text", text: `FACTS SHEET\n\n${input.facts}`, cache_control: { type: "ephemeral" } },
      ],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"], additionalProperties: false } },
      },
      messages: [
        {
          role: "user",
          content:
            `This is an email TEMPLATE, not a reply to one person. Purpose: ${input.purpose}\n\n` +
            `It is sent automatically to many people, so it uses placeholders in curly braces that the system fills in per person: {first} (first name), {name} (full name), {gym} (the gym's name), {team} (the sign-off "${GYM.signOff}"), {address}. Keep the placeholders exactly as written, braces included; never replace them with a real name or make up new ones. Address the reader as {first}. End with {team} on its own line.\n\n` +
            `Current subject: ${input.subject}\n\nCurrent body:\n${input.body}\n\n---\nThe staff member's instruction: ${input.instruction}\n\nRewrite the template to follow the instruction, keeping everything that still fits. Facts only from the facts sheet; no exclamation marks. Return the new subject and body.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Anthropic said ${res.status}`);
  }
  const json = (await res.json()) as { stop_reason?: string; content: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new Error("The AI declined to rewrite this");
  const out = JSON.parse(json.content.find((c) => c.type === "text")?.text ?? "{}") as { subject?: string; body?: string };
  return { subject: String(out.subject ?? "").trim(), body: String(out.body ?? "").trim() };
}

/** Sums up what people who gave notice said in their replies, for the managers' report. Facts only from the replies. */
export async function summariseCancellations(items: { name: string; membership: string; reply: string }[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !items.length) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: `You write a short, plain summary for the managers of ${GYM.name}, a gym in Bristol, of why members who gave notice to cancel said they were leaving, based only on their own email replies. British English, sentence case, no exclamation marks. Group the reasons (e.g. moving away, cost, injury, not using it, switching gym), say how many gave each, name who said what in brackets, and point out anything the gym could act on (e.g. someone who would stay for a different class time). Never invent reasons; if a reply doesn't say why, say so. 120 words at most.`,
      messages: [{ role: "user", content: items.map((i) => `${i.name} (${i.membership}):\n${i.reply}`).join("\n\n---\n\n") }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic said ${res.status}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return (json.content.find((c) => c.type === "text")?.text ?? "").trim();
}

export interface CheckinRead { status: "on_track" | "slipping" | "struggling" | "wants_coach"; sentiment: "up" | "flat" | "down"; flagCoach: boolean; reply: string; adjust: "keep" | "lower" | "raise" | "talk"; note: string }

/**
 * Reads a member's weekly check-in against their commitment and attendance
 * (docs/accountability.md, Scenario B) and suggests a reply in their chosen
 * tone. Staff see and approve the reply before anything is sent.
 */
export async function readCheckin(input: { first: string; floor: number; stretch: number; why: string; style: string; thisWeek: number; lastWeek: number; feel: string; blocker?: string; play: string; recent: string[] }): Promise<CheckinRead> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY isn’t set");
  const tone = input.style === "straight" ? "Straight talk: direct, no cushioning, no lecture, respect them enough to be blunt." : input.style === "facts" ? "Just the facts: numbers and next step, no feelings talk." : "Encouragement: warm and specific, never gushing.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: `You are a coach at ${GYM.name}, a boxing and strength gym in Bristol, replying to a member's weekly accountability check-in. A staff member reads and edits your reply before it is sent. British English, plain, sentence case, no exclamation marks, no emoji, at most 80 words. Address them by first name. Tone: ${tone} Quote their own "why" back only when motivation is the problem. Never invent facts about the gym, classes or prices. Sign off "${GYM.signOff}".`,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object", properties: {
          status: { type: "string", enum: ["on_track", "slipping", "struggling", "wants_coach"] },
          sentiment: { type: "string", enum: ["up", "flat", "down"] },
          flagCoach: { type: "boolean", description: "True if a coach should speak to them in person this week." },
          reply: { type: "string", description: "The reply, ready to send." },
          adjust: { type: "string", enum: ["keep", "lower", "raise", "talk"], description: "What should happen to their target." },
          note: { type: "string", description: "One line for staff only: what you noticed and why you replied this way." },
        }, required: ["status", "sentiment", "flagCoach", "reply", "adjust", "note"], additionalProperties: false } },
      },
      messages: [{ role: "user", content:
        `Member: ${input.first}. Floor: ${input.floor} sessions a week. Stretch: ${input.stretch}. Their why: "${input.why}".\n` +
        `This week: ${input.thisWeek} sessions. Last week: ${input.lastWeek}.\n` +
        `Check-in answers: how the week felt: "${input.feel}". What got in the way: "${input.blocker || "(nothing written)"}". Next week's play: "${input.play}".\n` +
        (input.recent.length ? `Previous check-ins, newest first: ${input.recent.join(" | ")}\n` : "") +
        `If their floor is already above what they are managing and they chose "lower the target", say that is a sensible call. If they asked for a coach, keep the reply short and say a coach will catch them this week.` }],
    }),
  });
  if (!res.ok) { const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }; throw new Error(err.error?.message || `Anthropic said ${res.status}`); }
  const json = (await res.json()) as { stop_reason?: string; content: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new Error("The AI declined");
  const out = JSON.parse(json.content.find((c) => c.type === "text")?.text ?? "{}") as Partial<CheckinRead>;
  return { status: out.status ?? "slipping", sentiment: out.sentiment ?? "flat", flagCoach: !!out.flagCoach, reply: String(out.reply ?? "").trim(), adjust: out.adjust ?? "keep", note: String(out.note ?? "").trim() };
}

/**
 * Reads what a contact has said in their WhatsApp replies and writes a short
 * note for staff plus a suggested reply (improvement item 16). The reply is
 * only ever sent by a person; this never argues, sells hard or promises.
 */
export async function readReplies(input: { name: string; stage: string; membership?: string; trialAt?: string; answers: { question: string; answer: string }[]; thread: { dir: "in" | "out"; text: string; at: string }[]; facts: string }): Promise<{ summary: string; suggestedReply: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY isn’t set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: [
        { type: "text", text: VOICE },
        { type: "text", text: `FACTS SHEET\n\n${input.facts}`, cache_control: { type: "ephemeral" } },
      ],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object", properties: {
          summary: { type: "string", description: "For staff: what this person has told us across their messages. Goals, worries, timing, constraints, anything to remember. Their own words where it helps. 2 to 5 short lines. Empty string if they've said nothing of substance." },
          suggestedReply: { type: "string", description: "A reply to their latest message for a staff member to send, in the gym's voice, at most 60 words. If their last message needs no reply (e.g. 'thanks'), or if replying would mean arguing or negotiating, an empty string." },
        }, required: ["summary", "suggestedReply"], additionalProperties: false } },
      },
      messages: [{ role: "user", content:
        `Contact: ${input.name}. Pipeline stage: ${input.stage}.${input.membership ? ` Membership: ${input.membership}.` : ""}${input.trialAt ? ` Intro meeting booked: ${input.trialAt}.` : ""}\n` +
        (input.answers.length ? `Questionnaire: ${input.answers.map((a) => `${a.question} ${a.answer}`).join(" | ")}\n` : "") +
        `WhatsApp thread, oldest first (OUT is us, IN is them):\n${input.thread.map((m) => `${m.dir === "in" ? "IN" : "OUT"} ${m.at.slice(0, 16)}: ${m.text}`).join("\n")}\n\n` +
        `Write the staff note from what THEY said (the IN messages). Then suggest a reply to their latest message. The reply must not argue, haggle, defend the gym, or make offers that aren't on the facts sheet; if the right move is a human conversation, say so briefly and warmly and leave it there. A staff member decides whether to send it.` }],
    }),
  });
  if (!res.ok) { const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }; throw new Error(err.error?.message || `Anthropic said ${res.status}`); }
  const json = (await res.json()) as { stop_reason?: string; content: { type: string; text?: string }[] };
  if (json.stop_reason === "refusal") throw new Error("The AI declined");
  const out = JSON.parse(json.content.find((c) => c.type === "text")?.text ?? "{}") as { summary?: string; suggestedReply?: string };
  return { summary: String(out.summary ?? "").trim(), suggestedReply: String(out.suggestedReply ?? "").trim() };
}
