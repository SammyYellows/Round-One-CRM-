"use client";

import Link from "next/link";
import { useState } from "react";
import { time } from "@/lib/format";

// Who's in the gym now, with waiver and emergency contact (improvement item
// 20). Lives on Members. Reads TeamUp and Kisi live when asked, never on its
// own: in an emergency, press the button and the gaps are at the top.

type Via = { kind: "class"; event: string; at: string; status: "attended" | "registered" } | { kind: "door"; at: string };
interface Person { contactId?: string; name: string; phone?: string; via: Via[]; waiver?: string; emergency?: { name?: string; phone?: string; relationship?: string }; missing: ("waiver" | "emergency")[]; unknown?: string }
interface Result { people: Person[]; classes: { id: string; name: string; startsAt: string }[]; window: number; kisi: boolean; teamup: boolean }

export default function WhoIsIn() {
  const [hours, setHours] = useState(3);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (h = hours) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/safety/now?hours=${h}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn’t read TeamUp or Kisi");
      setRes(j);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const gaps = res?.people.filter((p) => p.missing.length) ?? [];
  return (
    <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="label" style={{ margin: 0 }}>In the gym now</div>
        <span className="small muted">Ticked into a class that’s on, or through the door in the last</span>
        <select className="select" style={{ height: 32, width: "auto" }} aria-label="Window" value={hours} onChange={(e) => { const h = Number(e.target.value); setHours(h); if (res) load(h); }}>
          {[1, 2, 3, 4, 6].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
        </select>
        <button className="btn btn-red btn-sm" style={{ height: 32 }} disabled={busy} onClick={() => load()}>{busy ? "Checking…" : res ? "Check again" : "Who’s in"}</button>
        {err && <span className="small" style={{ color: "var(--red)" }}>{err}</span>}
      </div>
      {res && (
        <>
          <div className="small muted">
            {res.people.length} {res.people.length === 1 ? "person" : "people"} · {gaps.length} without a waiver or emergency contact
            {res.classes.length ? ` · classes on: ${res.classes.map((c) => `${c.name} ${time(c.startsAt)}`).join(", ")}` : " · no class on right now"}
            {!res.kisi ? " · Kisi not connected, door entries not included" : ""}
          </div>
          <div className="small faint">Kisi logs people coming in, not leaving, so someone may have gone. Fix missing details in TeamUp; they show here after tonight’s sync.</div>
          <div>
            {res.people.map((p, i) => {
              const inner = (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{p.name}{p.unknown && <span className="faint small"> · not in the CRM</span>}</div>
                    <div className="faint small">{p.via.map((v) => v.kind === "class" ? `${v.event} ${time(v.at)}${v.status === "registered" ? " (booked, not ticked)" : ""}` : `Door ${time(v.at)}`).join(" · ")}{p.phone ? ` · ${p.phone}` : ""}</div>
                  </div>
                  <div className="small">{p.waiver ? <span className="muted">Waiver signed</span> : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>No waiver</span>}</div>
                  <div className="small">
                    {p.emergency?.phone || p.emergency?.name
                      ? <span>{p.emergency.name}{p.emergency.relationship ? ` (${p.emergency.relationship})` : ""}{p.emergency.phone ? <> · <span className="num">{p.emergency.phone}</span></> : ""}</span>
                      : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>No emergency contact</span>}
                  </div>
                </>
              );
              const style = { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.7fr) minmax(0, 1.4fr)", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)", color: "var(--white)", textDecoration: "none" } as const;
              return p.contactId ? <Link key={i} href={`/contacts/${p.contactId}`} style={style}>{inner}</Link> : <div key={i} style={style}>{inner}</div>;
            })}
            {res.people.length === 0 && <div className="empty">Nobody ticked in or through the door in the last {res.window} hour{res.window === 1 ? "" : "s"}.</div>}
          </div>
        </>
      )}
    </section>
  );
}
