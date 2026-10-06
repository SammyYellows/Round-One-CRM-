"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
import { ago, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";

// Everyone on the 28 Day Program (from TeamUp), where they are in it, and
// all the Program messages in one place: the welcome, the check-in, the
// move-to-recurring offer and the did-not-convert catch-up (Sammy, 06/10).

const PROGRAM = /program/i;
const MESSAGES: { id: string; title: string; purpose: string; when: string }[] = [
  { id: "sold_programme", title: "Welcome to the Program", purpose: "welcoming someone who has just bought the 28 Day Program", when: "Goes when someone is marked Sold – Programme, or starts a Program membership in TeamUp" },
  { id: "program_check_in", title: "Two-week check-in", purpose: "a check-in two weeks into the 28 Day Program, asking how it's going", when: "Goes two weeks after a Program membership starts in TeamUp" },
  { id: "program_ending", title: "A week to go: move to recurring", purpose: "a week before the 28 Day Program ends, offering a recurring membership so there's no gap", when: "Goes a week before a Program membership ends in TeamUp" },
];

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
    const done = s.runs.filter((r) => r.contactId === contactId && r.status === "done" && (MESSAGES.some((m) => m.id === r.automationId) || r.automationId === "did_not_convert"));
    return done.map((r) => s.automations.find((a) => a.id === r.automationId)?.name.replace(/^Program – |^Intro Programme – /, "") ?? r.automationId);
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
        The Program messages, in the order they go. Each is off until approved here; edit the wording, save drafts, or ask the AI to change it. These are service messages for people on the Program, so they go regardless of marketing opt-outs.
      </div>
      {MESSAGES.map((m, i) => <EmailAutomationCard key={m.id} automationId={m.id} title={m.title} purpose={m.purpose} when={m.when} startOpen={i === 0} />)}

      <section className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">From TeamUp, synced nightly</div>
            <h2 className="h h3">On the Program now</h2>
          </div>
        </div>
        <div className="crow thead">
          <div>Name</div><div>Membership</div><div>Started</div><div>Day</div><div>Ends</div><div>Messages sent</div>
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
              <div>{m.name}</div>
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
