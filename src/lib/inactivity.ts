// Which lapsed members to contact first, and how (Sammy, 10/10/2026: "mark
// people as a priority and, based on their activity, suggest an action").
// The rules follow the research in docs/reference/sleeping-members.md:
// personal contact from someone they know helps; automated nudges and
// offers don't. Nothing here is ever sent to the member; it's advice for
// the coach or front desk. Pure, so it runs in the browser and the engine.

import type { Contact } from "./types";

export type Priority = "high" | "medium" | "low";

export interface InactivityAdvice {
  priority: Priority;
  reason: string; // why this priority, one line
  action: string; // what the coach or front desk should do
  gapDays: number;
}

const DAY = 86400e3;
const NEW_MEMBER_DAYS = 90;

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };

/**
 * Advice for a member past the inactivity threshold, or null if they're not
 * lapsed (not an active member, no activity synced yet, or seen recently).
 */
export function inactivityAdvice(c: Contact, now: number, thresholdDays: number): InactivityAdvice | null {
  const a = c.activity, m = c.membership;
  if (!a || !m || m.status !== "active") return null;
  const since = a.lastSeenAt ?? m.startedAt;
  if (!since) return null;
  const gapDays = Math.floor((now - Date.parse(since)) / DAY);
  if (gapDays < thresholdDays) return null;
  const memberDays = m.startedAt ? Math.floor((now - Date.parse(m.startedAt)) / DAY) : Infinity;
  const who = c.coachId ? "Their coach" : "Front desk";

  if (memberDays <= NEW_MEMBER_DAYS) {
    return {
      priority: "high", gapDays,
      reason: a.lastSeenAt ? `New member (${memberDays} days) who has dropped off` : `New member (${memberDays} days) who hasn’t been in yet`,
      action: `${who} to WhatsApp or call this week. Ask how they’re finding it and what’s got in the way; offer to book them into a class. Don’t mention the direct debit, the price or an offer.`,
    };
  }
  if (c.accountability?.active) {
    return {
      priority: "high", gapDays,
      reason: "On the accountability programme and gone quiet",
      action: `${who} to message them personally, in their chosen style, about the commitment they made (${c.accountability.floor} a week). Ask what’s changed; adjust the floor if needed.`,
    };
  }
  if (a.prev30 >= 6 && a.last30 <= 2) {
    return {
      priority: "high", gapDays,
      reason: `Was regular (${a.prev30} sessions a month) and has stopped`,
      action: `${who} to send a personal WhatsApp: ask if everything’s OK and mention what they were working on. A routine that breaks suddenly is usually life, not the gym; make coming back easy.`,
    };
  }
  if (!a.lastSeenAt) {
    return {
      priority: "medium", gapDays,
      reason: "Not seen in 60 days",
      action: `Check first that their email matches TeamUp and Kisi (a mismatch looks like absence). If it does, ${who.toLowerCase()} to send a short, friendly hello asking how they are. No “we’ve noticed you haven’t been in”.`,
    };
  }
  if (a.prev30 <= 3) {
    return {
      priority: "low", gapDays,
      reason: `Long-standing member who trains occasionally (${a.prev30} in the month before)`,
      action: "Leave the “not seen you” message. Say hello next time they’re in and ask what they’re training for. Their pattern may just be their pattern.",
    };
  }
  return {
    priority: "medium", gapDays,
    reason: "Lapsed after a steady stretch",
    action: `${who} to send one short personal message asking how they are. No offer, no mention of payment.`,
  };
}

const ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const byPriority = (a: InactivityAdvice, b: InactivityAdvice) => ORDER[a.priority] - ORDER[b.priority] || b.gapDays - a.gapDays;
