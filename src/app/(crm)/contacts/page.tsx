"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContactFilters } from "@/components/ContactFilters";
import { ContactFilter, EMPTY_FILTER, SortKey, applyFilter, lastActivity, sortContacts, waitingOnUs } from "@/lib/contactQuery";
import { addContact, uid } from "@/lib/engine";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { SOURCES, Source, sourceLabel, stageLabel } from "@/lib/types";

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "stage", label: "Stage" },
  { key: "ad", label: "Source and ad" },
  { key: "trial", label: "Trial" },
  { key: "activity", label: "Last activity" },
  { key: "newest", label: "Added" },
];

export default function ContactsPage() {
  const { s, now, act } = useStore();
  const router = useRouter();
  const [filter, setFilter] = useState<ContactFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "newest", dir: 1 });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", source: "walk_in" as Source });

  // Links in: ?new=1 opens the add form, ?ad=<id> filters to one ad.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("new")) setAdding(true);
    const ad = p.get("ad");
    if (ad) setFilter((f) => ({ ...f, ad }));
  }, []);

  const list = sortContacts(s, applyFilter(s, s.contacts, filter, now), sort.key, sort.dir);

  const clickSort = (key: SortKey) =>
    setSort((cur) => {
      if (cur.key === key) return { key, dir: cur.dir === 1 ? -1 : 1 };
      return { key, dir: 1 };
    });
  const arrow = (key: SortKey | null) => (key && sort.key === key ? (sort.dir === 1 ? " ↓" : " ↑") : "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const id = uid();
    act((d) => { addContact(d, { ...draft, name: draft.name.trim() }, id); });
    router.push(`/contacts/${id}`);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{s.contacts.length} people</div>
          <h1 className="h h1">Contacts</h1>
        </div>
        <button className="btn btn-red" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add contact"}</button>
      </header>

      {adding && (
        <form className="card pad grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", alignItems: "end" }} onSubmit={save}>
          <div><label className="label" htmlFor="n">Name</label><input id="n" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus /></div>
          <div><label className="label" htmlFor="p">Mobile</label><input id="p" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
          <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
          <div>
            <label className="label" htmlFor="s">Source</label>
            <select id="s" className="select" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as Source })}>
              {SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
          <button className="btn btn-red" type="submit">Save contact</button>
        </form>
      )}

      <ContactFilters filter={filter} onChange={setFilter} count={list.length} total={s.contacts.length} />

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          {COLUMNS.map((c) => (
            <div key={c.label}>
              {c.key ? (
                <button className={`th-sort ${sort.key === c.key ? "on" : ""}`} onClick={() => clickSort(c.key!)} aria-label={`Sort by ${c.label}`}>
                  {c.label}{arrow(c.key)}
                </button>
              ) : c.label}
            </div>
          ))}
        </div>
        {list.map((c) => (
          <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{c.name}</div>
              <div className="faint num" style={{ fontSize: 12 }}>{c.phone}</div>
            </div>
            <div>
              {stageLabel(c.stage)}
              {waitingOnUs(s, c) && <span className="chip chip-light" style={{ height: 20, fontSize: 10, marginLeft: 6 }}>Reply</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="muted">{sourceLabel(c.source)}</div>
              {c.ad && <div className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ad}</div>}
            </div>
            <div className="muted small">{c.trialAt ? dayTime(c.trialAt) : "–"}</div>
            <div className="faint small">{ago(new Date(lastActivity(s, c)).toISOString(), now)}</div>
            <div className="faint small">{ago(c.createdAt, now)}</div>
          </Link>
        ))}
        {list.length === 0 && <div className="empty">No one matches these filters.</div>}
      </section>
    </>
  );
}
