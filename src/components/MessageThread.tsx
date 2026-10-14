"use client";

import { useEffect, useRef, useState } from "react";
import { firstName } from "@/lib/engine";
import { time } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CHANNEL_LABEL, Channel, SOCIAL_MAX_CHARS, channelOf } from "@/lib/types";

// One conversation: the thread and the reply box. WhatsApp (Sammy,
// 12/10/2026): free text inside the 24-hour window, approved templates
// outside it. Facebook and Instagram (14/10/2026): free text inside 24 hours,
// then a person's reply for up to 7 days, then nothing. Shared by the
// contact page and the Enquiries tabs.

const STATUS: Record<string, string> = { queued: "Sending", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" };

const FAKE_REPLIES = ["Sounds good, see you then", "Can I bring a friend?", "What should I wear?", "Great, thanks"];

/**
 * Whether staff can write freely, and for how many more hours. WhatsApp:
 * within 24 hours of their last message. Facebook and Instagram: within 24
 * hours, or `late` (a person's reply, Meta's human agent tag) up to 7 days.
 */
export function replyWindow(contactId: string, messages: { contactId: string; dir: string; at: string; channel?: Channel }[], now: number, channel: Channel = "whatsapp") {
  const lastIn = messages.filter((m) => m.contactId === contactId && m.dir === "in" && channelOf(m) === channel).at(-1);
  const since = lastIn ? (now - Date.parse(lastIn.at)) / 3600e3 : Infinity;
  if (channel === "whatsapp" || since < 24) return { open: since < 24, left: 24 - since, late: false };
  return { open: since < 24 * 7, left: 24 * 7 - since, late: true };
}

export function MessageThread({ contactId, channel = "whatsapp", draft: outerDraft, setDraft: setOuterDraft, extra, aiDraft }: {
  contactId: string;
  channel?: Channel;
  // Enquiries: show the AI's suggested reply above the box (the contact page has its own card).
  aiDraft?: boolean;
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
  const msgs = s.messages.filter((m) => m.contactId === contactId && channelOf(m) === channel);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgs.length, contactId]);
  useEffect(() => { setTemplate(null); }, [contactId]);
  if (!c) return null;

  const label = CHANNEL_LABEL[channel];
  const social = channel !== "whatsapp";
  const { open: windowOpen, left: windowLeft, late } = replyWindow(contactId, msgs, now, channel);
  const send = () => {
    if (!draft.trim() || !windowOpen) return;
    if (social) act("sendMessage", c.id, draft, channel);
    else act("sendMessage", c.id, draft);
    setDraft("");
  };

  return (
    <section className="card">
      <div className="card-head" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="h" style={{ fontSize: 24 }}>{label}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {extra}
          {windowOpen && !late && <span className="chip chip-light">Reply window open · {Math.ceil(windowLeft)}h left</span>}
          {windowOpen && late && <span className="chip">Staff reply only · {Math.ceil(windowLeft / 24)} day{Math.ceil(windowLeft / 24) === 1 ? "" : "s"} left</span>}
          {!windowOpen && <span className="chip">{social ? "Can’t reply" : "Window closed · templates only"}</span>}
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

      {aiDraft && <AiDraft contactId={c.id} channel={channel} windowOpen={windowOpen} onUse={setDraft} />}
      {windowOpen ? (
        <>
          {late && (
            <div className="small muted" style={{ padding: "14px 22px 0" }}>
              It’s been more than 24 hours since {firstName(c)} last messaged. Meta still allows a reply written by a person, up to 7 days after their last message.
            </div>
          )}
          <QuickReplies onPick={setDraft} />
          <div style={{ padding: "12px 22px 0", display: "flex", gap: 8 }}>
            <textarea
              className="input"
              aria-label={`Message ${firstName(c)} on ${label}`}
              placeholder="Write a message"
              value={draft}
              // One line until a longer reply (e.g. an AI draft with a sign-off) needs more.
              rows={draft.includes("\n") || draft.length > 70 ? 5 : 1}
              style={{ height: "auto", minHeight: 48, paddingTop: 12, paddingBottom: 12, resize: "vertical", lineHeight: 1.45 }}
              maxLength={social ? SOCIAL_MAX_CHARS[channel] : undefined}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn btn-red" style={{ alignSelf: "flex-end" }} onClick={send}>Send</button>
          </div>
          <div style={{ height: 22 }} />
        </>
      ) : social ? (
        <div className="small muted" style={{ padding: "14px 22px 22px" }}>
          {msgs.some((m) => m.dir === "in")
            ? `It’s been more than 7 days since ${firstName(c)} last messaged on ${label}, so Meta doesn’t allow a reply. If they message again, you can reply here.`
            : `${firstName(c)} hasn’t messaged us on ${label}. Meta only lets us reply to people who message first.`}
        </div>
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
          <button className="link-btn faint" onClick={() => act("receiveMessage", c.id, FAKE_REPLIES[msgs.length % FAKE_REPLIES.length], undefined, channel)}>
            Simulate a reply from {firstName(c)}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The AI's suggested reply to their latest message (Sammy, 14/10/2026: AI
 * drafts on WhatsApp, Facebook and Instagram, as for email). Written when
 * their message comes in, or when staff press "Draft a reply". Nothing is
 * sent: Use it puts it in the box to edit, then staff press Send.
 */
function AiDraft({ contactId, channel, windowOpen, onUse }: { contactId: string; channel: Channel; windowOpen: boolean; onUse: (text: string) => void }) {
  const { s, act, live, refresh } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { setNote(null); }, [contactId]);
  const c = s.contacts.find((x) => x.id === contactId);
  const mine = s.messages.filter((m) => m.contactId === contactId);
  const lastIn = mine.filter((m) => m.dir === "in").at(-1);
  const last = mine.at(-1);
  // Only on the conversation they last wrote in, and only while it waits for us.
  if (!c || !lastIn || channelOf(lastIn) !== channel || last?.dir !== "in") return null;
  const ins = c.insight;
  const current = !!ins && Date.parse(ins.updatedAt) >= Date.parse(lastIn.at);
  if (current && ins.replyUsedAt) return null; // already in the box
  const ready = current && ins.suggestedReply && !ins.replyDismissedAt;

  const draft = async () => {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/contacts/${contactId}/draft`, { method: "POST" }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (res?.ok) refresh();
    else setNote(j?.error ?? "Couldn’t draft a reply. Try again.");
  };

  if (!ready) {
    if (!live) return null;
    return (
      <div style={{ padding: "14px 22px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={draft}>{busy ? "Drafting" : "Draft a reply"}</button>
        <span className="small faint">{note ?? "The AI writes a reply for you to check. Nothing sends until you press Send."}</span>
      </div>
    );
  }
  return (
    <div style={{ margin: "14px 22px 0", padding: "12px 14px", background: "var(--char)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="label" style={{ margin: 0 }}>Suggested reply · nothing goes until you send it</div>
      <div className="small" style={{ whiteSpace: "pre-wrap" }}>{ins.suggestedReply}</div>
      <div className="actions" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" disabled={!windowOpen} onClick={() => { onUse(ins.suggestedReply!); act("settleInsightReply", contactId, true); }}>Use it</button>
        <button className="btn btn-ghost btn-sm" onClick={() => act("settleInsightReply", contactId, false)}>Dismiss</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={draft}>{busy ? "Drafting" : "Draft again"}</button>
        {!windowOpen && <span className="small faint">{channel === "whatsapp" ? "Their 24-hour window has closed; send a template instead." : "Too long since their last message for Meta to take a reply."}</span>}
        {note && <span className="small faint">{note}</span>}
      </div>
    </div>
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
