"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";

// Everyone who has given notice to cancel in TeamUp, when, when their
// membership runs out, and what happened with the win-back email
// (Sammy, 06/10/2026). The sync records the notice; the "Gave notice –
// win-back" automation sends the email a day later when it's switched on.

const WIN_BACK = "win_back";
type Window = "30" | "90" | "365" | "all";
const day = (iso: string) => dayTime(iso).split(",")[0];

export default function CancellationsPage() {
  const { s, now } = useStore();
  const [window, setWindow] = useState<Window>("90");

  const automation = s.automations.find((a) => a.id === WIN_BACK);

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
      .filter((c) => c.membership && (c.membership.cancelling || noticeAt.has(c.id)))
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
      .filter((r) => window === "all" || !r.noticeAt || now - Date.parse(r.noticeAt) <= Number(window) * 86400e3)
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
        <Link className="btn btn-ghost" href="/automations">Win-back automation</Link>
      </header>

      <div className="filters" role="search">
        <div className="filters-row">
          <select className="select" style={{ maxWidth: 260 }} aria-label="Gave notice within" value={window} onChange={(e) => setWindow(e.target.value as Window)}>
            <option value="30">Gave notice in the last 30 days</option>
            <option value="90">Gave notice in the last 3 months</option>
            <option value="365">Gave notice in the last year</option>
            <option value="all">Any time</option>
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
        {rows.length === 0 && <div className="empty">Nobody has given notice in this period.</div>}
      </section>
    </>
  );
}
