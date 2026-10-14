"use client";

import { useEffect, useState } from "react";
import { BestSeller, TillSales, TillSummary, pounds } from "@/components/TillSales";
import { useStore } from "@/lib/store";

// The till (Sammy, 14/10/2026: "i want a cash out button, the cashing
// function is annoying on the epos system"). Management only. Reads Epos Now
// (never changes it): the cash that should be in the till since the last
// cash-out, a Cash out button (count, leave a float, confirm), the history
// and the takings.

type InTill = { since: string; float: number; cash: number; cashSales: number; expected: number; lastSaleAt: string | null } | null;
type CashOut = { id: string; at: string; by: string; counted: number; expected: number | null; floatLeft: number; cashSales: number | null; cashSalesCount: number | null; note: string | null };
type Data = {
  connected: boolean; error?: string;
  today?: TillSummary; week?: TillSummary; month?: TillSummary; lastMonth?: TillSummary;
  inTill?: InTill; bestSellers?: BestSeller[] | null; history?: CashOut[];
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const diffColour = (n: number) => (Math.abs(n) < 0.005 ? undefined : "var(--red)");
const signedPounds = (n: number) => (Math.abs(n) < 0.005 ? pounds(0) : `${n > 0 ? "+" : "−"}${pounds(Math.abs(n))}`);

export default function TillPage() {
  const { live } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [counted, setCounted] = useState("");
  const [float, setFloat] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/till", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as Data | null;
    setLoading(false);
    setD(j ?? { connected: true, error: "Couldn’t read the till. Try again." });
    if (j?.history?.[0] && float === "") setFloat(String(j.history[0].floatLeft));
  };
  useEffect(() => { if (live) load(); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live) return <div className="card pad">The till needs the live CRM.</div>;
  if (!d) return <div className="card pad muted">Reading the till…</div>;
  if (!d.connected) return <div className="card pad">Epos Now isn’t connected. Its API key and secret go in Vercel as EPOSNOW_API_KEY and EPOSNOW_API_SECRET.</div>;

  const inTill = d.inTill ?? null;
  const c = Number(counted), f = Number(float || 0);
  const valid = counted.trim() !== "" && Number.isFinite(c) && c >= 0 && Number.isFinite(f) && f >= 0 && f <= c;
  const diff = inTill && valid ? c - inTill.expected : null;

  const cashOut = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/till", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counted: c, floatLeft: f, note, confirm: true }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    setConfirming(false);
    if (!r?.ok) { setMsg(j?.error ?? "Couldn’t save the cash-out. Try again."); return; }
    setMsg(`Cashed out. Bank ${pounds(c - f)}${f ? `, ${pounds(f)} left in as float` : ""}.`);
    setCounted(""); setNote("");
    await load();
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">From Epos Now · read only{inTill?.lastSaleAt ? ` · last sale ${when(inTill.lastSaleAt)}` : ""}</div>
          <h1 className="h h1">Till</h1>
        </div>
        <button className="btn btn-ghost" disabled={loading} onClick={load}>{loading ? "Reading" : "Refresh"}</button>
      </header>
      {d.error && <div className="card pad" role="alert">{d.error}</div>}

      <div className="grid cols-dash" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Cash in the till now</div>
              <h2 className="h num" style={{ fontSize: 56, lineHeight: 1, marginTop: 6 }}>{inTill ? pounds(inTill.expected) : "–"}</h2>
            </div>
          </div>
          <div className="pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {inTill ? (
              <>
                <div className="small">{pounds(inTill.float)} float left at the last cash-out, {when(inTill.since)}{d.history?.[0] ? ` by ${d.history[0].by}` : ""}</div>
                <div className="small">+ {pounds(inTill.cash)} cash from {inTill.cashSales} sale{inTill.cashSales === 1 ? "" : "s"} since</div>
              </>
            ) : (
              <div className="small muted">No cash-out yet. Count what’s in the till and press Cash out: that’s the starting point. From then on the CRM adds up the cash taken since.</div>
            )}
          </div>

          <div className="pad" style={{ borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 className="h h3">Cash out</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 160px" }}><span className="label">Counted in the till (£)</span>
                <input className="input" inputMode="decimal" value={counted} onChange={(e) => { setCounted(e.target.value.replace(/[^\d.]/g, "")); setConfirming(false); }} placeholder="0.00" /></label>
              <label style={{ flex: "1 1 160px" }}><span className="label">Leave in as float (£)</span>
                <input className="input" inputMode="decimal" value={float} onChange={(e) => { setFloat(e.target.value.replace(/[^\d.]/g, "")); setConfirming(false); }} placeholder="0.00" /></label>
            </div>
            <label><span className="label">Note (optional)</span>
              <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. £20 taken out for cleaning supplies" /></label>
            {valid && (
              <div className="small" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>To bank: <strong className="num">{pounds(c - f)}</strong></span>
                {diff !== null && <span style={{ color: diffColour(diff) }}>Difference: <strong className="num">{signedPounds(diff)}</strong> {Math.abs(diff) < 0.005 ? "(spot on)" : diff > 0 ? "(over)" : "(short)"}</span>}
              </div>
            )}
            {!confirming ? (
              <div className="actions"><button className="btn btn-red" disabled={!valid || busy} onClick={() => setConfirming(true)}>Cash out</button></div>
            ) : (
              <div className="enq-confirm" role="alertdialog" aria-labelledby="till-confirm-h">
                <div id="till-confirm-h" className="strong">Cash out the till?</div>
                <div className="small">
                  Counted {pounds(c)}. Bank {pounds(c - f)}{f ? ` and leave ${pounds(f)} in as float` : ""}.
                  {diff !== null ? ` Difference ${signedPounds(diff)}.` : " This is the starting count."}
                </div>
                <div className="actions" style={{ gap: 10 }}>
                  <button className="btn btn-red" disabled={busy} onClick={cashOut}>{busy ? "Saving" : "Yes, cash out"}</button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
            {msg && <div className="small" role="status">{msg}</div>}
          </div>
        </section>

        {d.today && (
          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">Taken today</div>
            <div className="h num" style={{ fontSize: 44, lineHeight: 1 }}>{pounds(d.today.total)}</div>
            <div className="small muted">{d.today.sales} sale{d.today.sales === 1 ? "" : "s"}</div>
            {Object.entries(d.today.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} className="small" style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">{k}</span><span className="num">{pounds(v)}</span></div>
            ))}
          </section>
        )}
      </div>

      {d.week && d.month && d.lastMonth && d.today && (
        <TillSales periods={[{ label: "Today", s: d.today }, { label: "This week", s: d.week }, { label: "This month", s: d.month }, { label: "Last month", s: d.lastMonth }]} best={d.bestSellers} />
      )}

      <section className="card">
        <div className="card-head"><h2 className="h h3">Cashed out</h2><span className="small muted">{d.history?.length ? `Last ${d.history.length}` : "Nothing yet"}</span></div>
        {!!d.history?.length && (
          <div className="crow thead"><div>When</div><div>Expected</div><div>Counted</div><div>Difference</div><div>Banked</div><div>Float left</div></div>
        )}
        {(d.history ?? []).map((h) => {
          const dd = h.expected === null ? null : h.counted - h.expected;
          return (
            <div key={h.id} className="crow">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{when(h.at)}</div>
                <div className="faint small">{h.by}{h.note ? ` · ${h.note}` : ""}</div>
              </div>
              <div className="num">{h.expected === null ? <span className="faint">Starting count</span> : pounds(h.expected)}</div>
              <div className="num">{pounds(h.counted)}</div>
              <div className="num" style={{ color: dd === null ? undefined : diffColour(dd) }}>{dd === null ? "–" : signedPounds(dd)}</div>
              <div className="num">{pounds(h.counted - h.floatLeft)}</div>
              <div className="num">{pounds(h.floatLeft)}</div>
            </div>
          );
        })}
      </section>
    </>
  );
}
