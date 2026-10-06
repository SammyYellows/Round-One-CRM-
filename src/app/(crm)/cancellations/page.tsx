"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ago, dayTime, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";

// Everyone who has given notice to cancel in TeamUp, when, when their
// membership runs out, and what happened with the win-back email
// (Sammy, 06/10/2026). The sync records the notice; the "Gave notice –
// win-back" automation sends the email a day later when it's switched on.

const WIN_BACK = "win_back";
type Window = "30" | "90" | "365" | "all";
const day = shortDate;

export default function CancellationsPage() {
  const { s, now, act } = useStore();
  const [window, setWindow] = useState<Window>("all");

  const automation = s.automations.find((a) => a.id === WIN_BACK);
  const emailIndex = automation?.steps.findIndex((st) => st.kind === "email") ?? -1;
  const emailStep = emailIndex >= 0 ? automation!.steps[emailIndex] : undefined;
  const waitHours = automation?.steps.find((st) => st.kind === "wait")?.kind === "wait" ? (automation!.steps.find((st) => st.kind === "wait") as { hours: number }).hours : 24;

  // The email's wording, edited and approved here.
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (emailStep?.kind === "email") { setSubject(emailStep.subject); setBody(emailStep.body ?? ""); }
  }, [emailStep?.kind === "email" ? emailStep.subject : "", emailStep?.kind === "email" ? emailStep.body : ""]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = emailStep?.kind === "email" && (subject !== emailStep.subject || body !== (emailStep.body ?? ""));
  const saveWording = () => { act("setEmailStep", WIN_BACK, emailIndex, subject, body); setNote("Wording saved."); };
  const switchOn = () => { if (dirty) act("setEmailStep", WIN_BACK, emailIndex, subject, body); act("toggleAutomation", WIN_BACK); setConfirming(false); setNote("Switched on. From the next notice recorded, the email goes a day later."); };
  const switchOff = () => { act("toggleAutomation", WIN_BACK); setNote("Switched off. Nothing more will be sent."); };

  const rows = useMemo(() => {
    // The notice is logged on the contact's timeline when the sync first sees it.
    const noticeAt = new Map<string, string>();
    for (const e of s.events) {
      if (e.type === "stage.changed" && e.contactId && / gave notice on /.test(e.detail) && !noticeAt.has(e.contactId)) noticeAt.set(e.contactId, e.at);
    }
    const emailAt = new Map<string, string>();
    for (const e of s.events) {
      if (e.type === "email.sent" && e.contactId && e.detail.startsWith("Sorry to see you go") && !emailAt.has(e.contactId)) emailAt.set(e.contactId, e.at);
    }
    return s.contacts
      // Serving notice now, or a notice the sync recorded. Memberships that
      // were cancelled and had already ended before tracking began are history.
      .filter((c) => c.membership && (noticeAt.has(c.id) || (c.membership.cancelling && c.membership.status !== "ended")))
      .map((c) => {
        const m = c.membership!;
        const run = s.runs.filter((r) => r.contactId === c.id && r.automationId === WIN_BACK).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
        const sentAt = emailAt.get(c.id);
        let email: { label: string; tone: "sent" | "waiting" | "none" };
        if (sentAt) email = { label: `Sent ${day(sentAt)}`, tone: "sent" };
        else if (run?.status === "waiting" && run.resumeAt) email = { label: `Goes ${dayTime(run.resumeAt)}`, tone: "waiting" };
        else if (run?.status === "stopped") email = { label: "Stopped", tone: "none" };
        else if (c.marketingOptOut) email = { label: "Not sent: opted out", tone: "none" };
        else if (!c.email) email = { label: "Not sent: no email", tone: "none" };
        else if (!noticeAt.has(c.id)) email = { label: "Not sent: notice given before tracking began", tone: "none" };
        else email = { label: automation?.enabled ? "Not sent" : "Not sent: automation off", tone: "none" };
        return { c, m, noticeAt: noticeAt.get(c.id), email };
      })
      .filter((r) => window === "all" || (r.noticeAt ? now - Date.parse(r.noticeAt) <= Number(window) * 86400e3 : false))
      .sort((a, b) => (b.noticeAt ? Date.parse(b.noticeAt) : 0) - (a.noticeAt ? Date.parse(a.noticeAt) : 0) || a.c.name.localeCompare(b.c.name));
  }, [s, now, window, automation]);

  const sent = rows.filter((r) => r.email.tone === "sent").length;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{rows.length} gave notice · {sent} win-back email{sent === 1 ? "" : "s"} sent · automation {automation?.enabled ? "on" : "off"}</div>
          <h1 className="h h1">Cancellations</h1>
        </div>
        <Link className="btn btn-ghost" href="/automations">All automations</Link>
      </header>

      {automation && emailStep?.kind === "email" && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">{automation.enabled ? "On · goes the day after notice is recorded" : "Off · nothing is sent until you approve it"}</div>
              <h2 className="h h3">The win-back email</h2>
            </div>
            <span className={`chip ${automation.enabled ? "chip-red" : ""}`}>{automation.enabled ? "On" : "Off"}</span>
          </div>
          <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label" htmlFor="wb-subject">Subject</label>
              <input id="wb-subject" className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setConfirming(false); }} />
            </div>
            <div>
              <label className="label" htmlFor="wb-body">Message</label>
              <textarea id="wb-body" className="input enq-text" rows={12} value={body} onChange={(e) => { setBody(e.target.value); setConfirming(false); }} />
              <div className="small faint" style={{ marginTop: 6 }}>Goes from info@round1boxfit.co.uk {waitHours} hours after a notice is recorded. You can use {"{first} {name} {gym} {team}"}. An unsubscribe line is added at the bottom; anyone opted out is skipped. Replies come into Enquiries.</div>
            </div>
            {note && <div className="small muted" aria-live="polite">{note}</div>}
            {!confirming ? (
              <div className="actions" style={{ gap: 10, flexWrap: "wrap" }}>
                {automation.enabled ? (
                  <>
                    <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Save wording</button>
                    <button className="btn btn-ghost" onClick={switchOff}>Switch off</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-red" disabled={!subject.trim() || !body.trim()} onClick={() => setConfirming(true)}>Approve and switch on</button>
                    <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Save wording</button>
                  </>
                )}
              </div>
            ) : (
              <div className="enq-confirm" role="alertdialog" aria-labelledby="wb-confirm-h">
                <div id="wb-confirm-h" className="strong">Switch the win-back email on?</div>
                <div className="small muted">From the next notice the sync records, this email goes to that person {waitHours} hours later, with the wording above. Nobody already serving notice gets it. You can switch it off here any time.</div>
                <div className="actions" style={{ gap: 10 }}>
                  <button className="btn btn-red" onClick={switchOn}>Yes, switch it on</button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="filters" role="search">
        <div className="filters-row">
          <select className="select" style={{ maxWidth: 260 }} aria-label="Gave notice within" value={window} onChange={(e) => setWindow(e.target.value as Window)}>
            <option value="30">Gave notice in the last 30 days</option>
            <option value="90">Gave notice in the last 3 months</option>
            <option value="365">Gave notice in the last year</option>
            <option value="all">Any time (including notices given before tracking began)</option>
          </select>
          <span className="small muted" style={{ marginLeft: "auto" }}>
            {automation?.enabled ? "Emails go the day after notice is recorded." : "The win-back automation is switched off, so nothing is sent until it's turned on."}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          <div>Name</div><div>Membership</div><div>Gave notice</div><div>Membership ends</div><div>Win-back email</div><div>Marketing</div>
        </div>
        {rows.map(({ c, m, noticeAt, email }) => (
          <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{c.name}</div>
              <div className="faint num" style={{ fontSize: 12 }}>{c.email || c.phone || "no contact details"}</div>
            </div>
            <div><div>{m.name}</div><div className="muted small">{m.category}</div></div>
            <div className="muted small">{noticeAt ? `${day(noticeAt)} · ${ago(noticeAt, now)}` : "Before 6 Oct 2026"}</div>
            <div className="muted small">{m.status === "ended" ? `Ended${m.endsAt ? ` ${day(m.endsAt)}` : ""}` : m.endsAt ? `${day(m.endsAt)} (${ago(m.endsAt, now)})` : "–"}</div>
            <div>
              <span className={`chip ${email.tone === "sent" ? "chip-red" : email.tone === "waiting" ? "chip-light" : ""}`} style={{ height: 22, fontSize: 10, whiteSpace: "normal", textAlign: "left" }}>{email.label}</span>
            </div>
            <div className="small">{c.marketingOptOut ? "Opted out" : "OK"}</div>
          </Link>
        ))}
        {rows.length === 0 && <div className="empty">Nobody has given notice in this period. Notices given before tracking began (6 Oct 2026) show under “Any time”.</div>}
      </section>
    </>
  );
}
