"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { waitingOnUs } from "@/lib/contactQuery";
import { ago, dayTime, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Contact, Membership } from "@/lib/types";
import { PRIORITY_LABEL, byPriority, inactivityAdvice } from "@/lib/inactivity";
import WhoIsIn from "@/components/WhoIsIn";
import { useIsManager } from "@/components/StaffContext";

// Everyone with a TeamUp membership, synced nightly. TeamUp stays the place
// to change memberships; this is for seeing who's on what and messaging them.

const STATUS_LABEL: Record<Membership["status"], string> = { active: "Active", on_hold: "On hold", ended: "Ended" };
type Ending = "all" | "7" | "30";
type CameIn = "all" | "30" | "90" | "180" | "365";
const TEAMUP_STATUS: Record<string, string> = { prospect: "Prospect", prospect_drop_off: "Dropped off", at_risk: "At risk", converted: "Converted", churned: "Churned", lost: "Lost" };

export default function MembersPage() {
  const { s, now, live } = useStore();
  const manager = useIsManager();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | Membership["status"] | "never">("active");
  const [ending, setEnding] = useState<Ending>("all");
  const [cameIn, setCameIn] = useState<CameIn>("all");
  const [optedOut, setOptedOut] = useState(false);
  const [lapsed, setLapsed] = useState(false); // lapsed members only, worst first
  const [noWaiver, setNoWaiver] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(20);

  const members = useMemo(() => s.contacts.filter((c): c is Contact & { membership: Membership } => !!c.membership), [s.contacts]);
  const categories = useMemo(() => [...new Set(members.map((m) => m.membership.category))].sort(), [members]);
  // People who made a TeamUp account but never had a membership: old enquiries, free-class sign-ups.
  const never = useMemo(() => s.contacts.filter((c) => c.teamup && !c.membership), [s.contacts]);
  const neverList = never
    .filter((c) => {
      if (cameIn !== "all" && now - Date.parse(c.createdAt) > Number(cameIn) * 86400e3) return false;
      if (optedOut && !c.marketingOptOut) return false;
      if (q.trim()) {
        const hay = `${c.name} ${c.email} ${c.phone} ${c.teamup?.status ?? ""}`.toLowerCase();
        if (!q.trim().toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const list = members
    .filter((c) => {
      const m = c.membership;
      if (category !== "all" && m.category !== category) return false;
      if (status !== "all" && m.status !== status) return false;
      if (ending !== "all" && !(m.endsAt && Date.parse(m.endsAt) - now < Number(ending) * 86400e3 && Date.parse(m.endsAt) >= now)) return false;
      if (optedOut && !c.marketingOptOut) return false;
      if (lapsed && !inactivityAdvice(c, now, inactiveDays)) return false;
      if (noWaiver && (!c.safety || c.safety.waiverSignedAt)) return false;
      if (q.trim()) {
        const hay = `${c.name} ${c.email} ${c.phone} ${m.name} ${m.category}`.toLowerCase();
        if (!q.trim().toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (lapsed) return byPriority(inactivityAdvice(a, now, inactiveDays)!, inactivityAdvice(b, now, inactiveDays)!);
      return (a.membership.endsAt ? Date.parse(a.membership.endsAt) : Infinity) - (b.membership.endsAt ? Date.parse(b.membership.endsAt) : Infinity) || a.name.localeCompare(b.name);
    });

  const byCategory = categories.map((k) => ({ k, n: members.filter((m) => m.membership.category === k && m.membership.status === "active").length }));
  const synced = members.length ? Math.max(...members.map((m) => Date.parse(m.membership.syncedAt))) : 0;
  const [sync, setSync] = useState<{ stages?: Record<string, { at: string; ms: number; ok: boolean; count?: number; error?: string }> } | null>(null);
  useEffect(() => { if (live) fetch("/api/teamup/sync", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setSync).catch(() => undefined); }, [live]);
  const stageLine = sync?.stages
    ? ["customers", "members", "payments", "apply", "attendance", "activity"].map((k) => { const st = sync.stages![k]; return st ? `${k} ${st.ok ? `${(st.ms / 1000).toFixed(0)}s` : "failed"}` : `${k} –`; }).join(" · ")
    : "";
  const slowest = sync?.stages ? Math.max(0, ...Object.values(sync.stages).map((s) => s.ms)) : 0;
  const [daysDraft, setDaysDraft] = useState("");
  const [daysNote, setDaysNote] = useState("");
  useEffect(() => { if (live) fetch("/api/members/inactivity", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setInactiveDays(j.days); setDaysDraft(String(j.days)); } }).catch(() => undefined); }, [live]);
  const saveDays = async () => {
    const r = await fetch("/api/members/inactivity", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: Number(daysDraft) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setInactiveDays(j.days); setDaysNote(`Saved. Coaches are told after ${j.days} days without a session, from tonight's sync.`); } else setDaysNote(j.error ?? "Couldn’t save");
  };
  const lapsedAdvice = members.map((c) => inactivityAdvice(c, now, inactiveDays)).filter((a): a is NonNullable<typeof a> => !!a);
  const inactiveCount = lapsedAdvice.length;
  const highCount = lapsedAdvice.filter((a) => a.priority === "high").length;
  const noWaiverCount = members.filter((c) => c.membership.status === "active" && c.safety && !c.safety.waiverSignedAt).length;
  const safetySynced = members.some((c) => c.safety);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">
            {members.filter((m) => m.membership.status === "active").length} active members
            {synced ? ` · synced from TeamUp ${ago(new Date(synced).toISOString(), now)}` : " · not synced from TeamUp yet"}
          </div>
          {live && (
            <div className="small muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>{inactiveCount} not in for {inactiveDays}+ days{highCount ? `, ${highCount} high priority` : ""}.</span>
              {manager && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Tell the coach after <input className="input" style={{ width: 70, height: 32 }} type="number" min={3} max={365} value={daysDraft} onChange={(e) => setDaysDraft(e.target.value)} /> days</label>}
              {manager && <button className="btn btn-ghost btn-sm" style={{ height: 32 }} disabled={!daysDraft || Number(daysDraft) === inactiveDays} onClick={saveDays}>Save</button>}
              {daysNote && <span className="faint">{daysNote}</span>}
            </div>
          )}
          {stageLine && (
            <div className="small faint" title="How long each stage of last night's sync took. The limit is 60 seconds per stage.">
              Sync stages: {stageLine}{slowest > 40000 ? " · getting close to the 60s limit" : ""}
            </div>
          )}
          <h1 className="h h1">Members</h1>
        </div>
      </header>

      {live && <WhoIsIn />}

      {byCategory.length > 0 && (
        <div className="actions" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className={`fchip fchip-sm ${category === "all" ? "on" : ""}`} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All categories</button>
          {byCategory.map(({ k, n }) => (
            <button key={k} className={`fchip fchip-sm ${category === k ? "on" : ""}`} aria-pressed={category === k} onClick={() => setCategory(k)}>{k} · {n}</button>
          ))}
        </div>
      )}

      <div className="filters" role="search">
        <div className="filters-row">
          <div className="search">
            <label htmlFor="mf-q" className="sr-only">Search members</label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input id="mf-q" className="input" type="search" placeholder="Search name, mobile, email or membership" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="ended">Ended</option>
            <option value="all">Any membership</option>
            <option value="never">Never joined · {never.length}</option>
          </select>
          {status === "never" ? (
            <select className="select" aria-label="Came in" value={cameIn} onChange={(e) => setCameIn(e.target.value as CameIn)}>
              <option value="all">Came in any time</option>
              <option value="30">Came in the last 30 days</option>
              <option value="90">Came in the last 3 months</option>
              <option value="180">Came in the last 6 months</option>
              <option value="365">Came in the last year</option>
            </select>
          ) : (
            <select className="select" aria-label="Ending" value={ending} onChange={(e) => setEnding(e.target.value as Ending)}>
              <option value="all">Any end date</option>
              <option value="7">Ends in the next 7 days</option>
              <option value="30">Ends in the next 30 days</option>
            </select>
          )}
          <button className={`fchip fchip-sm ${optedOut ? "on" : ""}`} aria-pressed={optedOut} onClick={() => setOptedOut((v) => !v)}>Opted out of marketing</button>
          {status !== "never" && <button className={`fchip fchip-sm ${lapsed ? "on" : ""}`} aria-pressed={lapsed} onClick={() => setLapsed((v) => !v)} title="Members past the inactivity threshold, highest priority first">Lapsed · {inactiveCount}</button>}
          {status !== "never" && safetySynced && <button className={`fchip fchip-sm ${noWaiver ? "on" : ""}`} aria-pressed={noWaiver} onClick={() => setNoWaiver((v) => !v)} title="Active members with no signed waiver in TeamUp">No waiver · {noWaiverCount}</button>}
          <span className="small muted" style={{ marginLeft: "auto" }} aria-live="polite">
            {status === "never" ? `${neverList.length} of ${never.length} who never joined` : `${list.length} of ${members.length} members`}
          </span>
        </div>
      </div>

      {status === "never" ? (
        <section className="card">
          <div className="crow thead" style={{ borderTop: 0 }}>
            <div>Name</div><div>Came in</div><div>TeamUp says</div><div /><div /><div>Marketing</div>
          </div>
          {neverList.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{c.name}</div>
                <div className="faint num" style={{ fontSize: 12 }}>{c.phone || c.email}</div>
              </div>
              <div className="muted small">{shortDate(c.createdAt)} · {ago(c.createdAt, now)}</div>
              <div className="muted">{TEAMUP_STATUS[c.teamup?.status ?? ""] ?? c.teamup?.status ?? "–"}</div>
              <div /><div />
              <div>{c.marketingOptOut ? <span className="chip" style={{ height: 20, fontSize: 10 }}>No marketing</span> : c.email ? "Email OK" : <span className="faint">No email</span>}</div>
            </Link>
          ))}
          {neverList.length === 0 && <div className="empty">{never.length === 0 ? "Nobody here yet. They appear after the next TeamUp sync." : "Nobody matches these filters."}</div>}
        </section>
      ) : (
      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          <div>Name</div><div>Membership</div><div>Category</div><div>Last in</div><div>Ends or renews</div><div>Status</div>
        </div>
        {list.map((c) => {
          const m = c.membership;
          const act_ = c.activity;
          const gapDays = act_?.lastSeenAt ? Math.floor((now - Date.parse(act_.lastSeenAt)) / 86400e3) : act_ ? 61 : undefined;
          const advice = inactivityAdvice(c, now, inactiveDays);
          return (
            <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{c.name}</div>
                <div className="faint num" style={{ fontSize: 12 }}>{c.phone || c.email}</div>
              </div>
              <div>{m.name}</div>
              <div className="muted">{m.category}</div>
              <div className="small" style={{ color: gapDays !== undefined && gapDays >= inactiveDays ? "var(--red)" : undefined }}>
                {act_ ? (act_.lastSeenAt ? `${ago(act_.lastSeenAt, now)}` : "Not in 60 days") : <span className="muted">{m.startedAt ? shortDate(m.startedAt) : "–"}</span>}
                {act_ && <div className="faint" style={{ fontSize: 11 }}>{act_.last30} in 30d{act_.alertedAt ? " · coach told" : ""}</div>}
                {advice && <div title={`${advice.reason}. ${advice.action}`}><span className={`chip ${advice.priority === "high" ? "chip-red" : advice.priority === "medium" ? "chip-light" : ""}`} style={{ height: 18, fontSize: 9, marginTop: 2 }}>{PRIORITY_LABEL[advice.priority]} priority</span></div>}
              </div>
              <div className="muted small">{m.endsAt ? `${shortDate(m.endsAt)} (${ago(m.endsAt, now)})` : "–"}</div>
              <div>
                {STATUS_LABEL[m.status]}{m.cancelling && m.status !== "ended" ? " · gave notice" : ""}
                {c.safety && !c.safety.waiverSignedAt && m.status === "active" && <span className="chip chip-red" style={{ height: 20, fontSize: 10, marginLeft: 6 }}>No waiver</span>}
                {c.marketingOptOut && <span className="chip" style={{ height: 20, fontSize: 10, marginLeft: 6 }}>No marketing</span>}
                {waitingOnUs(s, c) && <span className="chip chip-light" style={{ height: 20, fontSize: 10, marginLeft: 6 }}>Reply</span>}
              </div>
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="empty">
            {members.length === 0 ? "No members yet. They appear here after the first TeamUp sync." : "No members match these filters."}
          </div>
        )}
      </section>
      )}
    </>
  );
}
