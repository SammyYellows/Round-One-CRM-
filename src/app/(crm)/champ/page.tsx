"use client";

import { useEffect, useRef, useState } from "react";
import { Rich } from "@/components/Rich";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";

// Champ, Round One's assistant (Sammy, 10/10/2026). Staff ask about members,
// classes, attendance, waivers, a member's payments, training and sales.
// Read-only: Champ looks things up but never changes or sends anything.
// Chats are saved; owners and managers can read everyone's.

interface Chat { id: string; staff_id: string | null; staff_name: string; title: string; updated_at: string }
interface Msg { id: number | string; role: "user" | "assistant"; text: string; tools?: string[]; created_at?: string }

const STARTERS = [
  "Who’s in the gym right now?",
  "Who hasn’t been in for three weeks?",
  "What classes are on tomorrow and how full are they?",
  "Who owes money at the moment?",
  "Give me a 45-minute beginners’ boxing class plan",
  "How do I handle “it’s too expensive” in an intro meeting?",
];

const TOOL_LABEL: Record<string, string> = {
  find_people: "searched people", person_details: "opened a profile", list_members: "listed members", member_numbers: "counted members",
  list_leads: "listed leads", pipeline_overview: "checked the pipeline", trials: "checked trials", classes: "checked classes",
  class_attendees: "checked a class register", person_classes: "checked class bookings", person_door_entries: "checked door entries",
  who_is_in_now: "checked who’s in", class_popularity: "checked class numbers", teamup_lookup: "looked in TeamUp",
};


// Champ's pictures (Sammy, 10/10/2026), one at a time, changing every 45
// minutes. Worked out from the clock, so everyone sees the same one.
const PHOTOS = ["/champ/champ-1.webp", "/champ/champ-2.webp", "/champ/champ-3.webp"];
const ROTATE_MS = 45 * 60e3;
const photoNow = () => PHOTOS[Math.floor(Date.now() / ROTATE_MS) % PHOTOS.length];

function ChampPortrait() {
  const [src, setSrc] = useState(photoNow);
  useEffect(() => {
    const id = setInterval(() => setSrc(photoNow()), 60e3);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
      <img src={src} alt="Champ, Round One’s assistant" style={{ height: 160, width: "auto", display: "block" }} />
      <div style={{ fontFamily: "var(--display)", fontSize: 32, textTransform: "uppercase", color: "var(--red)", lineHeight: 1, paddingBottom: 6 }}>Champ</div>
    </div>
  );
}

export default function ChampPage() {
  const { now, live } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [everyone, setEveryone] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [mine, setMine] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadChats = async (all = everyone) => {
    const r = await fetch(`/api/champ${all ? "?all=1" : ""}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setChats(j.chats); setCanSeeAll(j.canSeeAll); setConfigured(j.configured); }
  };
  useEffect(() => { if (live) loadChats(); }, [live, everyone]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opened from a link (the manager's conduct email): /champ?chat=<id>
  useEffect(() => {
    if (!live) return;
    const id = new URLSearchParams(window.location.search).get("chat");
    if (id) open(id);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const open = async (id: string) => {
    setErr(""); setChatId(id);
    const r = await fetch(`/api/champ?chat=${id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsgs(j.messages); setMine(j.mine); } else setErr(j.error ?? "Couldn’t open that chat");
  };
  const fresh = () => { setChatId(null); setMsgs([]); setMine(true); setErr(""); };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setDraft(""); setErr(""); setBusy(true);
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    try {
      const r = await fetch("/api/champ", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Champ couldn’t answer just now");
      setChatId(j.chatId);
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: j.answer, tools: j.tools }]);
      loadChats();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  if (!live) return <div className="card empty">Champ needs the live CRM.</div>;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Round One’s assistant · looks things up, never changes anything</div>
          <h1 className="h h1">Champ</h1>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="champ-grid">
        <aside className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-red btn-sm" onClick={fresh}>New chat</button>
          {canSeeAll && <a href="/champ/train" className="btn btn-ghost btn-sm">Train Champ</a>}
          {canSeeAll && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className={`fchip fchip-sm ${!everyone ? "on" : ""}`} style={{ flex: 1 }} aria-pressed={!everyone} onClick={() => setEveryone(false)}>Mine</button>
              <button className={`fchip fchip-sm ${everyone ? "on" : ""}`} style={{ flex: 1 }} aria-pressed={everyone} onClick={() => setEveryone(true)}>Everyone’s</button>
            </div>
          )}
          <div className="champ-list" style={{ display: "flex", flexDirection: "column", maxHeight: "60vh", overflowY: "auto" }}>
            {chats.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="link-btn" style={{ textAlign: "left", padding: "8px 6px", borderTop: "1px solid var(--line)", background: c.id === chatId ? "var(--line)" : "transparent" }}>
                <div className="small strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "Chat"}</div>
                <div className="faint" style={{ fontSize: 11 }}>{everyone ? `${c.staff_name} · ` : ""}{ago(c.updated_at, now)}</div>
              </button>
            ))}
            {chats.length === 0 && <div className="small faint" style={{ padding: 6 }}>No chats yet.</div>}
          </div>
        </aside>

        <section className="card" style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
          <div className="champ-thread" style={{ flex: 1, padding: "16px 22px", overflowY: "auto", maxHeight: "62vh" }}>
            {msgs.length === 0 && !busy && (
              <div className="small muted" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>Ask about a member, a class, who’s in, a missed payment, or for training and sales ideas. Try:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {STARTERS.map((q) => <button key={q} className="fchip fchip-sm champ-starter" style={{ textTransform: "none", letterSpacing: 0 }} onClick={() => ask(q)}>{q}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", margin: "10px 0" }}>
                <div className="champ-bubble" style={{ maxWidth: "80%", padding: "10px 14px", background: m.role === "user" ? "var(--line)" : "transparent", borderLeft: m.role === "assistant" ? "3px solid var(--red)" : undefined, fontSize: 14, lineHeight: 1.55 }}>
                  {m.role === "assistant" ? <Rich text={m.text} /> : <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
                  {m.role === "assistant" && m.tools && m.tools.length > 0 && <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>Champ {m.tools.map((t) => TOOL_LABEL[t] ?? t).join(", ")}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="small muted" style={{ margin: "10px 0", borderLeft: "3px solid var(--red)", padding: "10px 14px" }} aria-live="polite">Champ is on it…</div>}
            <div ref={endRef} />
          </div>

          <div style={{ borderTop: "1px solid var(--line)", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            <ChampPortrait />
            {err && <div className="small" style={{ color: "var(--red)" }} role="alert">{err}</div>}
            {!configured && <div className="small" style={{ color: "var(--red)" }}>Champ isn’t switched on yet: the Claude API key is missing.</div>}
            {mine ? (
              <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} style={{ display: "flex", gap: 8 }}>
                <label htmlFor="champ-q" className="sr-only">Ask Champ</label>
                <textarea id="champ-q" className="input" rows={2} style={{ flex: 1, resize: "vertical", paddingTop: 10 }} placeholder="Ask Champ about a member, a class, training or sales" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }} disabled={busy} maxLength={2000} />
                <button className="btn btn-red" disabled={busy || !draft.trim()}>Ask</button>
              </form>
            ) : (
              <div className="small muted">This is someone else’s chat, so it’s read-only. <button className="link-btn" onClick={fresh}>Start your own</button></div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
