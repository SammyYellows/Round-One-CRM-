"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
import { useStore } from "@/lib/store";
import { Accountability, Checkin, Contact } from "@/lib/types";

// The accountability programme (docs/accountability.md): who's on it and
// what they committed to, the invite link for a member, and the welcome
// email card. Step 1 of the build; pace and check-ins come next.

const STYLE: Record<Accountability["style"], string> = { straight: "Straight talk", encourage: "Encouragement", facts: "Just the facts" };
const FREQ: Record<Accountability["frequency"], string> = { slipping: "Only if slipping", pulse: "Mid-week pulse", daily: "Daily", weekly: "Weekly only" };
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const ago = (iso: string) => { const h = (Date.now() - Date.parse(iso)) / 36e5; return h < 1 ? "just now" : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

function Pace({ a }: { a: Accountability }) {
  const n = a.attendance?.thisWeek;
  if (n === undefined) return <span className="chip">No attendance yet</span>;
  const cls = n >= a.stretch ? "chip-red" : n >= a.floor ? "chip-light" : "";
  const label = n >= a.stretch ? "Stretch" : n >= a.floor ? "Floor done" : `${a.floor - n} to go`;
  return <span className={`chip ${cls}`} title={`${n} this week, ${a.attendance?.lastWeek ?? 0} last week`}>{n}/{a.floor} · {label}</span>;
}

const STATUS_LABEL: Record<NonNullable<Checkin["ai"]>["status"], string> = { on_track: "On track", slipping: "Slipping", struggling: "Struggling", wants_coach: "Wants a coach" };

/** One check-in waiting for staff: Claude's read, the editable reply, Send behind a confirm. */
function ReplyCard({ c, k, onDone }: { c: Contact; k: Checkin; onDone: () => void }) {
  const { act } = useStore();
  const [text, setText] = useState(k.ai?.reply ?? "");
  const [confirming, setConfirming] = useState(false);
  const a = c.accountability!;
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div><Link href={`/contacts/${c.id}`} className="strong" style={{ color: "var(--white)" }}>{c.name}</Link> <span className="small muted">· answered {ago(k.at)} · {a.attendance?.thisWeek ?? 0}/{a.floor} this week · {STYLE[a.style]}</span></div>
        {k.ai && <span className={`chip ${k.ai.status === "on_track" ? "chip-light" : k.ai.flagCoach || k.ai.status === "wants_coach" ? "chip-red" : ""}`}>{STATUS_LABEL[k.ai.status]}{k.ai.flagCoach ? " · see a coach" : ""}</span>}
      </div>
      <div className="small muted">They said: <strong>{k.feel}</strong>{k.blocker ? ` · “${k.blocker}”` : ""} · next week: <strong>{k.play}</strong></div>
      {k.ai?.note && <div className="small faint">Claude’s note for staff: {k.ai.note}{k.ai.adjust !== "keep" ? ` · suggests: ${k.ai.adjust === "lower" ? "lower the floor" : k.ai.adjust === "raise" ? "raise the target" : "a conversation"}` : ""}</div>}
      {!k.ai && <div className="small faint">No suggested reply (the AI key isn’t set, or it couldn’t read this one). Write one below if you like.</div>}
      <textarea className="input enq-text" rows={4} value={text} onChange={(e) => { setText(e.target.value); setConfirming(false); }} placeholder="Your reply, from bookings@" />
      {!confirming ? (
        <div className="actions" style={{ gap: 8 }}>
          <button className="btn btn-red btn-sm" disabled={!text.trim() || !c.email} onClick={() => setConfirming(true)}>Send reply</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { act("dismissCheckin", c.id, k.at); onDone(); }}>No reply needed</button>
          {!c.email && <span className="small faint">No email address on file.</span>}
        </div>
      ) : (
        <div className="enq-confirm">
          <div className="strong">Send this to {c.name} at {c.email}?</div>
          <div className="actions" style={{ gap: 8 }}>
            <button className="btn btn-red btn-sm" onClick={() => { act("replyToCheckin", c.id, k.at, text, "You"); setConfirming(false); onDone(); }}>Yes, send it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountabilityPage() {
  const { s, act, live } = useStore();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const refresh = async () => {
    setBusy(true);
    const r = await fetch("/api/accountability", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setNote(r.ok ? `Attendance refreshed for ${j.refreshed} member${j.refreshed === 1 ? "" : "s"}. Reload to see it.` : j.error ?? "Couldn’t refresh");
  };
  const [copied, setCopied] = useState("");
  const on = useMemo(() => s.contacts.filter((c) => c.accountability?.active).sort((a, b) => Date.parse(b.accountability!.joinedAt) - Date.parse(a.accountability!.joinedAt)), [s.contacts]);
  const left = useMemo(() => s.contacts.filter((c) => c.accountability && !c.accountability.active), [s.contacts]);
  const [, bump] = useState(0);
  const toReply = useMemo(() => on.flatMap((c) => (c.accountability!.checkins ?? []).filter((k) => !k.repliedAt && !k.dismissedAt).map((k) => ({ c, k }))).sort((x, y) => Date.parse(y.k.at) - Date.parse(x.k.at)), [on]);
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
        {live && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button className="btn btn-ghost" disabled={busy} onClick={refresh}>{busy ? "Refreshing" : "Refresh attendance from TeamUp"}</button>
            {note && <span className="small muted">{note}</span>}
          </div>
        )}
      </header>

      {toReply.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h2 className="h h2">Check-ins to reply to</h2><span className="small muted">{toReply.length} waiting · nothing goes until you press Send</span></div>
          {toReply.map(({ c, k }) => <ReplyCard key={`${c.id}-${k.at}`} c={c} k={k} onDone={() => bump((n) => n + 1)} />)}
        </section>
      )}

      <div className="grid cols-dash">
        <section className="card">
          <div className="card-head"><h2 className="h h2">On the programme</h2><span className="small muted">Newest first</span></div>
          {on.length === 0 && <div className="pad small muted" style={{ paddingTop: 0 }}>Nobody yet. Send a member their link from the box on the right; what they fill in lands here.</div>}
          {on.map((c) => {
            const a = c.accountability!;
            return (
              <div key={c.id} className="acc-row" style={{ borderTop: "1px solid var(--line)", padding: "12px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
                <div>
                  <Link href={`/contacts/${c.id}`} className="strong" style={{ color: "var(--white)" }}>{c.name}</Link>
                  <div className="small muted">{c.membership?.name ?? "No membership"}{c.membership && c.membership.status !== "active" ? " · not active: paused" : ""} · joined {day(a.joinedAt)}</div>
                </div>
                <div className="small"><span className="strong">{times(a.floor)}</span> a week, stretch {times(a.stretch)}<br /><span className="muted">{STYLE[a.style]} · {FREQ[a.frequency]}</span></div>
                <Pace a={a} />
                <div className="small muted">{a.slot}{a.lastCheckinAt ? <><br />check-in sent {ago(a.lastCheckinAt)}</> : null}{a.checkins?.[0] ? <><br />answered: {a.checkins[0].feel}{/coach/i.test(a.checkins[0].play) ? " · wants a coach" : ""}</> : null}</div>
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
            <div>Attendance is classes the front desk ticked them in to on TeamUp, plus Kisi door entries, one session per day at most. A booking nobody ticked is a no-show. Refreshed nightly and just before each check-in.</div>
            <div>Mid-week nudge: Thursday from 5pm for those who asked for a pulse or are under their floor, daily for those who asked for daily, never for “just the weekly check-in”. Silence signal: no sessions for two weeks and no check-in answered makes a task for the coaches.</div>
            <div>When a check-in comes in, Claude reads it against their commitment and drafts a reply in their tone. It appears above for you to edit and send. Nothing goes out by itself.</div>
          </section>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <EmailAutomationCard automationId="accountability_welcome" title="The welcome email" purpose="confirming a member's accountability commitment the moment they fill in the form" when="Goes from bookings@ as soon as the commitment form is submitted" startOpen={false} />
        <EmailAutomationCard automationId="accountability_nudge" title="The mid-week nudge" purpose="a short mid-week nudge to an accountability member, in their chosen tone, when their frequency preference or a gap against their floor warrants it" when="Goes from bookings@ on Thursday afternoon (daily for those who asked), only while their membership is active" startOpen={false} />
        <EmailAutomationCard automationId="accountability_checkin" title="The weekly check-in email" purpose="the member's weekly check-in at the time they chose: how the week went against their floor, in their chosen tone, with the link to the 30-second check-in form" when="Goes from bookings@ at their chosen slot each week, only while their membership is active" startOpen={false} />
        <div className="small faint" style={{ marginTop: -12 }}>Extra placeholders here: {"{paceLine}"} (their week against their floor, in their tone), {"{attended}"}, {"{floor}"}, {"{stretch}"}, {"{why}"}, {"{slot}"}, {"{checkinLink}"}.</div>
      </div>
    </>
  );
}
