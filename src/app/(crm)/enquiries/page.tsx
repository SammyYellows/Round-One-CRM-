"use client";

import { useIsManager } from "@/components/StaffContext";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";

// Emails to info@ with an AI-drafted reply for staff to check. Nothing here
// sends until Send is pressed and then confirmed (docs/email-enquiries.md).

interface Enquiry {
  id: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  subject: string;
  text: string;
  receivedAt: string;
  kind: "unknown" | "enquiry" | "other";
  summary: string | null;
  draft: string | null;
  status: "new" | "drafted" | "sent" | "dismissed";
  contactId: string | null;
  replyText: string | null;
  sentAt: string | null;
  sentBy: string | null;
  error: string | null;
}

type View = "open" | "sent" | "dismissed" | "other";
const needsReply = (e: Enquiry) => e.kind !== "other" && (e.status === "new" || e.status === "drafted");
const inView = (e: Enquiry, v: View) =>
  v === "open" ? needsReply(e) : v === "sent" ? e.status === "sent" : v === "dismissed" ? e.status === "dismissed" : e.kind === "other" && e.status !== "sent" && e.status !== "dismissed";

export default function EnquiriesPage() {
  const manager = useIsManager();
  const { now, live } = useStore();
  const [list, setList] = useState<Enquiry[] | null>(null);
  const [facts, setFacts] = useState("");
  const [setup, setSetup] = useState({ ai: false, receiving: false });
  const [view, setView] = useState<View>("open");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [factsDraft, setFactsDraft] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/enquiries", { cache: "no-store" });
    if (!res.ok) { setList([]); return; }
    const j = (await res.json()) as { enquiries: Enquiry[]; facts: string; ai: boolean; receiving: boolean };
    setList(j.enquiries);
    setFacts(j.facts);
    setFactsDraft(j.facts);
    setSetup({ ai: j.ai, receiving: j.receiving });
  }, []);

  useEffect(() => {
    if (!live) { setList([]); return; }
    load();
    const wanted = new URLSearchParams(window.location.search).get("id");
    if (wanted) setSelected(wanted);
  }, [live, load]);

  const current = useMemo(() => list?.find((e) => e.id === selected) ?? null, [list, selected]);
  useEffect(() => {
    setDraft(current?.status === "sent" ? current.replyText ?? "" : current?.draft ?? "");
    setSendTo(current?.replyTo ?? current?.fromEmail ?? "");
    setConfirming(false);
    setNote(null);
  }, [current]);
  useEffect(() => {
    // Keep the chosen view in step with the opened enquiry (e.g. from an email link).
    if (current && !inView(current, view)) setView(current.status === "sent" ? "sent" : current.status === "dismissed" ? "dismissed" : current.kind === "other" ? "other" : "open");
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (list ?? []).filter((e) => inView(e, view));
  const counts = { open: (list ?? []).filter((e) => inView(e, "open")).length, other: (list ?? []).filter((e) => inView(e, "other")).length };

  async function patch(id: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    await fetch(`/api/enquiries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
    setBusy(null);
  }

  async function rewrite() {
    if (!current || !instruction.trim()) return;
    setBusy("rewrite");
    const res = await fetch(`/api/enquiries/${current.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rewrite", draft, instruction }),
    });
    const j = (await res.json()) as { ok?: boolean; draft?: string; error?: string };
    setBusy(null);
    if (!res.ok || !j.ok || !j.draft) { setNote(j.error ?? "Couldn’t rewrite"); return; }
    setDraft(j.draft);
    setInstruction("");
    setNote("Rewritten. Read it through before sending.");
    await load();
  }

  const sendToChanged = !!current && current.status !== "sent" && sendTo.trim().toLowerCase() !== (current.replyTo ?? current.fromEmail);

  async function saveSendTo() {
    if (!current) return true;
    const res = await fetch(`/api/enquiries/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replyTo: sendTo }) });
    if (!res.ok) { setNote("That send-to address doesn’t look right"); return false; }
    return true;
  }

  async function send() {
    if (!current) return;
    setBusy("send");
    if (sendToChanged && !(await saveSendTo())) { setBusy(null); setConfirming(false); return; }
    const res = await fetch(`/api/enquiries/${current.id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft, confirm: true }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string; dryRun?: boolean };
    setConfirming(false);
    setBusy(null);
    if (!res.ok || !j.ok) { setNote(j.error ?? "Couldn’t send"); return; }
    setNote(j.dryRun ? "Recorded as sent (email isn’t switched on here)" : "Sent");
    await load();
  }

  async function saveFactsSheet() {
    setBusy("facts");
    await fetch("/api/enquiries/facts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts: factsDraft }) });
    setFacts(factsDraft);
    setBusy(null);
  }

  const draftChanged = !!current && current.status !== "sent" && draft !== (current.draft ?? "");

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{live ? `${counts.open} waiting for a reply` : "Live data only"}</div>
          <h1 className="h h1">Enquiries</h1>
        </div>
        <div className="actions">
          {manager && <button className="btn btn-ghost" onClick={() => setShowFacts((v) => !v)}>{showFacts ? "Hide gym facts" : "Gym facts"}</button>}
        </div>
      </header>

      {live && (!setup.receiving || !setup.ai) && (
        <div className="card" style={{ padding: "14px 22px", marginBottom: 20 }}>
          <div className="small muted">
            {!setup.receiving && "Email receiving isn’t connected yet, so nothing arrives here. "}
            {!setup.ai && "The AI isn’t set up yet, so new emails come in without a draft."}
          </div>
        </div>
      )}

      {manager && showFacts && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">What the AI may say</div>
              <h2 className="h h3">Gym facts</h2>
            </div>
            <button className="btn btn-red btn-sm" disabled={busy === "facts" || factsDraft === facts} onClick={saveFactsSheet}>{busy === "facts" ? "Saving" : "Save"}</button>
          </div>
          <div style={{ padding: "0 22px 22px" }}>
            <p className="small muted" style={{ margin: "0 0 10px" }}>Drafts only ever use what’s written here. Anything not covered, the draft says a colleague will confirm. Keep prices and hours current.</p>
            <textarea className="input enq-text" rows={14} value={factsDraft} onChange={(e) => setFactsDraft(e.target.value)} aria-label="Gym facts" />
          </div>
        </section>
      )}

      <div className="enq">
        <section className="card">
          <div className="actions" style={{ padding: "14px 16px", gap: 8, flexWrap: "wrap" }}>
            {([["open", `To reply · ${counts.open}`], ["sent", "Sent"], ["dismissed", "Dismissed"], ["other", `Other mail · ${counts.other}`]] as [View, string][]).map(([v, l]) => (
              <button key={v} className={`fchip fchip-sm ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
          {list === null ? (
            <div className="empty">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="empty">{view === "open" ? "Nothing waiting. New emails to info@ show up here with a draft." : "Nothing here."}</div>
          ) : (
            shown.map((e) => (
              <button key={e.id} className={`enq-row ${selected === e.id ? "on" : ""}`} onClick={() => setSelected(e.id)}>
                <div className="enq-row-top">
                  <span className="strong">{e.fromName || e.fromEmail}</span>
                  <span className="faint small">{ago(e.receivedAt, now)}</span>
                </div>
                <div className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject || "(no subject)"}</div>
                <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.summary || e.text.slice(0, 120)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {e.status === "drafted" && <span className="chip chip-light">Draft ready</span>}
                  {e.status === "new" && e.kind !== "other" && <span className="chip">No draft</span>}
                  {e.status === "sent" && <span className="chip chip-red">Sent</span>}
                  {e.error && <span className="chip">AI problem</span>}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="card enq-detail">
          {!current ? (
            <div className="empty">Pick an email on the left.</div>
          ) : (
            <>
              <div className="card-head" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow">
                    From {current.fromName ? `${current.fromName} · ` : ""}{current.fromEmail} · {new Date(current.receivedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <h2 className="h h3" style={{ marginTop: 6 }}>{current.subject || "(no subject)"}</h2>
                  {current.summary && <div className="small muted" style={{ marginTop: 6 }}>{current.summary}</div>}
                </div>
                {current.contactId && <Link href={`/contacts/${current.contactId}`} className="btn btn-ghost btn-sm">Contact</Link>}
              </div>

              <div className="enq-mail">{current.text || "(no text)"}</div>

              <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="label" htmlFor="enq-to">Send to</label>
                  <input
                    id="enq-to" className="input" type="email" value={sendTo} readOnly={current.status === "sent"}
                    onChange={(e) => { setSendTo(e.target.value); setConfirming(false); }}
                    onBlur={() => { if (sendToChanged) saveSendTo(); }}
                  />
                  {current.replyTo && current.replyTo !== current.fromEmail && (
                    <div className="small faint" style={{ marginTop: 4 }}>Came in from {current.fromEmail}, which can’t be replied to; the person’s own address was picked out of the message.</div>
                  )}
                </div>
                <label className="label" htmlFor="enq-draft">{current.status === "sent" ? `Reply sent ${current.sentAt ? ago(current.sentAt, now) : ""} by ${current.sentBy ?? "staff"}` : "Your reply"}</label>
                <textarea
                  id="enq-draft" className="input enq-text" rows={14} value={draft} readOnly={current.status === "sent"}
                  placeholder={current.kind === "other" ? "The AI read this as not an enquiry. Write a reply here if it needs one." : "No draft yet. Write the reply here, or press Draft again."}
                  onChange={(e) => { setDraft(e.target.value); setConfirming(false); }}
                />
                {current.status !== "sent" && setup.ai && (
                  <div>
                    <label className="label" htmlFor="enq-instruction">Ask the AI to change it</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="enq-instruction" className="input" style={{ minWidth: 0 }} value={instruction} placeholder="e.g. Shorter, and mention the Saturday 2pm class"
                        onChange={(e) => setInstruction(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && instruction.trim() && busy === null) rewrite(); }}
                      />
                      <button className="btn btn-ghost" style={{ padding: "0 14px" }} disabled={busy !== null || !instruction.trim()} onClick={rewrite}>{busy === "rewrite" ? "Rewriting" : "Rewrite"}</button>
                    </div>
                  </div>
                )}
                {current.error && <div className="small" style={{ color: "var(--red)" }}>AI problem: {current.error}</div>}
                {note && <div className="small muted" aria-live="polite">{note}</div>}

                {current.status !== "sent" && !confirming && (
                  <div className="actions" style={{ gap: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-red" disabled={!draft.trim() || !sendTo.trim() || busy !== null} onClick={() => setConfirming(true)}>Send reply</button>
                    {draftChanged && <button className="btn btn-ghost" disabled={busy !== null} onClick={() => patch(current.id, { draft }, "save")}>{busy === "save" ? "Saving" : "Save draft"}</button>}
                    <button className="btn btn-ghost" disabled={busy !== null || !setup.ai} onClick={() => patch(current.id, { action: "redraft" }, "redraft")}>{busy === "redraft" ? "Drafting" : "Draft again"}</button>
                    {current.status === "dismissed" ? (
                      <button className="btn btn-ghost" disabled={busy !== null} onClick={() => patch(current.id, { action: "reopen" }, "reopen")}>Reopen</button>
                    ) : (
                      <button className="btn btn-ghost" disabled={busy !== null} onClick={() => patch(current.id, { action: "dismiss" }, "dismiss")}>No reply needed</button>
                    )}
                  </div>
                )}

                {current.status !== "sent" && confirming && (
                  <div className="enq-confirm" role="alertdialog" aria-labelledby="enq-confirm-h">
                    <div id="enq-confirm-h" className="strong">Send this reply to {sendTo.trim() || current.fromEmail}?</div>
                    <div className="small muted">It goes from info@round1boxfit.co.uk, in the same email thread, exactly as written above.</div>
                    <div className="actions" style={{ gap: 10 }}>
                      <button className="btn btn-red" disabled={busy === "send"} onClick={send}>{busy === "send" ? "Sending" : "Yes, send it"}</button>
                      <button className="btn btn-ghost" disabled={busy === "send"} onClick={() => setConfirming(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
