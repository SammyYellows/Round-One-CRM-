"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
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
  const { s, now } = useStore();
  const [window, setWindow] = useState<Window>("all");
  const [includeEnded, setIncludeEnded] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;
  useEffect(() => setPage(1), [window, includeEnded]);

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
      // Serving notice now, a notice the sync recorded, or (when included)
      // cancellations that have already run out.
      .filter((c) => c.membership && (noticeAt.has(c.id) || (c.membership.cancelling && (includeEnded || c.membership.status !== "ended"))))
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
      // Recorded notices newest first, then people still serving notice (soonest to end first), then ended ones (most recent first).
      .sort((a, b) => {
        const grp = (r: typeof a) => (r.noticeAt ? 0 : r.m.status !== "ended" ? 1 : 2);
        if (grp(a) !== grp(b)) return grp(a) - grp(b);
        if (grp(a) === 0) return Date.parse(b.noticeAt!) - Date.parse(a.noticeAt!);
        const ea = a.m.endsAt ? Date.parse(a.m.endsAt) : 0, eb = b.m.endsAt ? Date.parse(b.m.endsAt) : 0;
        return grp(a) === 1 ? ea - eb : eb - ea;
      });
  }, [s, now, window, automation, includeEnded]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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

      <EmailAutomationCard automationId={WIN_BACK} title="The win-back email" purpose="the day after a member gives notice to cancel, to see if anything would change their mind (win-back)" when="Goes from info@ the day after a notice is recorded; replies come into Enquiries" />

      <div className="filters" role="search">
        <div className="filters-row">
          <select className="select" style={{ maxWidth: 260 }} aria-label="Gave notice within" value={window} onChange={(e) => setWindow(e.target.value as Window)}>
            <option value="30">Gave notice in the last 30 days</option>
            <option value="90">Gave notice in the last 3 months</option>
            <option value="365">Gave notice in the last year</option>
            <option value="all">Any time (including notices given before tracking began)</option>
          </select>
          <button className={`fchip fchip-sm ${includeEnded ? "on" : ""}`} aria-pressed={includeEnded} onClick={() => setIncludeEnded((v) => !v)}>Include memberships already ended</button>
          <span className="small muted" style={{ marginLeft: "auto" }} aria-live="polite">
            {rows.length} {rows.length === 1 ? "person" : "people"}{pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          <div>Name</div><div>Membership</div><div>Gave notice</div><div>Membership ends</div><div>Win-back email</div><div>Marketing</div>
        </div>
        {shown.map(({ c, m, noticeAt, email }) => (
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
        {pages > 1 && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="small muted">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, rows.length)} of {rows.length}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </section>
    </>
  );
}
