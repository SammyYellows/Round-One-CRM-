// After a WhatsApp, Facebook or Instagram message lands: Claude reads the
// thread and leaves a note for staff on the contact, with a suggested reply
// that only a person can send (improvement item 16, Sammy 09/10/2026: "approval required before
// sending, don't want chatbot arguments"). Server-only; called by Meta's
// webhooks after the message is saved. Without ANTHROPIC_API_KEY
// nothing happens.

import { addTask, setInsight } from "@/lib/engine";
import { CHANNEL_LABEL, stageLabel } from "@/lib/types";
import { aiConfigured, readReplies } from "./ai";
import { getFacts } from "./enquiries";
import { applyMany, loadState } from "./state";

/** More than any real conversation; only a very long one is cut, from the start. */
const MAX_MESSAGES = 400;

/** `force`: staff pressed "Draft a reply", so read it again even if nothing new has come in. */
export async function readContactReplies(contactId: string, opts: { force?: boolean } = {}) {
  if (!aiConfigured()) return { skipped: "no AI key" };
  const s = await loadState();
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return { skipped: "no contact" };
  // The whole conversation, not just the end of it (Sammy, 15/10/2026). Capped
  // only for the rare very long one, and the AI is told what was left out.
  const all = s.messages.filter((m) => m.contactId === contactId).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const thread = all.slice(-MAX_MESSAGES);
  const incoming = all.filter((m) => m.dir === "in");
  if (!incoming.length) return { skipped: "nothing from them" };
  // Only a STOP, or something with no words: not worth a read.
  const last = incoming[incoming.length - 1].text.trim();
  if (/^\s*(stop|unsubscribe|opt ?out)\s*[.!]?\s*$/i.test(last) || last.startsWith("[")) return { skipped: "nothing to read" };
  if (!opts.force && c.insight && c.insight.fromMessages === incoming.length) return { skipped: "already read" };
  const facts = await getFacts();
  const read = await readReplies({
    name: c.name, stage: stageLabel(c.stage), membership: c.membership?.name, trialAt: c.trialAt,
    answers: c.answers.filter((a) => a.answer), thread: thread.map((m) => ({ dir: m.dir, text: m.text, at: m.at, ...(m.channel ? { channel: CHANNEL_LABEL[m.channel] } : {}) })),
    earlierLeftOut: all.length - thread.length, facts,
  });
  const lastIn = incoming[incoming.length - 1];
  await applyMany((st) => {
    // Several messages in a row start several reads at once. One that finished
    // late but read fewer of their messages mustn't replace a fuller one.
    const kept = st.contacts.find((x) => x.id === contactId)?.insight;
    if (kept && kept.fromMessages > incoming.length) return;
    setInsight(st, contactId, { summary: read.summary, suggestedReply: read.suggestedReply || undefined, fromMessages: incoming.length });
    // Something to do beyond replying goes on Needs you, once per message.
    if (read.action) addTask(st, { id: `todo_${lastIn.id}`, contactId, text: read.action });
  });
  return { ok: true };
}
