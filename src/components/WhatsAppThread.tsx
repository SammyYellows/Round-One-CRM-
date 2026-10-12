"use client";

import { useEffect, useRef, useState } from "react";
import { firstName } from "@/lib/engine";
import { time } from "@/lib/format";
import { useStore } from "@/lib/store";

// The WhatsApp card: the thread, the reply box inside the 24-hour window and
// approved templates outside it. Shared by the contact page and the WhatsApp
// tab on Enquiries (Sammy, 12/10/2026).

const STATUS: Record<string, string> = { queued: "Sending", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" };

const FAKE_REPLIES = ["Sounds good, see you then", "Can I bring a friend?", "What should I wear?", "Great, thanks"];

/** WhatsApp only allows free-text replies within 24 hours of their last message. */
export function replyWindow(contactId: string, messages: { contactId: string; dir: string; at: string }[], now: number) {
  const lastIn = messages.filter((m) => m.contactId === contactId && m.dir === "in").at(-1);
  const left = lastIn ? 24 - (now - Date.parse(lastIn.at)) / 3600e3 : 0;
  return { open: left > 0, left };
}

export function WhatsAppThread({ contactId, draft: outerDraft, setDraft: setOuterDraft, extra }: {
  contactId: string;
  // Optional: the contact page fills the box from "Use it" on a suggested reply.
  draft?: string;
  setDraft?: (v: string) => void;
  extra?: React.ReactNode; // more buttons in the card head
}) {
  const { s, now, act, live } = useStore();
  const [ownDraft, setOwnDraft] = useState("");
  const draft = outerDraft ?? ownDraft;
  const setDraft = setOuterDraft ?? setOwnDraft;
  const [template, setTemplate] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const c = s.contacts.find((x) => x.id === contactId);
  const msgs = s.messages.filter((m) => m.contactId === contactId);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgs.length, contactId]);
  useEffect(() => { setTemplate(null); }, [contactId]);
  if (!c) return null;

  const { open: windowOpen, left: windowLeft } = replyWindow(contactId, msgs, now);
  const send = () => {
    if (!draft.trim() || !windowOpen) return;
    act("sendMessage", c.id, draft);
    setDraft("");
  };

  return (
    <section className="card">
      <div className="card-head" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="h" style={{ fontSize: 24 }}>WhatsApp</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {extra}
          {windowOpen
            ? <span className="chip chip-light">Reply window open · {Math.ceil(windowLeft)}h left</span>
            : <span className="chip">Window closed · templates only</span>}
        </div>
      </div>
      <div className="thread" ref={threadRef}>
        {msgs.length === 0 && <div className="faint small">No messages yet.</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.dir}`}>
            <div>{m.text}</div>
            <div className="mmeta">
              {m.dir === "out" ? (m.template ? `${m.by} · ${m.template}` : m.by ?? "You") : firstName(c)} · {time(m.at)}
              {m.dir === "out" && m.status && STATUS[m.status] ? ` · ${STATUS[m.status]}` : ""}
            </div>
            {m.status === "failed" && m.error && <div className="mmeta" style={{ color: "var(--red-btn)" }}>{m.error}</div>}
          </div>
        ))}
      </div>

      {windowOpen ? (
        <>
          <QuickReplies onPick={setDraft} />
          <div style={{ padding: "12px 22px 0", display: "flex", gap: 8 }}>
            <input
              className="input"
              aria-label={`Message ${firstName(c)} on WhatsApp`}
              placeholder="Write a message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <button className="btn btn-red" onClick={send}>Send</button>
          </div>
          <div style={{ height: 22 }} />
        </>
      ) : (
        <div style={{ padding: "14px 22px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="small muted">
            It’s been more than 24 hours since {firstName(c)} last messaged, so WhatsApp only allows approved templates. Pick one to see it before it sends.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.keys(s.templates).map((t) => (
              <button key={t} className={`qr ${template === t ? "on" : ""}`} aria-pressed={template === t} onClick={() => setTemplate(template === t ? null : t)}>{t}</button>
            ))}
          </div>
          {template && s.templates[template] && (
            <div className="enq-confirm" role="alertdialog" aria-labelledby="wa-confirm-h">
              <div id="wa-confirm-h" className="strong">Send {template} to {c.name}?</div>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>{s.templates[template]}</div>
              <div className="actions" style={{ gap: 10 }}>
                <button className="btn btn-red" onClick={() => { act("sendTemplateTo", c.id, template); setTemplate(null); }}>Yes, send it</button>
                <button className="btn btn-ghost" onClick={() => setTemplate(null)}>Cancel</button>
              </div>
            </div>
          )}
          <QuickReplies />
        </div>
      )}
      {!live && (
        <div style={{ padding: "0 22px 22px" }}>
          <button className="link-btn faint" onClick={() => act("receiveMessage", c.id, FAKE_REPLIES[msgs.length % FAKE_REPLIES.length])}>
            Simulate a reply from {firstName(c)}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * One-tap lines for WhatsApp replies, shared by all staff. With `onPick`, the
 * lines are buttons that fill the reply box; without it (outside the 24-hour
 * window, when free text can't be sent) only the edit link shows.
 */
function QuickReplies({ onPick }: { onPick?: (text: string) => void }) {
  const { s, act } = useStore();
  const [editing, setEditing] = useState<string[] | null>(null);

  if (editing) {
    const set = (i: number, v: string) => setEditing(editing.map((x, j) => (j === i ? v : x)));
    return (
      <div style={{ padding: "14px 22px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label" style={{ margin: 0 }}>Quick replies</div>
        {editing.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input className="input" aria-label={`Quick reply ${i + 1}`} value={line} maxLength={500} onChange={(e) => set(i, e.target.value)} placeholder="e.g. Wear trainers and comfy gym clothes" />
            <button className="icon-btn" aria-label={`Remove quick reply ${i + 1}`} onClick={() => setEditing(editing.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing([...editing, ""])} disabled={editing.length >= 20}>Add a line</button>
          <button className="btn btn-red btn-sm" onClick={() => { act("setQuickReplies", editing); setEditing(null); }}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
        </div>
        <div className="small faint">Everyone who logs in sees the same lines. Tapping one puts it in the reply box; nothing sends until you press Send.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 22px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {onPick && s.quickReplies.map((q) => <button key={q} className="qr" onClick={() => onPick(q)}>{q}</button>)}
      {onPick && s.quickReplies.length === 0 && <span className="small faint">No quick replies yet.</span>}
      <button className="link-btn small" onClick={() => setEditing(s.quickReplies.length ? [...s.quickReplies] : [""])}>
        {s.quickReplies.length ? "Edit quick replies" : "Add quick replies"}
      </button>
    </div>
  );
}
