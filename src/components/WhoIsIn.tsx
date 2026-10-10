"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { time } from "@/lib/format";
import { useStore } from "@/lib/store";

// Who's in the gym without a waiver or emergency contact (improvement item
// 20). Sammy, 10/10/2026: the job is to tell whoever has the CRM open, so
// they can go and talk to the person, then tick "Spoke to them" and the
// alert clears for the day. At most 1.5 hours back, because Kisi logs people
// coming in, not leaving. Nothing is ever sent to the member.

type Via = { kind: "class"; event: string; at: string; status: "attended" | "registered" } | { kind: "door"; at: string };
interface Person { key: string; contactId?: string; name: string; phone?: string; via: Via[]; waiver?: string; emergency?: { name?: string; phone?: string; relationship?: string }; missing: ("waiver" | "emergency")[]; checkedAt?: string; unknown?: boolean }
interface Result { people: Person[]; classes: { id: string; name: string; startsAt: string }[]; window: number; kisi: boolean; teamup: boolean; at: string }

const POLL_MS = 3 * 60e3;
const SHOWN = 3; // names in the alert itself; the rest are on /safety
export const WINDOWS = [0.5, 1, 1.5];
const windowLabel = (h: number) => (h < 1 ? `${h * 60} minutes` : h === 1 ? "1 hour" : `${h} hours`);

function useWhoIsIn(hours: number, enabled: boolean) {
  const { act } = useStore();
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/safety/now?hours=${hours}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn’t read TeamUp or Kisi");
      setRes(j); setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }, [hours]);
  useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);
  const tick = async (p: Person) => {
    setRes((r) => (r ? { ...r, people: r.people.map((x) => (x.key === p.key ? { ...x, checkedAt: new Date().toISOString() } : x)) } : r));
    if (p.contactId) act("markSafetyChecked", p.contactId);
    else await fetch("/api/safety/now", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: p.key }) });
  };
  return { res, busy, err, load, tick };
}

const missingText = (p: Person) => [p.missing.includes("waiver") && "no waiver", p.missing.includes("emergency") && "no emergency contact"].filter(Boolean).join(" and ");
const viaText = (p: Person) => p.via.map((v) => (v.kind === "class" ? `${v.event} ${time(v.at)}${v.status === "registered" ? " (booked, not ticked in)" : ""}` : `door ${time(v.at)}`)).join(" · ");

function Row({ p, onTick, compact }: { p: Person; onTick: (p: Person) => void; compact?: boolean }) {
  const name = p.contactId ? <Link href={`/contacts/${p.contactId}`} className="strong">{p.name}</Link> : <span className="strong">{p.name}</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr) auto" : "minmax(0, 1.4fr) minmax(0, 1.4fr) auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ minWidth: 0 }}>
        <div>{name}{p.unknown && <span className="faint small"> · not matched to a CRM contact</span>}</div>
        <div className="faint small">Came in: {viaText(p)}{p.phone ? ` · ${p.phone}` : ""}</div>
        {compact && p.missing.length > 0 && <div className="small" style={{ color: "var(--red)" }}>{missingText(p)}</div>}
      </div>
      {!compact && (
        <div className="small">
          {p.waiver ? <span className="muted">Waiver signed</span> : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>No waiver</span>}{" "}
          {p.emergency?.phone || p.emergency?.name
            ? <span>{p.emergency.name}{p.emergency.relationship ? ` (${p.emergency.relationship})` : ""}{p.emergency.phone ? <> · <a className="num" href={`tel:${p.emergency.phone}`}>{p.emergency.phone}</a></> : ""}</span>
            : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>No emergency contact</span>}
        </div>
      )}
      <div>
        {p.missing.length === 0 ? null : p.checkedAt
          ? <span className="small muted">Spoken to ✓</span>
          : <button className="btn btn-ghost btn-sm" style={{ height: 32 }} onClick={() => onTick(p)}>Spoke to them ✓</button>}
      </div>
    </div>
  );
}

/** The alert at the top of every staff screen. Shows only when someone's in without a waiver or emergency contact and nobody has ticked them off today. */
export function SafetyAlert() {
  const { live } = useStore();
  const path = usePathname();
  const onMembers = path?.startsWith("/members") || path?.startsWith("/safety"); // both show the full list
  const { res, tick } = useWhoIsIn(1.5, live && !onMembers);
  const open = (res?.people ?? []).filter((p) => p.missing.length && !p.checkedAt);
  if (!live || onMembers || open.length === 0) return null;
  return (
    <section className="card answers-strip" role="alert" style={{ padding: "12px 16px", marginBottom: 16 }}>
      <div className="label" style={{ margin: 0, color: "var(--red)" }}>
        {open.length === 1 ? "1 person" : `${open.length} people`} in the gym without a waiver or emergency contact
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="small faint">Have a word, get it sorted in TeamUp, then tick them off. Came in within the last 1.5 hours.</span>
        <Link href="/safety" className="btn btn-red btn-sm" style={{ height: 32, marginLeft: "auto" }}>List everyone</Link>
      </div>
      {open.slice(0, SHOWN).map((p) => <Row key={p.key} p={p} onTick={tick} compact />)}
      {open.length > SHOWN && <div className="small muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>And {open.length - SHOWN} more. <Link href="/safety">List everyone</Link></div>}
    </section>
  );
}

/** The full list on Members: everyone in now, gaps first. */
export default function WhoIsIn() {
  const [hours, setHours] = useState(1.5);
  const { res, busy, err, load, tick } = useWhoIsIn(hours, true);
  const open = res?.people.filter((p) => p.missing.length && !p.checkedAt) ?? [];
  return (
    <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="label" style={{ margin: 0 }}>In the gym now</div>
        <span className="small muted">Ticked into a class that’s on, or through the door in the last</span>
        <select className="select" style={{ height: 32, width: "auto" }} aria-label="Window" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {WINDOWS.map((h) => <option key={h} value={h}>{windowLabel(h)}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" style={{ height: 32 }} disabled={busy} onClick={() => load()}>{busy ? "Checking…" : "Check again"}</button>
        {err && <span className="small" style={{ color: "var(--red)" }}>{err}</span>}
      </div>
      {res && (
        <>
          <div className="small muted">
            {res.people.length} {res.people.length === 1 ? "person" : "people"} in · <span style={{ color: open.length ? "var(--red)" : undefined }}>{open.length} still to speak to</span>
            {res.classes.length ? ` · classes on: ${res.classes.map((c) => `${c.name} ${time(c.startsAt)}`).join(", ")}` : " · no class on right now"}
            {!res.kisi ? " · Kisi not connected, door entries not included" : ""} · checked {time(res.at)}
          </div>
          <div>
            {res.people.map((p) => <Row key={p.key} p={p} onTick={tick} />)}
            {res.people.length === 0 && <div className="empty">Nobody ticked in or through the door in the last {windowLabel(res.window)}.</div>}
          </div>
        </>
      )}
    </section>
  );
}
