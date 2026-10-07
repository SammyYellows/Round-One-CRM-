"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
import { ago, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { sourceLabel, viaOf } from "@/lib/types";

// Everyone on the 28 Day Program (from TeamUp), where they are in it, and
// all the Program messages in one place: the welcome, the check-in, the
// move-to-recurring offer and the did-not-convert catch-up (Sammy, 06/10).

const PROGRAM = /program/i;
// Two routes (Sammy, 07/10): people who came through the questionnaire get
// the pipeline welcome when staff mark the sale, then days 3–28 from TeamUp;
// people who signed up straight in TeamUp get their own schedule.
const CRM_MESSAGES: { id: string; day: number; title: string; purpose: string; when: string }[] = [
  { id: "program_day_3", day: 3, title: "Day 3: get your sessions in the diary", purpose: "day 3 of the 28 Day Program, getting them to book the week's sessions", when: "Goes on day 3 of a Program membership from TeamUp" },
  { id: "program_day_7", day: 7, title: "Day 7: one week done", purpose: "end of week one of the 28 Day Program, asking what was hardest", when: "Goes on day 7 of a Program membership from TeamUp" },
  { id: "program_day_10", day: 10, title: "Day 10: the dip", purpose: "day 10 of the 28 Day Program, when motivation dips", when: "Goes on day 10 of a Program membership from TeamUp" },
  { id: "program_check_in", day: 14, title: "Day 14: two-week check-in", purpose: "a check-in two weeks into the 28 Day Program, asking how it's going", when: "Goes on day 15 of a Program membership from TeamUp" },
  { id: "program_day_17", day: 17, title: "Day 17: the second half", purpose: "day 17 of the 28 Day Program, keeping momentum", when: "Goes on day 17 of a Program membership from TeamUp" },
  { id: "program_ending", day: 21, title: "Day 21: a week to go, move to recurring", purpose: "a week before the 28 Day Program ends, offering a recurring membership so there's no gap", when: "Goes a week before a Program membership ends in TeamUp" },
  { id: "program_day_24", day: 24, title: "Day 24: finish strong", purpose: "day 24 of the 28 Day Program, booking the last sessions and thinking about what's next", when: "Goes on day 24 of a Program membership from TeamUp" },
  { id: "program_day_28", day: 28, title: "Day 28: you did it", purpose: "the last day of the 28 Day Program, thanks and asking for feedback", when: "Goes on day 28 of a Program membership from TeamUp" },
];
const TEAMUP_MESSAGES: typeof CRM_MESSAGES = [
  { id: "program_day_1", day: 1, title: "Day 1: welcome", purpose: "welcoming someone who has just signed up to the 28 Day Program directly in TeamUp", when: "Goes when a Program membership starts in TeamUp for someone who didn't come through the CRM" },
];
const MESSAGES = [...CRM_MESSAGES, ...TEAMUP_MESSAGES];

export default function ProgramPage() {
  const { s, now } = useStore();
  const members = useMemo(
    () => s.contacts
      .filter((c) => c.membership && PROGRAM.test(c.membership.category) && c.membership.status !== "ended")
      .sort((a, b) => Date.parse(a.membership!.endsAt ?? "2999") - Date.parse(b.membership!.endsAt ?? "2999") || a.name.localeCompare(b.name)),
    [s.contacts],
  );
  const finished = s.contacts.filter((c) => c.membership && PROGRAM.test(c.membership.category) && c.membership.status === "ended").length;
  const sentTo = (contactId: string) => {
    const done = s.runs.filter((r) => r.contactId === contactId && r.status === "done" && (MESSAGES.some((m) => m.id === r.automationId) || r.automationId === "sold_programme" || r.automationId === "did_not_convert"));
    return done.map((r) => s.automations.find((a) => a.id === r.automationId)?.name.replace(/^Program – |^Intro Programme – /, "").replace(/:.*$/, "") ?? r.automationId);
  };
  const dayOf = (startedAt?: string) => (startedAt ? Math.max(1, Math.min(28, Math.floor((now - Date.parse(startedAt)) / 86400e3) + 1)) : null);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{members.length} on the Program now · {finished} finished</div>
          <h1 className="h h1">Program members</h1>
        </div>
        <Link className="btn btn-ghost" href="/members">All members</Link>
      </header>

      <div className="small muted" style={{ marginBottom: 14 }}>
        Two routes onto the Program. Each message is off until approved here; edit the wording, save drafts, or ask the AI to change it. Service messages, so they go regardless of marketing opt-outs. {MESSAGES.filter((m) => s.automations.find((a) => a.id === m.id)?.enabled).length} of {MESSAGES.length} on.
      </div>

      <h2 className="h h3" style={{ margin: "6px 0 10px" }}>Came through the CRM (Meta ad, form, referral)</h2>
      <div className="small muted" style={{ marginBottom: 12 }}>
        They bought the Program at the sale, so the pipeline’s welcome went when staff marked Sold – Programme. Once they’re in TeamUp (matched on email), two messages a week from day 3, timed from the membership start. Finish the Program and move to recurring, and the £79 is refunded against the membership.
      </div>
      {CRM_MESSAGES.map((m) => <EmailAutomationCard key={m.id} automationId={m.id} title={m.title} purpose={m.purpose} when={m.when} startOpen={false} />)}

      <h2 className="h h3" style={{ margin: "18px 0 10px" }}>Signed up directly in TeamUp (website, walk-in, word of mouth)</h2>
      <div className="small muted" style={{ marginBottom: 12 }}>
        No CRM journey first, so they get their own schedule. Day 1 is here; the rest comes from Sammy.
      </div>
      {TEAMUP_MESSAGES.map((m) => <EmailAutomationCard key={m.id} automationId={m.id} title={m.title} purpose={m.purpose} when={m.when} startOpen={false} />)}

      <section className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">From TeamUp, synced nightly</div>
            <h2 className="h h3">On the Program now</h2>
          </div>
        </div>
        <div className="crow thead">
          <div>Name</div><div>Came via</div><div>Started</div><div>Day</div><div>Ends</div><div>Messages sent</div>
        </div>
        {members.map((c) => {
          const m = c.membership!;
          const d = dayOf(m.startedAt);
          const sent = sentTo(c.id);
          return (
            <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{c.name}</div>
                <div className="faint num" style={{ fontSize: 12 }}>{c.email || c.phone || "no contact details"}</div>
              </div>
              <div><div>{viaOf(c) === "crm" ? sourceLabel(c.source) : "TeamUp direct"}</div><div className="muted small">{m.name}</div></div>
              <div className="muted small">{m.startedAt ? shortDate(m.startedAt) : "–"}</div>
              <div className="num">{d ? `${d} of 28` : "–"}</div>
              <div className="muted small">{m.endsAt ? `${shortDate(m.endsAt)} (${ago(m.endsAt, now)})` : "–"}</div>
              <div className="small">{sent.length ? sent.join(", ") : <span className="faint">None yet</span>}</div>
            </Link>
          );
        })}
        {members.length === 0 && <div className="empty">Nobody is on the Program right now.</div>}
      </section>
    </>
  );
}
