"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
import { useStore } from "@/lib/store";
import { Accountability } from "@/lib/types";

// The accountability programme (docs/accountability.md): who's on it and
// what they committed to, the invite link for a member, and the welcome
// email card. Step 1 of the build; pace and check-ins come next.

const STYLE: Record<Accountability["style"], string> = { straight: "Straight talk", encourage: "Encouragement", facts: "Just the facts" };
const FREQ: Record<Accountability["frequency"], string> = { slipping: "Only if slipping", pulse: "Mid-week pulse", daily: "Daily", weekly: "Weekly only" };
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function AccountabilityPage() {
  const { s, act } = useStore();
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");
  const on = useMemo(() => s.contacts.filter((c) => c.accountability?.active).sort((a, b) => Date.parse(b.accountability!.joinedAt) - Date.parse(a.accountability!.joinedAt)), [s.contacts]);
  const left = useMemo(() => s.contacts.filter((c) => c.accountability && !c.accountability.active), [s.contacts]);
  const members = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return s.contacts.filter((c) => c.membership?.status === "active" && !c.accountability?.active && (c.name.toLowerCase().includes(t) || c.email.toLowerCase().includes(t))).slice(0, 8);
  }, [q, s.contacts]);
  const link = (id: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/f/accountability?c=${id}`;
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(link(id)); setCopied(id); setTimeout(() => setCopied(""), 2000); } catch { window.prompt("Copy this link", link(id)); }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{on.length} on the programme{left.length ? ` · ${left.length} left it` : ""}</div>
          <h1 className="h h1">Accountability</h1>
        </div>
      </header>

      <div className="grid cols-dash">
        <section className="card">
          <div className="card-head"><h2 className="h h2">On the programme</h2><span className="small muted">Newest first</span></div>
          {on.length === 0 && <div className="pad small muted" style={{ paddingTop: 0 }}>Nobody yet. Send a member their link from the box on the right; what they fill in lands here.</div>}
          {on.map((c) => {
            const a = c.accountability!;
            return (
              <div key={c.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
                <div>
                  <Link href={`/contacts/${c.id}`} className="strong" style={{ color: "var(--white)" }}>{c.name}</Link>
                  <div className="small muted">{c.membership?.name ?? "No membership"}{c.membership && c.membership.status !== "active" ? " · not active: paused" : ""} · joined {day(a.joinedAt)}</div>
                </div>
                <div className="small"><span className="strong">{times(a.floor)}</span> a week, stretch {times(a.stretch)}</div>
                <div className="small muted">{STYLE[a.style]} · {FREQ[a.frequency]}</div>
                <div className="small muted">{a.slot}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Take ${c.name} off the programme?`)) act("leaveAccountability", c.id, "staff"); }}>End</button>
                <div className="small muted" style={{ gridColumn: "1 / -1" }}>
                  {a.goals.length ? `For: ${a.goals.join(", ")}. ` : ""}{a.why ? `“${a.why}” ` : ""}{a.derailers.length ? `Watch for: ${a.derailers.join(", ")}.` : ""}{a.coachNotes ? ` Notes: ${a.coachNotes}` : ""}
                </div>
              </div>
            );
          })}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h h3">Invite a member</h2>
            <div className="small muted">Each member gets their own link to the commitment form, so we know who answered. Copy it and send it to them however you like.</div>
            <input className="input" placeholder="Search active members by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
            {members.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <div><div className="small strong">{c.name}</div><div className="small faint">{c.membership?.name}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => copy(c.id)}>{copied === c.id ? "Copied" : "Copy link"}</button>
              </div>
            ))}
            {q.trim().length >= 2 && members.length === 0 && <div className="small faint">No active member matches.</div>}
          </section>
          <section className="card pad small muted" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="label" style={{ margin: 0 }}>How it works</div>
            <div>Opt-in only. The member sets a floor (up to three sessions a week), a stretch, their why, how they want to be spoken to and when the weekly check-in lands.</div>
            <div>Every message checks their membership is still active at send time. Lapsed means silence.</div>
            <div>Coming next: this week’s attendance from TeamUp against their floor, the weekly check-in, and the mid-week nudge.</div>
          </section>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <EmailAutomationCard automationId="accountability_welcome" title="The welcome email" purpose="confirming a member's accountability commitment the moment they fill in the form" when="Goes from bookings@ as soon as the commitment form is submitted" />
      </div>
    </>
  );
}
