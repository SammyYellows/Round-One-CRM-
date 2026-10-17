// The WhatsApp, Facebook and Instagram tabs on Enquiries (Sammy, 12/10 and
// 14/10/2026): one row per person who has messaged on that channel, newest
// first. A conversation waits for a reply while their message is the last
// one in it, until staff answer or press "No reply needed". Pure, so the
// page, Today and the sidebar badge agree.

import { Channel, Contact, Message, State, channelOf } from "./types";

export interface Conversation {
  contact: Contact;
  channel: Channel;
  last: Message;
  lastIn: Message;
  waiting: boolean;
}

/** Someone mentioning us in their Instagram story isn't a message to answer (Sammy, 17/10/2026): never in Enquiries. */
export const STORY_MENTION = "[Mentioned us in their story]";
export const isStoryMention = (m: Pick<Message, "text">) => m.text.trim() === STORY_MENTION;

/** When staff last pressed "No reply needed" on this conversation. */
const doneAt = (c: Contact, channel: Channel) => (channel === "whatsapp" ? c.whatsappDone : c.channelDone?.[channel])?.at;

export function conversations(s: State, channel: Channel = "whatsapp"): Conversation[] {
  const byContact = new Map<string, { last: Message; lastIn?: Message }>();
  for (const m of s.messages) {
    if (channelOf(m) !== channel || isStoryMention(m)) continue;
    const e = byContact.get(m.contactId);
    if (!e) byContact.set(m.contactId, { last: m, lastIn: m.dir === "in" ? m : undefined });
    else {
      if (Date.parse(m.at) >= Date.parse(e.last.at)) e.last = m;
      if (m.dir === "in" && (!e.lastIn || Date.parse(m.at) >= Date.parse(e.lastIn.at))) e.lastIn = m;
    }
  }
  const out: Conversation[] = [];
  for (const c of s.contacts) {
    const e = byContact.get(c.id);
    if (!e?.lastIn) continue; // only people who have messaged us
    const done = doneAt(c, channel);
    const settled = done && Date.parse(done) >= Date.parse(e.lastIn.at);
    out.push({ contact: c, channel, last: e.last, lastIn: e.lastIn, waiting: e.last.dir === "in" && !settled });
  }
  return out.sort((a, b) => Date.parse(b.last.at) - Date.parse(a.last.at));
}

/** For badges: how many are waiting, and how many of those came in after `since`. */
export function messageCounts(s: State, since: string | null, channel: Channel = "whatsapp") {
  const waiting = conversations(s, channel).filter((c) => c.waiting);
  const after = since ? Date.parse(since) : NaN;
  return { waiting: waiting.length, fresh: Number.isNaN(after) ? waiting.length : waiting.filter((c) => Date.parse(c.lastIn.at) > after).length };
}

// "Last opened" per tab, in this browser only, as the sidebar badges already do.
export const SEEN_EMAIL = "round-one-crm:seen:/enquiries";
export const SEEN: Record<Channel, string> = {
  whatsapp: "round-one-crm:seen:/enquiries/whatsapp",
  facebook: "round-one-crm:seen:/enquiries/facebook",
  instagram: "round-one-crm:seen:/enquiries/instagram",
};
export const SEEN_EVENT = "crm-seen";
export function lastSeenAt(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function markSeen(key: string, at: number) {
  try { localStorage.setItem(key, new Date(at).toISOString()); } catch { /* private mode */ }
  window.dispatchEvent(new Event(SEEN_EVENT));
}
