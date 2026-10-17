"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dayTime, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";

// Every to-do confirmed as done, when and by whom (Sammy, 17/10/2026),
// newest first. Linked from Needs you on Today; not on the sidebar. To-dos
// cleared before 17 Oct 2026 have no record of who or when.

const PER_PAGE = 50;

export default function TasksPage() {
  const { s, now } = useStore();
  const [page, setPage] = useState(1);
  const done = useMemo(
    () => s.tasks.filter((t) => t.done).sort((a, b) => Date.parse(b.doneAt ?? "1970-01-01") - Date.parse(a.doneAt ?? "1970-01-01") || Date.parse(b.at) - Date.parse(a.at)),
    [s.tasks],
  );
  const pages = Math.max(1, Math.ceil(done.length / PER_PAGE));
  const shown = done.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const name = (id?: string) => (id ? s.contacts.find((c) => c.id === id)?.name : undefined);
  const lastWeek = done.filter((t) => t.doneAt && now - Date.parse(t.doneAt) <= 7 * 86400e3).length;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{done.length} cleared · {lastWeek} in the last 7 days</div>
          <h1 className="h h1">Completed to-dos</h1>
        </div>
        <Link className="btn btn-ghost" href="/">Back to Today</Link>
      </header>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0, gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr) 150px minmax(0, 1fr)" }}>
          <div>To-do</div><div>Person</div><div>Cleared</div><div>By</div>
        </div>
        {shown.length === 0 && <div className="pad small muted">Nothing cleared yet.</div>}
        {shown.map((t) => (
          <div key={t.id} className="crow" style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr) 150px minmax(0, 1fr)" }}>
            <div style={{ minWidth: 0 }}>
              <div>{t.text}</div>
              <div className="faint small">Added {shortDate(t.at)}</div>
            </div>
            <div className="small" style={{ minWidth: 0 }}>{t.contactId ? <Link href={`/contacts/${t.contactId}`} style={{ textDecoration: "underline" }}>{name(t.contactId) ?? "Open"}</Link> : "–"}</div>
            <div className="small muted">{t.doneAt ? dayTime(t.doneAt) + ` · ${shortDate(t.doneAt)}` : "Before 17 Oct 2026"}</div>
            <div className="small">{t.doneBy ?? <span className="muted">Not recorded</span>}</div>
          </div>
        ))}
        {pages > 1 && (
          <div className="pad actions" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
            <span className="small muted">Page {page} of {pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Older</button>
          </div>
        )}
      </section>
    </>
  );
}
