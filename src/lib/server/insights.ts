// After a WhatsApp reply lands: Claude reads the thread and leaves a note
// for staff on the contact, with a suggested reply that only a person can
// send (improvement item 16, Sammy 09/10/2026: "approval required before
// sending, don't want chatbot arguments"). Server-only; called by the
// WhatsApp webhook after the message is saved. Without ANTHROPIC_API_KEY
// nothing happens.

import { setInsight } from "@/lib/engine";
import { stageLabel } from "@/lib/types";
import { aiConfigured, readReplies } from "./ai";
import { getFacts } from "./enquiries";
import { applyMany, loadState } from "./state";

export async function readContactReplies(contactId: string) {
  if (!aiConfigured()) return { skipped: "no AI key" };
  const s = await loadState();
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return { skipped: "no contact" };
  const thread = s.messages.filter((m) => m.contactId === contactId).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-30);
  const incoming = thread.filter((m) => m.dir === "in");
  if (!incoming.length) return { skipped: "nothing from them" };
  // Only a STOP, or something with no words: not worth a read.
  const last = incoming[incoming.length - 1].text.trim();
  if (/^\s*(stop|unsubscribe|opt ?out)\s*[.!]?\s*$/i.test(last) || last.startsWith("[")) return { skipped: "nothing to read" };
  if (c.insight && c.insight.fromMessages === incoming.length) return { skipped: "already read" };
  const facts = await getFacts();
  const read = await readReplies({
    name: c.name, stage: stageLabel(c.stage), membership: c.membership?.name, trialAt: c.trialAt,
    answers: c.answers.filter((a) => a.answer), thread: thread.map((m) => ({ dir: m.dir, text: m.text, at: m.at })), facts,
  });
  await applyMany((st) => setInsight(st, contactId, { summary: read.summary, suggestedReply: read.suggestedReply || undefined, fromMessages: incoming.length }));
  return { ok: true };
}
