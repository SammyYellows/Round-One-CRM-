// Replies that promise something become to-dos (Sammy, 12/10/2026): "when
// we send an email or WhatsApp, if there is an action for us, add it to the
// Needs you list". Server-only; runs after the reply has gone. Without
// ANTHROPIC_API_KEY nothing happens.

import { addTask } from "@/lib/engine";
import { aiConfigured, spotPromise } from "./ai";
import { applyMany, loadState } from "./state";

/**
 * After staff send an email or WhatsApp reply: if it promised something
 * ("I'll check and get back to you"), that goes on Needs you. `id` is based
 * on the sent message, so it's only added once.
 */
export async function noteFollowUp(contactId: string, text: string, channel: "email" | "WhatsApp", id: string) {
  if (!aiConfigured() || !text.trim()) return;
  const s = await loadState();
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || s.tasks.some((t) => t.id === id)) return;
  const action = await spotPromise({ name: c.name, channel, text });
  if (action) await applyMany((st) => addTask(st, { id, contactId, text: action }));
}
