"use client";

import { useEffect, useRef, useState } from "react";
import { Rich } from "@/components/Rich";
import { photoNow } from "@/lib/champPhotos";
import { useStore } from "@/lib/store";

// A smaller Ask Champ under the draft replies on Enquiries (Sammy,
// 15/10/2026). Same Champ as the Champ page, already pointed at the person
// being replied to, so "when were they last in?" just works. Read-only like
// Champ itself: a class booking still waits for Book. The chat is saved and
// carries on at full size with Open in Champ.

interface Msg { id: string; role: "user" | "assistant"; text: string }
interface Booking { id: string; label: string; status: "pending" | "booked" | "failed" | "dismissed"; error?: string | null }

const STARTERS = ["What do we know about them?", "When were they last in?", "Which class would suit them?"];

export function ChampMini({ contactId, channel, card }: { contactId?: string | null; channel: string; card?: boolean }) {
  const { live } = useStore();
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookBusy, setBookBusy] = useState("");
  const [err, setErr] = useState("");
  const [src] = useState(photoNow);
  const endRef = useRef<HTMLDivElement>(null);

  // A new person is a new chat.
  useEffect(() => { setChatId(null); setMsgs([]); setBookings([]); setDraft(""); setErr(""); }, [contactId]);
  useEffect(() => { if (msgs.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);

  if (!live) return null;

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setDraft(""); setErr(""); setBusy(true);
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    try {
      const r = await fetch("/api/champ", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, text, ...(contactId ? { about: { contactId, channel } } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Champ couldn’t answer just now");
      setChatId(j.chatId);
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: j.answer }]);
      setBookings(j.bookings ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  // Nothing goes into TeamUp until Book is pressed, as on the Champ page.
  const decide = async (b: Booking, action: "book" | "dismiss") => {
    setBookBusy(b.id); setErr("");
    const r = await fetch("/api/champ/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, action }) });
    const j = await r.json().catch(() => ({}));
    setBookings((all) => all.map((x) => (x.id === b.id ? { ...x, status: r.ok ? (action === "book" ? "booked" : "dismissed") : "failed", error: r.ok ? null : j.message ?? j.error } : x)));
    setBookBusy("");
  };

  return (
    <section className={card ? "card" : undefined} style={{ borderTop: card ? undefined : "1px solid var(--line)", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10, marginTop: card ? 16 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src={src} alt="" style={{ height: 52, width: "auto", objectFit: "contain", display: "block", flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 22, textTransform: "uppercase", color: "var(--red)", lineHeight: 1 }}>Ask Champ</div>
          <div className="small faint" style={{ marginTop: 4 }}>Looks things up, never sends anything{contactId ? ". Knows who you’re replying to." : "."}</div>
        </div>
        {chatId && <a href={`/champ?chat=${chatId}`} className="btn btn-ghost btn-sm">Open in Champ</a>}
      </div>

      {msgs.length === 0 && !busy && contactId && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STARTERS.map((q) => <button key={q} className="fchip fchip-sm champ-starter" style={{ textTransform: "none", letterSpacing: 0 }} onClick={() => ask(q)}>{q}</button>)}
        </div>
      )}

      {(msgs.length > 0 || busy) && (
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {msgs.map((m) => (
            <div key={m.id} className="small" style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%", padding: "8px 12px", background: m.role === "user" ? "var(--line)" : "transparent", borderLeft: m.role === "assistant" ? "3px solid var(--red)" : undefined, lineHeight: 1.5 }}>
              {m.role === "assistant" ? <Rich text={m.text} /> : <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
            </div>
          ))}
          {bookings.map((b) => (
            <div key={b.id} className="enq-confirm">
              <div className="small"><span className="label" style={{ margin: 0 }}>Class booking</span> {b.label}</div>
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-red btn-sm" disabled={bookBusy === b.id} onClick={() => decide(b, "book")}>{bookBusy === b.id ? "Booking…" : "Book"}</button>
                  <button className="btn btn-ghost btn-sm" disabled={bookBusy === b.id} onClick={() => decide(b, "dismiss")}>Don’t book</button>
                </div>
              )}
              {b.status === "booked" && <div className="small">Booked in TeamUp ✓</div>}
              {b.status === "dismissed" && <div className="small faint">Not booked.</div>}
              {b.status === "failed" && <div className="small" style={{ color: "var(--red)" }}>Not booked: {b.error}</div>}
            </div>
          ))}
          {busy && <div className="small muted" style={{ borderLeft: "3px solid var(--red)", padding: "8px 12px" }} aria-live="polite">Champ is on it…</div>}
          <div ref={endRef} />
        </div>
      )}

      {err && <div className="small" style={{ color: "var(--red)" }} role="alert">{err}</div>}
      <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} style={{ display: "flex", gap: 8 }}>
        <label htmlFor={`champ-mini-${channel}`} className="sr-only">Ask Champ</label>
        <input id={`champ-mini-${channel}`} className="input" style={{ flex: 1, minWidth: 0 }} placeholder={contactId ? "Ask Champ about them, a class, or what to say" : "Ask Champ"} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} maxLength={2000} />
        <button className="btn btn-red btn-sm" disabled={busy || !draft.trim()}>Ask</button>
      </form>
    </section>
  );
}
