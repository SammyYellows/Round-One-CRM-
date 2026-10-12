"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";
import { sourceLabel } from "@/lib/types";
import { SEEN_WHATSAPP, conversations, lastSeenAt } from "@/lib/whatsappInbox";
import { WhatsAppThread } from "@/components/WhatsAppThread";

// The WhatsApp tab on Enquiries (Sammy, 12/10/2026): everyone who has
// messaged the gym number, newest first, with the conversation on the right.
// Replies follow WhatsApp's 24-hour rule, as on the contact page.

type View = "waiting" | "all";

export function WhatsAppInbox() {
  const { s, now, act } = useStore();
  // What counted as new when the tab opened, so those rows stay marked during this visit.
  const [seenBefore] = useState(() => lastSeenAt(SEEN_WHATSAPP));
  const all = conversations(s);
  const waiting = all.filter((c) => c.waiting);
  const [view, setView] = useState<View>(() => (waiting.length ? "waiting" : "all"));
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("contact");
    if (wanted) { setSelected(wanted); setView("all"); }
  }, []);

  const shown = view === "waiting" ? waiting : all;
  const current = all.find((c) => c.contact.id === selected) ?? null;
  const isNew = (at: string) => !seenBefore || Date.parse(at) > Date.parse(seenBefore);

  const open = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 800px)").matches) setTimeout(() => document.querySelector(".enq-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="enq">
      <section className="card">
        <div className="actions" style={{ padding: "14px 16px", gap: 8, flexWrap: "wrap" }}>
          {([["waiting", `To reply · ${waiting.length}`], ["all", `All · ${all.length}`]] as [View, string][]).map(([v, l]) => (
            <button key={v} className={`fchip fchip-sm ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="empty">{view === "waiting" ? "Nothing waiting. New WhatsApp messages show up here." : "No WhatsApp messages yet."}</div>
        ) : (
          shown.map(({ contact: c, last, lastIn, waiting: w }) => (
            <button key={c.id} className={`enq-row ${selected === c.id ? "on" : ""}`} onClick={() => open(c.id)}>
              <div className="enq-row-top">
                <span className="strong">{c.name}</span>
                <span className="faint small">{ago(last.at, now)}</span>
              </div>
              <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {last.dir === "out" ? "You: " : ""}{last.text}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {w && isNew(lastIn.at) && <span className="chip chip-red">New</span>}
                {w && !isNew(lastIn.at) && <span className="chip">Waiting for a reply</span>}
                {!w && last.dir === "in" && <span className="chip">No reply needed</span>}
                <span className="chip chip-light">{c.membership ? "Member" : sourceLabel(c.source)}</span>
              </div>
            </button>
          ))
        )}
      </section>

      <div className="enq-detail" style={{ minWidth: 0 }}>
        {!current ? (
          <section className="card"><div className="empty">Pick a conversation on the left.</div></section>
        ) : (
          <WhatsAppThread
            contactId={current.contact.id}
            extra={<>
              {current.waiting
                ? <button className="btn btn-ghost btn-sm" onClick={() => act("setWhatsAppDone", current.contact.id, true)}>No reply needed</button>
                : current.last.dir === "in" && <button className="btn btn-ghost btn-sm" onClick={() => act("setWhatsAppDone", current.contact.id, false)}>Needs a reply</button>}
              <Link href={`/contacts/${current.contact.id}`} className="btn btn-ghost btn-sm">Contact</Link>
            </>}
          />
        )}
      </div>
    </div>
  );
}
