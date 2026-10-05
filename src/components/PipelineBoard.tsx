"use client";

import Link from "next/link";
import { useState } from "react";
import { ContactFilters } from "@/components/ContactFilters";
import { ContactFilter, EMPTY_FILTER, SortKey, applyFilter, sortContacts, waitingOnUs } from "@/lib/contactQuery";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Contact, STAGES, Source, Stage, sourceLabel } from "@/lib/types";

// Two pipelines share this board (Sammy, 06/10/2026): "Meta" is everyone who
// came in through ads, the form, walk-ins, referrals, WhatsApp or email;
// "TeamUp" is everyone synced from TeamUp (members, ex-members and the
// people who signed up and never joined), filtered by when they came in.

const COLUMNS = STAGES.filter((st) => st.id !== "lost");
const SRC_CHIP: Record<Source, string> = { meta_ad: "chip-red", walk_in: "", referral: "chip-light", website: "", whatsapp: "", teamup: "", email: "" };
const TEAMUP_STATUS: Record<string, string> = { prospect: "Prospect", prospect_drop_off: "Dropped off", at_risk: "At risk", converted: "Converted", churned: "Churned", lost: "Lost" };

export function PipelineBoard({ kind }: { kind: "meta" | "teamup" }) {
  const { s, now, act } = useStore();
  const [filter, setFilter] = useState<ContactFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<SortKey>("newest");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const leads = s.contacts.filter((c) => (kind === "teamup" ? c.source === "teamup" : c.source !== "teamup"));
  const visible = applyFilter(s, leads, filter, now);
  const inPlay = leads.filter((c) => c.stage !== "lost");

  const next = (c: Contact) => {
    if (c.stage === "booked" && c.trialAt) return `Trial ${dayTime(c.trialAt)}`;
    if (waitingOnUs(s, c)) return "Waiting on a reply";
    const run = s.runs.find((r) => r.contactId === c.id && r.status === "waiting");
    if (run) return `${s.automations.find((a) => a.id === run.automationId)?.name} running`;
    if (c.tags.includes("no-show")) return "Missed their trial";
    return "";
  };

  // What TeamUp knows about them, on the card.
  const teamupLine = (c: Contact) => {
    const m = c.membership;
    if (m && m.status !== "ended") return `${m.status === "on_hold" ? "On hold" : "Member"} · ${m.name}`;
    if (m) return `Ex-member · ${m.name}${m.endsAt ? ` · ended ${ago(m.endsAt, now)}` : ""}`;
    const st = c.teamup?.status;
    return `Never joined${st ? ` · TeamUp says ${TEAMUP_STATUS[st] ?? st}` : ""}`;
  };

  const drop = (stage: Stage) => {
    if (dragId) act("setStage", dragId, stage);
    setDragId(null);
    setOver(null);
  };

  const filtered = filter.q || filter.source !== "all" || filter.ad !== "all" || filter.added !== "all" || filter.membership !== "all" || filter.waiting;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{inPlay.length} people in play · drag a card to move it</div>
          <h1 className="h h1">{kind === "teamup" ? "TeamUp pipeline" : "Meta pipeline"}</h1>
        </div>
        {kind === "meta" && <Link className="btn btn-red" href="/contacts?new=1">Add contact</Link>}
      </header>

      <ContactFilters
        filter={filter}
        onChange={setFilter}
        sort={sort}
        onSort={setSort}
        showStages={false}
        showSource={kind === "meta"}
        showAds={kind === "meta"}
        showMembership={kind === "teamup"}
        addedLabel={kind === "teamup" ? "Came in" : "Added"}
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
                    {kind === "meta" && <span className={`chip ${SRC_CHIP[c.source]}`}>{sourceLabel(c.source)}</span>}
                    <span className="faint" style={{ fontSize: 12 }}>{kind === "teamup" ? "Came in " : ""}{ago(c.createdAt, now)}</span>
                  </div>
                  {kind === "teamup" ? <div className="small muted">{teamupLine(c)}</div> : c.ad && <div className="faint" style={{ fontSize: 12 }}>{c.ad}</div>}
                  {next(c) && <div className="small muted">{next(c)}</div>}
                </Link>
              ))}
              {cards.length === 0 && <div className="faint small" style={{ padding: "8px 2px" }}>No one here{filtered ? " with these filters" : ""}.</div>}
            </section>
          );
        })}
      </div>
    </>
  );
}
