"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

// Management reports: the weekly members numbers and the monthly growth
// report, the settings behind them, and sending to the managers' WhatsApp
// numbers (behind a confirm). The maths is server-side in growth.ts.

interface MonthPoint { month: string; label: string; joined: number; left: number; net: number; membersAtEnd: number }
interface Weekly { asOf: string; members: number; joined: number; left: number; net: number; pastDays: number; droppingOff: { customerId: string; name: string; membership: string; ends: string }[]; forecastDays: number; averageDays: number; forecastNet: number; forecastMembers: number }
interface Forecast { months: number; perMonth: number; net: number; members: number }
interface Unpaid { name: string; membership: string; retries: number; owed: number; since?: string; latest?: string; count: number; contactId: string; email: string; phone: string }
interface Reconciliation { activeMemberships: number; peopleActive: number; byDates: number; doubles: { customerId: string; name: string; memberships: string[] }[]; lapsedButActive: { customerId: string; name: string; membership: string; ended: string }[] }
interface ClassStat { name: string; weekday: number; hour: number; minute: number; sessions: number; attended: number; avg: number; capacity?: number; fill?: number }
interface MemberActivity { contactId: string; name: string; membership: string; last30: number; prev30: number; lastSeenAt?: string; change: number }
interface AttendanceReport { since?: string; classes: ClassStat[]; top: MemberActivity[]; bottom: MemberActivity[]; declining: MemberActivity[]; activeMembers: number }
interface Report { kind: "weekly" | "monthly" | "unpaid" | "attendance"; asOf: string; unpaid: Unpaid[]; reconciliation: Reconciliation; attendance: AttendanceReport; weekly: Weekly; months: MonthPoint[]; forecasts: Forecast[]; cancellations: { name: string; noticeAt: string; membership: string; reply?: string }[]; cancellationSummary: string }
interface Settings { pastDays: number; forecastDays: number; averageDays: number; monthlyMonths: number[]; forecastMonths: number[]; managerNumbers: string[]; weeklyOn: boolean; monthlyOn: boolean; unpaidOn: boolean; lastWeeklyAt?: string; lastMonthlyAt?: string; lastUnpaidAt?: string }
interface Payload { weekly: Report; monthly: Report; unpaid: Report; attendance: Report; settings: Settings; whatsapp: boolean; staffEmail: string | null }
const DAYNAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const slot = (c: ClassStat) => `${DAYNAME[c.weekday]} ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;

function MemberList({ title, note, rows }: { title: string; note: string; rows: MemberActivity[] }) {
  return (
    <section className="card">
      <div className="card-head"><h2 className="h h3">{title}</h2><span className="small muted">{note}</span></div>
      {rows.length === 0 && <div className="pad small muted" style={{ paddingTop: 0 }}>Nothing yet.</div>}
      {rows.map((m) => (
        <div key={m.contactId} style={{ borderTop: "1px solid var(--line)", padding: "8px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) 60px 60px minmax(0, 1fr)", gap: 10, alignItems: "center" }} className="small">
          <div><a href={`/contacts/${m.contactId}`} className="strong" style={{ color: "var(--white)" }}>{m.name}</a><div className="faint">{m.membership}</div></div>
          <div className="num"><span className="strong">{m.last30}</span></div>
          <div className="num muted">{m.prev30}</div>
          <div className="muted">{m.lastSeenAt ? `last in ${fmt(m.lastSeenAt)}` : "not in 60 days"}</div>
        </div>
      ))}
    </section>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function LineChart({ pts }: { pts: MonthPoint[] }) {
  const W = 640, H = 220, L = 44, R = 16, T = 18, B = 34;
  const vals = pts.map((p) => p.membersAtEnd);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(5, Math.round((hi - lo) * 0.2));
  const min = Math.max(0, lo - pad), max = hi + pad;
  const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / Math.max(1, max - min)) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Members at the end of each month: ${pts.map((p) => `${p.label} ${p.membersAtEnd}`).join(", ")}`}>
      {[0, 1, 2, 3, 4].map((g) => { const v = min + ((max - min) * g) / 4; return <g key={g}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid-line" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v)}</text></g>; })}
      <polyline points={pts.map((p, i) => `${x(i)},${y(p.membersAtEnd)}`).join(" ")} fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.month}>
          <rect x={x(i) - 4} y={y(p.membersAtEnd) - 4} width={8} height={8} fill="var(--red)" />
          <text x={x(i)} y={y(p.membersAtEnd) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--white)">{p.membersAtEnd}</text>
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function ReportsPage() {
  const { live } = useStore();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"weekly" | "monthly" | "unpaid" | "attendance">("weekly");
  const [s, setS] = useState<Settings | null>(null);
  const [numbers, setNumbers] = useState("");
  const [months, setMonths] = useState("");
  const [fmonths, setFmonths] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showRec, setShowRec] = useState(false);

  const load = () => fetch("/api/reports", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`); return r.json(); })
    .then((j: Payload) => { setData(j); setS(j.settings); setNumbers(j.settings.managerNumbers.join(", ")); setMonths(j.settings.monthlyMonths.join(", ")); setFmonths(j.settings.forecastMonths.join(", ")); })
    .catch((e) => setErr(e.message));
  useEffect(() => { if (live) load(); }, [live]);

  if (!live) return <div className="card pad">Reports need the live database; the prototype has no TeamUp data.</div>;
  if (err) return <div className="card pad">Couldn’t load the reports: {err}</div>;
  if (!data || !s) return <div className="card pad muted">Working out the numbers…</div>;

  const r = data[tab];
  const w = r.weekly;
  const save = async (patch: Partial<Settings>) => {
    setBusy("save");
    const res = await fetch("/api/reports", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setNote(j.error ?? "Couldn’t save"); return; }
    setNote("Settings saved. Numbers refresh with the new settings.");
    await load();
  };
  const post = async (action: "send" | "email" | "pdf") => {
    setBusy(action);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind: tab, confirm: action === "send" }) });
    const j = await res.json().catch(() => ({}));
    setBusy(null); setConfirming(false);
    if (!res.ok) { setNote(j.error ?? "Didn’t work"); return; }
    if (action === "pdf") { window.open(j.url, "_blank"); setNote("PDF opened in a new tab."); }
    if (action === "email") setNote(j.dryRun ? "No email key here: the PDF was only logged." : `Emailed to ${j.to}.`);
    if (action === "send") { const failed = (j.results ?? []).filter((x: { ok: boolean }) => !x.ok); setNote(failed.length ? `Sent, but ${failed.length} failed: ${failed.map((x: { to: string; error?: string }) => `${x.to} (${x.error})`).join("; ")}` : `Sent to ${(j.results ?? []).length} number${(j.results ?? []).length === 1 ? "" : "s"}.`); }
  };
  const owedTotal = r.unpaid.reduce((n, u) => n + u.owed, 0);
  const at = r.attendance;
  const tiles = tab === "attendance"
    ? [
      { label: "Active members", value: String(at.activeMembers), note: "with attendance read last night" },
      { label: "In during the last 30 days", value: String(at.top.length ? at.activeMembers - at.bottom.filter((m) => m.last30 === 0).length : 0), note: "at least one session" },
      { label: "Busiest class", value: at.classes[0] ? String(at.classes[0].avg) : "–", note: at.classes[0] ? `${at.classes[0].name}, ${slot(at.classes[0])}, average per session` : "" },
      { label: "Declining", value: String(at.declining.length), note: "fewer sessions than the 30 days before" },
    ]
    : tab === "unpaid"
    ? [
      { label: "Unpaid members", value: String(r.unpaid.length), note: "3 or more failed attempts in TeamUp" },
      { label: "Owed", value: `£${owedTotal.toFixed(0)}`, note: "open and retry-failed invoices" },
      { label: "Worst", value: r.unpaid[0] ? String(r.unpaid[0].retries) : "–", note: r.unpaid[0] ? `attempts: ${r.unpaid[0].name}` : "" },
      { label: "Schedule", value: s.unpaidOn ? "On" : "Off", note: "Mondays 08:00 to the managers" },
    ]
    : tab === "weekly"
    ? [
      { label: "Members now", value: String(w.members), note: "people with a membership running in TeamUp" },
      { label: `Growth, last ${w.pastDays} days`, value: signed(w.net), note: `${w.joined} joined, ${w.left} left` },
      { label: "Dropping off in 30 days", value: String(w.droppingOff.length), note: "notice given or membership ending, nothing after" },
      { label: `Forecast, next ${w.forecastDays} days`, value: signed(w.forecastNet), note: `about ${w.forecastMembers} members, from the average of the last ${w.averageDays} days` },
    ]
    : [
      { label: "Members now", value: String(w.members), note: "" },
      ...r.months.slice(-2, -1).map((m) => ({ label: `${m.label}: growth`, value: signed(m.net), note: `${m.joined} joined, ${m.left} left` })),
      ...r.forecasts.slice(0, 3).map((f) => ({ label: `Forecast, ${f.months} months`, value: signed(f.net), note: `about ${f.members} members, average ${signed(Math.round(f.perMonth * 10) / 10)} a month` })),
    ];
  const chartPts = tab === "weekly" ? r.months.slice(-4) : r.months;
  const sched = tab === "weekly" ? s.weeklyOn : tab === "monthly" ? s.monthlyOn : tab === "unpaid" ? s.unpaidOn : false;
  const lastAt = tab === "weekly" ? s.lastWeeklyAt : tab === "monthly" ? s.lastMonthlyAt : tab === "unpaid" ? s.lastUnpaidAt : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Members · from TeamUp, as of {fmt(r.asOf)}</div>
          <h1 className="h h1">Reports</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["weekly", "monthly", "unpaid", "attendance"] as const).map((k) => <button key={k} className={`fchip ${tab === k ? "on" : ""}`} aria-pressed={tab === k} onClick={() => { setTab(k); setConfirming(false); }}>{k === "weekly" ? "Weekly" : k === "monthly" ? "Monthly" : k === "unpaid" ? "Unpaid" : "Attendance"}</button>)}
        </div>
      </header>

      <div className={`grid ${tiles.length === 4 ? "stats4" : "stats5"}`}>
        {tiles.map((t) => (
          <div key={t.label} className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">{t.label}</div>
            <div className="h num" style={{ fontSize: 44, lineHeight: 1 }}>{t.value}</div>
            <div className="small muted">{t.note}</div>
          </div>
        ))}
      </div>

      {tab === "attendance" && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2 className="h h2">Classes, last 60 days</h2><span className="small muted">Average ticked in per session · most popular first{at.since ? ` · since ${fmt(at.since)}` : ""}</span></div>
            <div className="crow thead" style={{ borderTop: 0, gridTemplateColumns: "minmax(0, 2fr) 120px 90px 90px 90px minmax(0, 1fr)" }}><div>Class</div><div>Slot</div><div>Sessions</div><div>Average</div><div>Fill</div><div /></div>
            {at.classes.length === 0 && <div className="pad small muted" style={{ paddingTop: 0 }}>Nothing yet: the activity sync runs nightly at 03:12.</div>}
            {at.classes.map((c) => {
              const max = at.classes[0]?.avg || 1;
              return (
                <div key={`${c.name}|${c.weekday}|${c.hour}:${c.minute}`} className="crow" style={{ gridTemplateColumns: "minmax(0, 2fr) 120px 90px 90px 90px minmax(0, 1fr)" }}>
                  <div className="strong">{c.name}</div>
                  <div className="muted small">{slot(c)}</div>
                  <div className="num muted">{c.sessions}</div>
                  <div className="num strong">{c.avg}</div>
                  <div className="num muted">{c.fill !== undefined ? `${c.fill}%` : "–"}</div>
                  <div className="barlist-track" style={{ height: 10 }}><div className="barlist-fill" style={{ width: `${(c.avg / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </section>
          <div className="grid cols-dash3">
            <MemberList title="Top attendance" note="Sessions in the last 30 days · the 30 before" rows={at.top} />
            <MemberList title="Lowest attendance" note="Active members · fewest sessions first" rows={at.bottom} />
            <MemberList title="Fastest declining" note="Biggest drop against the 30 days before" rows={at.declining} />
          </div>
          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h h3">This report</h2>
            <div className="small muted">No schedule for this one yet. Open the PDF or email yourself a copy; sending to the managers works the same as the others.</div>
            <div className="actions" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => post("pdf")}>{busy === "pdf" ? "Making" : "Open the PDF"}</button>
              <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => post("email")}>{busy === "email" ? "Sending" : "Email me a copy"}</button>
              <button className="btn btn-red btn-sm" disabled={busy !== null || !s.managerNumbers.length} onClick={() => setConfirming(true)}>Send to the managers now</button>
            </div>
            {confirming && (
              <div className="enq-confirm" role="alertdialog">
                <div className="strong">Send the attendance report to {s.managerNumbers.length} number{s.managerNumbers.length === 1 ? "" : "s"} on WhatsApp?</div>
                <div className="actions" style={{ gap: 8 }}>
                  <button className="btn btn-red btn-sm" disabled={busy !== null} onClick={() => post("send")}>{busy === "send" ? "Sending" : "Yes, send it"}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
            {note && <div className="small muted" aria-live="polite">{note}</div>}
          </section>
        </div>
      )}

      {tab !== "attendance" && (
      <div className="grid cols-dash" style={{ marginTop: 16 }}>
        {tab === "unpaid" ? (
          <section className="card">
            <div className="card-head"><h2 className="h h2">Who hasn’t paid</h2><span className="small muted">Most recent missed payment first · from last night’s TeamUp sync</span></div>
            {r.unpaid.length === 0 && <div className="pad small muted" style={{ paddingTop: 0 }}>Nobody. Everyone is paid up.</div>}
            {r.unpaid.map((u) => (
              <div key={u.contactId} style={{ borderTop: "1px solid var(--line)", padding: "10px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 70px 90px", gap: 12, alignItems: "center" }}>
                <div><a href={`/contacts/${u.contactId}`} className="strong" style={{ color: "var(--white)" }}>{u.name}</a><div className="small faint">{[u.phone, u.email].filter(Boolean).join(" · ")}</div></div>
                <div className="small muted">{u.membership}</div>
                <div className="num">{u.count} <span className="small faint">missed</span></div>
                <div className="num">{u.owed ? `£${u.owed.toFixed(2)}` : "–"}<div className="small faint">{u.latest ? fmt(u.latest) : ""}</div></div>
              </div>
            ))}
          </section>
        ) : (
        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <h2 className="h h2">Members at month end</h2>
            <span className="small muted">{tab === "weekly" ? "Last 3 months and this month so far" : `Last ${Math.max(...s.monthlyMonths)} months and this month so far`}</span>
          </div>
          <LineChart pts={chartPts} />
          <table className="table" style={{ marginTop: 12, width: "100%" }}>
            <thead><tr><th>Month</th><th>Joined</th><th>Left</th><th>Growth</th><th>Members at end</th></tr></thead>
            <tbody>{chartPts.map((m) => <tr key={m.month}><td>{m.label}</td><td className="num">{m.joined}</td><td className="num">{m.left}</td><td className="num strong">{signed(m.net)}</td><td className="num">{m.membersAtEnd}</td></tr>)}</tbody>
          </table>
          {tab === "monthly" && (
            <div className="small muted" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {s.monthlyMonths.map((n) => { const slice = r.months.slice(-(n + 1), -1); return <span key={n}>Last {n} whole months: <strong>{signed(slice.reduce((a, m) => a + m.net, 0))}</strong> ({slice.reduce((a, m) => a + m.joined, 0)} joined, {slice.reduce((a, m) => a + m.left, 0)} left)</span>; })}
            </div>
          )}
        </section>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h h3">Send this report</h2>
            <div className="small muted">
              {s.managerNumbers.length ? `Goes to ${s.managerNumbers.join(", ")} on WhatsApp as a PDF.` : "No manager numbers yet: add them in Settings below."}
              {!data.whatsapp && " WhatsApp isn’t connected on this server, so a send is only logged."}
              {" "}Schedule: <strong>{sched ? "on" : "off"}</strong>{lastAt ? `, last sent ${fmt(lastAt)}` : ""}. {tab === "monthly" ? "The 1st of the month at 08:00." : "Mondays at 08:00."}
            </div>
            {!confirming ? (
              <div className="actions" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => post("pdf")}>{busy === "pdf" ? "Making" : "Open the PDF"}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => post("email")}>{busy === "email" ? "Sending" : `Email me a copy`}</button>
                <button className="btn btn-red btn-sm" disabled={busy !== null || !s.managerNumbers.length} onClick={() => setConfirming(true)}>Send to the managers now</button>
              </div>
            ) : (
              <div className="enq-confirm" role="alertdialog">
                <div className="strong">Send the {tab} report to {s.managerNumbers.length} number{s.managerNumbers.length === 1 ? "" : "s"} on WhatsApp?</div>
                <div className="small muted">{s.managerNumbers.join(", ")}. They get the PDF with a short message. Needs Meta to have approved the management_report template.</div>
                <div className="actions" style={{ gap: 8 }}>
                  <button className="btn btn-red btn-sm" disabled={busy !== null} onClick={() => post("send")}>{busy === "send" ? "Sending" : "Yes, send it"}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div className="actions" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => save(tab === "weekly" ? { weeklyOn: !s.weeklyOn } : tab === "monthly" ? { monthlyOn: !s.monthlyOn } : { unpaidOn: !s.unpaidOn })}>
                {sched ? "Switch the schedule off" : "Switch the schedule on"}
              </button>
            </div>
            {note && <div className="small muted" aria-live="polite">{note}</div>}
          </section>

          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h h3">Settings</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label><span className="label">Past growth over (days)</span><input className="input" type="number" min={7} max={365} value={s.pastDays} onChange={(e) => setS({ ...s, pastDays: Number(e.target.value) })} /></label>
              <label><span className="label">Forecast ahead (days)</span><input className="input" type="number" min={7} max={365} value={s.forecastDays} onChange={(e) => setS({ ...s, forecastDays: Number(e.target.value) })} /></label>
              <label><span className="label">Average taken over (days)</span><input className="input" type="number" min={7} max={365} value={s.averageDays} onChange={(e) => setS({ ...s, averageDays: Number(e.target.value) })} /></label>
              <label><span className="label">Monthly lookbacks (months)</span><input className="input" value={months} placeholder="2, 3, 6" onChange={(e) => setMonths(e.target.value)} /></label>
              <label><span className="label">Monthly forecasts (months)</span><input className="input" value={fmonths} placeholder="2, 3" onChange={(e) => setFmonths(e.target.value)} /></label>
              <label><span className="label">Managers’ WhatsApp numbers</span><input className="input" value={numbers} placeholder="07… , 07…" onChange={(e) => setNumbers(e.target.value)} /></label>
            </div>
            <div className="small faint">The forecast is the average daily change over the “average” window, carried forward. Numbers are UK mobiles, comma-separated; they only get messages until the real WhatsApp number moves over if they’re on Meta’s test list.</div>
            <div className="actions" style={{ gap: 8 }}>
              <button className="btn btn-red btn-sm" disabled={busy !== null} onClick={() => save({ pastDays: s.pastDays, forecastDays: s.forecastDays, averageDays: s.averageDays, monthlyMonths: months.split(/[,\s]+/).map(Number).filter(Boolean), forecastMonths: fmonths.split(/[,\s]+/).map(Number).filter(Boolean), managerNumbers: numbers.split(/[,\s]+/).filter(Boolean) })}>{busy === "save" ? "Saving" : "Save settings"}</button>
            </div>
          </section>
        </div>
      </div>

      )}

      {tab !== "unpaid" && tab !== "attendance" && (
      <div className="grid cols-dash" style={{ marginTop: 16 }}>
        <section className="card pad">
          <h2 className="h h2" style={{ marginBottom: 8 }}>Cancellations and what people said</h2>
          <p className="muted" style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{r.cancellationSummary}</p>
          {r.cancellations.map((c) => (
            <div key={`${c.name}-${c.noticeAt}`} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
              <div className="strong">{c.name} <span className="muted" style={{ fontWeight: 400 }}>· {c.membership} · notice {fmt(c.noticeAt)}</span></div>
              <div className="small muted" style={{ marginTop: 4 }}>{c.reply ? `“${c.reply.slice(0, 400)}”` : "No reply to the win-back email."}</div>
            </div>
          ))}
        </section>
        <section className="card pad">
          <h2 className="h h2" style={{ marginBottom: 8 }}>Dropping off in 30 days</h2>
          {w.droppingOff.length === 0 && <div className="small muted">Nobody.</div>}
          {w.droppingOff.map((d) => <div key={d.customerId} className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span>{d.name} <span className="faint">· {d.membership}</span></span><span className="muted" style={{ whiteSpace: "nowrap" }}>ends {fmt(d.ends)}</span></div>)}
        </section>
      </div>
      )}

      {/* Why TeamUp's number and ours differ: useful, kept quiet at the foot (Sammy, 09/10). */}
      {(() => { const rc = data.weekly.reconciliation; return (
        <section className="card pad" style={{ marginTop: 16, opacity: 0.85 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div className="small muted">
              <span className="label" style={{ display: "inline", marginRight: 10 }}>Why the numbers differ from TeamUp</span>
              TeamUp counts <strong>{rc.activeMemberships}</strong> active memberships. That is <strong>{rc.peopleActive}</strong> people, because {rc.doubles.length} hold more than one. Counted by start and expiry dates, as the report does, it is <strong>{rc.byDates}</strong>{rc.lapsedButActive.length ? `: ${rc.lapsedButActive.length} whose expiry date has passed while TeamUp still says active` : ""}.
            </div>
            <button type="button" className="link-btn faint" onClick={() => setShowRec((v) => !v)}>{showRec ? "Hide the names" : "Show the names"}</button>
          </div>
          {showRec && (
            <div className="grid cols-dash" style={{ marginTop: 12 }}>
              <div>
                <div className="label">Holding more than one active membership</div>
                {rc.doubles.length === 0 && <div className="small faint">Nobody.</div>}
                {rc.doubles.map((d) => <div key={d.customerId} className="small" style={{ padding: "4px 0", borderTop: "1px solid var(--line)" }}>{d.name} <span className="faint">· {d.memberships.join(" + ")}</span></div>)}
                <div className="small faint" style={{ marginTop: 6 }}>Usually an upgrade or a discount switch where the old one was never closed. Worth checking in TeamUp: some may be charged twice.</div>
              </div>
              <div>
                <div className="label">Active in TeamUp, expiry date passed</div>
                {rc.lapsedButActive.length === 0 && <div className="small faint">Nobody.</div>}
                {rc.lapsedButActive.map((d) => <div key={d.customerId} className="small" style={{ padding: "4px 0", borderTop: "1px solid var(--line)" }}>{d.name} <span className="faint">· {d.membership} · {d.ended ? fmt(d.ended) : ""}</span></div>)}
                <div className="small faint" style={{ marginTop: 6 }}>Usually waiting on a renewal. The report counts them out until it renews.</div>
              </div>
            </div>
          )}
        </section>
      ); })()}
    </>
  );
}
