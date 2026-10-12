// The WhatsApp tab on Enquiries (Sammy, 12/10/2026): one row per person who
// has messaged, newest first. A conversation waits for a reply while their
// message is the last one in the thread, until staff answer it or press
// "No reply needed". Pure, so the page and the sidebar badge agree.

import { Contact, Message, State } from "./types";

export interface Conversation {
  contact: Contact;
  last: Message;
  lastIn: Message;
  waiting: boolean;
}

export function conversations(s: State): Conversation[] {
  const byContact = new Map<string, { last: Message; lastIn?: Message }>();
  for (const m of s.messages) {
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
    const done = c.whatsappDone && Date.parse(c.whatsappDone.at) >= Date.parse(e.lastIn.at);
    out.push({ contact: c, last: e.last, lastIn: e.lastIn, waiting: e.last.dir === "in" && !done });
  }
  return out.sort((a, b) => Date.parse(b.last.at) - Date.parse(a.last.at));
}

/** For badges: how many are waiting, and how many of those came in after `since`. */
export function whatsappCounts(s: State, since: string | null) {
  const waiting = conversations(s).filter((c) => c.waiting);
  const after = since ? Date.parse(since) : NaN;
  return { waiting: waiting.length, fresh: Number.isNaN(after) ? waiting.length : waiting.filter((c) => Date.parse(c.lastIn.at) > after).length };
}

// "Last opened" per tab, in this browser only, as the sidebar badges already do.
export const SEEN_EMAIL = "round-one-crm:seen:/enquiries";
export const SEEN_WHATSAPP = "round-one-crm:seen:/enquiries/whatsapp";
export const SEEN_EVENT = "crm-seen";
export function lastSeenAt(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function markSeen(key: string, at: number) {
  try { localStorage.setItem(key, new Date(at).toISOString()); } catch { /* private mode */ }
  window.dispatchEvent(new Event(SEEN_EVENT));
}
