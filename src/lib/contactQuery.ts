// Search, filter and sort for contacts. Shared by the Contacts list and the
// Pipeline so both behave the same way. On the backend this becomes a query.

import { Contact, STAGES, Source, Stage, State, sourceLabel } from "./types";

export interface ContactFilter {
  q: string;
  stages: Stage[]; // empty = all
  source: Source | "all";
  ad: string; // ad id, "all", or "none" for no ad
  added: "all" | "7" | "30" | "90" | "180" | "365"; // came in within this many days
  membership: "all" | "active" | "ended" | "never"; // TeamUp pipeline: members, ex-members, never joined
  waiting: boolean; // only people whose last WhatsApp is from them
}

export const EMPTY_FILTER: ContactFilter = { q: "", stages: [], source: "all", ad: "all", added: "all", membership: "all", waiting: false };

export type SortKey = "newest" | "oldest" | "name" | "activity" | "trial" | "stage" | "source" | "ad";

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "activity", label: "Recent activity" },
  { id: "trial", label: "Next trial" },
  { id: "name", label: "Name A–Z" },
];

export function lastActivity(s: State, c: Contact) {
  let t = Date.parse(c.createdAt);
  for (const e of s.events) if (e.contactId === c.id) t = Math.max(t, Date.parse(e.at));
  for (const m of s.messages) if (m.contactId === c.id) t = Math.max(t, Date.parse(m.at));
  return t;
}

export function waitingOnUs(s: State, c: Contact) {
  return s.messages.filter((m) => m.contactId === c.id).at(-1)?.dir === "in";
}

function haystack(s: State, c: Contact) {
  const campaign = s.campaigns.find((k) => k.utm === c.campaign)?.name;
  return [c.name, c.email, c.phone, c.phone.replace(/\D/g, ""), c.ad, c.adset, c.campaign, campaign, sourceLabel(c.source), ...c.tags,
    ...c.answers.map((a) => a.answer)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function applyFilter(s: State, contacts: Contact[], f: ContactFilter, now: number) {
  const tokens = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const since = f.added === "all" ? 0 : now - Number(f.added) * 86400e3;
  return contacts.filter((c) => {
    if (f.stages.length && !f.stages.includes(c.stage)) return false;
    if (f.source !== "all" && c.source !== f.source) return false;
    if (f.ad === "none" ? !!c.adId : f.ad !== "all" && c.adId !== f.ad) return false;
    if (since && Date.parse(c.createdAt) < since) return false;
    if (f.membership !== "all") {
      const m = c.membership;
      const state = m ? (m.status === "ended" ? "ended" : "active") : "never";
      if (state !== f.membership) return false;
    }
    if (f.waiting && !waitingOnUs(s, c)) return false;
    if (tokens.length) {
      const hay = haystack(s, c);
      // Phone numbers: match on digits so "07700 900101" finds "+44 7700 900101".
      if (!tokens.every((t) => hay.includes(t) || (/^\d{3,}$/.test(t.replace(/^0/, "")) && hay.includes(t.replace(/^0/, ""))))) return false;
    }
    return true;
  });
}

export function sortContacts(s: State, list: Contact[], key: SortKey, dir: 1 | -1 = 1) {
  const stageIdx = (st: Stage) => STAGES.findIndex((x) => x.id === st);
  const activity = new Map(list.map((c) => [c.id, lastActivity(s, c)]));
  const by: Record<SortKey, (a: Contact, b: Contact) => number> = {
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    oldest: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    activity: (a, b) => activity.get(b.id)! - activity.get(a.id)!,
    // Soonest trial first; people without one go last.
    trial: (a, b) => (a.trialAt ? Date.parse(a.trialAt) : Infinity) - (b.trialAt ? Date.parse(b.trialAt) : Infinity),
    stage: (a, b) => stageIdx(a.stage) - stageIdx(b.stage),
    source: (a, b) => sourceLabel(a.source).localeCompare(sourceLabel(b.source)),
    ad: (a, b) => (a.ad ?? "~").localeCompare(b.ad ?? "~"),
  };
  return [...list].sort((a, b) => {
    const r = by[key](a, b);
    return (Number.isNaN(r) ? 0 : r) * dir || a.name.localeCompare(b.name);
  });
}

export const allAds = (s: State) => s.campaigns.flatMap((k) => k.ads.map((a) => ({ id: a.id, name: a.name, campaign: k.name })));
