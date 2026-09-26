"use client";

import Link from "next/link";
import { useState } from "react";
import { ContactFilters } from "@/components/ContactFilters";
import { ContactFilter, EMPTY_FILTER, SortKey, applyFilter, sortContacts, waitingOnUs } from "@/lib/contactQuery";
import { setStage } from "@/lib/engine";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Contact, STAGES, Source, Stage, sourceLabel } from "@/lib/types";

const COLUMNS = STAGES.filter((st) => st.id !== "lost");
const SRC_CHIP: Record<Source, string> = { meta_ad: "chip-red", walk_in: "", referral: "chip-light", website: "" };

export default function PipelinePage() {
  const { s, now, act } = useStore();
  const [filter, setFilter] = useState<ContactFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<SortKey>("newest");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const visible = applyFilter(s, s.contacts, filter, now);
  const inPlay = s.contacts.filter((c) => c.stage !== "lost");

  const next = (c: Contact) => {
    if (c.stage === "booked" && c.trialAt) return `Trial ${dayTime(c.trialAt)}`;
    if (waitingOnUs(s, c)) return "Waiting on a reply";
    const run = s.runs.find((r) => r.contactId === c.id && r.status === "waiting");
    if (run) return `${s.automations.find((a) => a.id === run.automationId)?.name} running`;
    if (c.tags.includes("no-show")) return "Missed their trial";
    return "";
  };

  const drop = (stage: Stage) => {
    if (dragId) act((d) => setStage(d, dragId, stage));
    setDragId(null);
    setOver(null);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{inPlay.length} people in play · drag a card to move it</div>
          <h1 className="h h1">Pipeline</h1>
        </div>
        <Link className="btn btn-red" href="/contacts?new=1">Add contact</Link>
      </header>

      <ContactFilters
        filter={filter}
        onChange={setFilter}
        sort={sort}
        onSort={setSort}
        showStages={false}
        count={visible.filter((c) => c.stage !== "lost").length}
        total={inPlay.length}
      />

      <div className="board">
        {COLUMNS.map((col, i) => {
          const cards = sortContacts(s, visible.filter((c) => c.stage === col.id), sort);
          return (
            <section
              key={col.id}
              className={`col ${over === col.id ? "over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
              onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
              onDrop={() => drop(col.id)}
              aria-label={col.label}
            >
              <div className={`col-head ${i === 0 ? "first" : ""} ${i === COLUMNS.length - 1 ? "last" : ""}`}>
                <h2 className="h" style={{ fontSize: 18 }}>{col.label}</h2>
                <span className="h muted" style={{ fontSize: 18 }}>{cards.length}</span>
              </div>
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className={`pcard ${dragId === c.id ? "dragging" : ""}`}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => { setDragId(null); setOver(null); }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`chip ${SRC_CHIP[c.source]}`}>{sourceLabel(c.source)}</span>
                    <span className="faint" style={{ fontSize: 12 }}>{ago(c.createdAt, now)}</span>
                  </div>
                  {c.ad && <div className="faint" style={{ fontSize: 12 }}>{c.ad}</div>}
                  {next(c) && <div className="small muted">{next(c)}</div>}
                </Link>
              ))}
              {cards.length === 0 && <div className="faint small" style={{ padding: "8px 2px" }}>No one here{filter.q || filter.source !== "all" || filter.ad !== "all" ? " with these filters" : ""}.</div>}
            </section>
          );
        })}
      </div>
    </>
  );
}
