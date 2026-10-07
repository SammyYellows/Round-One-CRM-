"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmailAutomationCard } from "@/components/EmailAutomationCard";
import { ago, gbp, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { PAYMENT_FAILED_AT } from "@/lib/types";

// Members whose payments keep failing in TeamUp: flagged after three failed
// attempts (Sammy, 07/10/2026), with what they owe and whether the message
// has gone. The sync updates this nightly; the flag clears when TeamUp's
// attempt count resets after a successful payment.

const AUTOMATION = "payment_failed";
type Window = "30" | "90" | "all";

export default function PaymentsPage() {
  const { s, now } = useStore();
  const [window, setWindow] = useState<Window>("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;
  useEffect(() => setPage(1), [window]);
  const automation = s.automations.find((a) => a.id === AUTOMATION);

  const rows = useMemo(() => {
    const flaggedAt = new Map<string, string>();
    for (const e of s.events) if (e.type === "stage.changed" && e.contactId && / failed payment attempts on /.test(e.detail) && !flaggedAt.has(e.contactId)) flaggedAt.set(e.contactId, e.at);
    const emailAt = new Map<string, string>();
    for (const e of s.events) if (e.type === "email.sent" && e.contactId && /payment didn/i.test(e.detail) && !emailAt.has(e.contactId)) emailAt.set(e.contactId, e.at);
    return s.contacts
      .filter((c) => c.membership && c.membership.status !== "ended" && (c.membership.paymentRetries ?? 0) >= PAYMENT_FAILED_AT)
      .map((c) => {
        const m = c.membership!;
        const run = s.runs.filter((r) => r.contactId === c.id && r.automationId === AUTOMATION).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
        const sentAt = emailAt.get(c.id);
        let email: { label: string; tone: "sent" | "waiting" | "none" };
        if (sentAt) email = { label: `Sent ${shortDate(sentAt)}`, tone: "sent" };
        else if (run?.status === "waiting" && run.resumeAt) email = { label: `Goes ${shortDate(run.resumeAt)}`, tone: "waiting" };
        else if (!c.email) email = { label: "Not sent: no email", tone: "none" };
        else if (!flaggedAt.has(c.id)) email = { label: "Not sent: failing before tracking began", tone: "none" };
        else email = { label: automation?.enabled ? "Not sent" : "Not sent: automation off", tone: "none" };
        return { c, m, flaggedAt: flaggedAt.get(c.id), email };
      })
      .filter((r) => window === "all" || (r.flaggedAt ? now - Date.parse(r.flaggedAt) <= Number(window) * 86400e3 : false))
      .sort((a, b) => (b.m.paymentRetries ?? 0) - (a.m.paymentRetries ?? 0) || (b.m.owed?.total ?? 0) - (a.m.owed?.total ?? 0) || a.c.name.localeCompare(b.c.name));
  }, [s, now, window, automation]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const owedTotal = rows.reduce((n, r) => n + (r.m.owed?.total ?? 0), 0);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{rows.length} with {PAYMENT_FAILED_AT}+ failed attempts · {gbp(owedTotal, 2)} on open invoices · automation {automation?.enabled ? "on" : "off"}</div>
          <h1 className="h h1">Failed payments</h1>
        </div>
        <Link className="btn btn-ghost" href="/members">All members</Link>
      </header>

      <EmailAutomationCard automationId={AUTOMATION} title="The failed-payment email" purpose={`a member whose membership payment has failed ${PAYMENT_FAILED_AT} times, asking them to update their payment details`} when={`Goes from info@ when TeamUp's failed attempts reach ${PAYMENT_FAILED_AT}; replies come into Enquiries`} startOpen={false} />

      <div className="filters" role="search">
        <div className="filters-row">
          <select className="select" style={{ maxWidth: 280 }} aria-label="Flagged within" value={window} onChange={(e) => setWindow(e.target.value as Window)}>
            <option value="30">Flagged in the last 30 days</option>
            <option value="90">Flagged in the last 3 months</option>
            <option value="all">Any time (including before tracking began)</option>
          </select>
          <span className="small muted" style={{ marginLeft: "auto" }} aria-live="polite">
            {rows.length} {rows.length === 1 ? "person" : "people"}{pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          <div>Name</div><div>Membership</div><div>Failed attempts</div><div>Open invoices</div><div>Flagged</div><div>Email</div>
        </div>
        {shown.map(({ c, m, flaggedAt, email }) => (
          <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{c.name}</div>
              <div className="faint num" style={{ fontSize: 12 }}>{c.email || c.phone || "no contact details"}</div>
            </div>
            <div><div>{m.name}</div><div className="muted small">{m.category}</div></div>
            <div className="num">{m.paymentRetries}</div>
            <div className="muted small">{m.owed ? `${m.owed.count} · ${gbp(m.owed.total, 2)}${m.owed.since ? ` · since ${shortDate(m.owed.since)}` : ""}` : "–"}</div>
            <div className="muted small">{flaggedAt ? `${shortDate(flaggedAt)} · ${ago(flaggedAt, now)}` : "Before 7 Oct 2026"}</div>
            <div><span className={`chip ${email.tone === "sent" ? "chip-red" : email.tone === "waiting" ? "chip-light" : ""}`} style={{ height: 22, fontSize: 10, whiteSpace: "normal", textAlign: "left" }}>{email.label}</span></div>
          </Link>
        ))}
        {rows.length === 0 && <div className="empty">Nobody has {PAYMENT_FAILED_AT} or more failed attempts right now.</div>}
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
