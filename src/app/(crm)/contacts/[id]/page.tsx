"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  bookTrial, describeStep, firstName, markNoShow, receiveMessage, sendMessage, sendTemplate, setStage, stopRun,
} from "@/lib/engine";
import { ago, dayTime, time, toLocalInput } from "@/lib/format";
import { useStore } from "@/lib/store";
import { STAGES, Stage, apptStatusLabel, sourceLabel, stageLabel } from "@/lib/types";

const QUICK = ["Gloves are provided for your trial", "Complete beginners are very welcome", "Does Wednesday at 18:00 work for you?"];
const FAKE_REPLIES = ["Sounds good, see you then", "Can I bring a friend?", "What should I wear?", "Great, thanks"];

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const { s, now, act } = useStore();
  const [draft, setDraft] = useState("");
  const [trialAt, setTrialAt] = useState(() => {
    const d = new Date(now + 86400e3);
    d.setHours(18, 0, 0, 0);
    return toLocalInput(d.getTime());
  });
  const threadRef = useRef<HTMLDivElement>(null);

  const c = s.contacts.find((x) => x.id === id);
  const msgs = s.messages.filter((m) => m.contactId === id);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgs.length]);

  if (!c) {
    return (
      <div className="card pad">
        <p>We can’t find that contact.</p>
        <Link href="/contacts">Back to contacts</Link>
      </div>
    );
  }

  // WhatsApp only allows free-text replies within 24 hours of their last message.
  const lastIn = [...msgs].reverse().find((m) => m.dir === "in");
  const windowLeft = lastIn ? 24 - (now - Date.parse(lastIn.at)) / 3600e3 : 0;
  const windowOpen = windowLeft > 0;

  const runs = s.runs.filter((r) => r.contactId === id && r.status === "waiting");
  const appts = s.appointments.filter((a) => a.contactId === id).sort((a, b) => Date.parse(b.start) - Date.parse(a.start)).slice(0, 6);
  const timeline = s.events.filter((e) => e.contactId === id).slice(0, 12);

  const send = () => {
    if (!draft.trim() || !windowOpen) return;
    act((d) => sendMessage(d, c.id, draft));
    setDraft("");
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link href="/pipeline" style={{ color: "var(--muted)" }}>Pipeline</Link> / {stageLabel(c.stage)}</div>
          <h1 className="h h1">{c.name}</h1>
        </div>
        <div className="actions">
          {c.stage === "trial_booked" && (
            <button className="btn btn-ghost" onClick={() => act((d) => markNoShow(d, c.id))}>Mark as no-show</button>
          )}
          {c.stage === "trial_done" && (
            <button className="btn btn-red" onClick={() => act((d) => setStage(d, c.id, "member"))}>Mark as joined</button>
          )}
        </div>
      </header>

      <div className="grid cols-contact">
        <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="stage" className="label">Stage</label>
            <select id="stage" className="select" value={c.stage} onChange={(e) => act((d) => setStage(d, c.id, e.target.value as Stage))}>
              {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="trial" className="label">{c.trialAt ? `Trial: ${dayTime(c.trialAt)}` : "Book a trial"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="trial" type="datetime-local" className="input" style={{ minWidth: 0 }} value={trialAt} onChange={(e) => setTrialAt(e.target.value)} />
              <button className="btn btn-red" style={{ padding: "0 14px" }} onClick={() => act((d) => bookTrial(d, c.id, trialAt))}>
                {c.trialAt ? "Move" : "Book"}
              </button>
            </div>
          </div>
          <dl style={{ margin: 0 }}>
            <div className="field"><dt>Mobile</dt><dd className="num">{c.phone || "Not given"}</dd></div>
            <div className="field"><dt>Email</dt><dd>{c.email || "Not given"}</dd></div>
            <div className="field"><dt>Source</dt><dd>{sourceLabel(c.source)}</dd></div>
            {(c.campaign || c.ad) && (
              <div className="field">
                <dt>Came from</dt>
                <dd style={{ lineHeight: 1.6 }}>
                  {c.ad && <><Link href="/ads" className="strong">{c.ad}</Link><br /></>}
                  <span className="muted small">
                    {[s.campaigns.find((k) => k.utm === c.campaign)?.name ?? c.campaign, c.adset].filter(Boolean).join(" · ")}
                  </span>
                </dd>
              </div>
            )}
            {c.answers.map((a) => (
              <div key={a.question} className="field"><dt>{a.question}</dt><dd>{a.answer || "Skipped"}</dd></div>
            ))}
            <div className="field"><dt>Added</dt><dd>{ago(c.createdAt, now)}</dd></div>
          </dl>
          {c.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.tags.map((t) => <span key={t} className={`chip ${t === "no-show" ? "chip-red" : ""}`}>{t}</span>)}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head" style={{ alignItems: "center" }}>
            <h2 className="h" style={{ fontSize: 24 }}>WhatsApp</h2>
            {windowOpen
              ? <span className="chip chip-light">Reply window open · {Math.ceil(windowLeft)}h left</span>
              : <span className="chip">Window closed · templates only</span>}
          </div>
          <div className="thread" ref={threadRef}>
            {msgs.length === 0 && <div className="faint small">No messages yet.</div>}
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.dir}`}>
                <div>{m.text}</div>
                <div className="mmeta">
                  {m.dir === "out" ? (m.template ? `${m.by} · ${m.template}` : m.by ?? "You") : firstName(c)} · {time(m.at)}
                </div>
              </div>
            ))}
          </div>

          {windowOpen ? (
            <>
              <div style={{ padding: "14px 22px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {QUICK.map((q) => <button key={q} className="qr" onClick={() => setDraft(q)}>{q}</button>)}
              </div>
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
            </>
          ) : (
            <div style={{ padding: "14px 22px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="small muted">
                It’s been more than 24 hours since {firstName(c)} last messaged, so WhatsApp only allows approved templates.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.keys(s.templates).map((t) => (
                  <button key={t} className="qr" title={s.templates[t]} onClick={() => act((d) => {
                    const dc = d.contacts.find((x) => x.id === c.id);
                    if (dc) sendTemplate(d, dc, t, "You");
                  })}>{t}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: "12px 22px 22px" }}>
            <button
              className="link-btn faint"
              onClick={() => act((d) => receiveMessage(d, c.id, FAKE_REPLIES[msgs.length % FAKE_REPLIES.length]))}
            >
              Simulate a reply from {firstName(c)}
            </button>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="h h3" style={{ marginBottom: 6 }}>Appointments</h2>
            {appts.length === 0 && <div className="small faint">Nothing booked.</div>}
            {appts.map((a) => (
              <Link key={a.id} href={`/calendar?appt=${a.id}`} className="tl" style={{ textDecoration: "none", alignItems: "center" }}>
                <span className={`sw sw-${s.calendars.find((k) => k.id === a.calendarId)?.style}`} />
                <span style={{ flex: 1, textDecoration: a.status === "cancelled" ? "line-through" : undefined }}>
                  {s.calendars.find((k) => k.id === a.calendarId)?.name}, {dayTime(a.start)}
                </span>
                <span className="faint">{apptStatusLabel(a.status)}</span>
              </Link>
            ))}
          </section>

          <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h h3">Automations</h2>
            {runs.length === 0 && <div className="small faint">Nothing running for {firstName(c)}.</div>}
            {runs.map((r) => {
              const a = s.automations.find((x) => x.id === r.automationId)!;
              const next = a.steps[r.stepIndex] ? describeStep(a.steps[r.stepIndex], s.templates) : null;
              return (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <div className="strong">{a.name}</div>
                  <div className="small muted" style={{ lineHeight: 1.5 }}>
                    Waiting until {r.resumeAt ? dayTime(r.resumeAt) : "later"} ({r.resumeAt ? ago(r.resumeAt, now) : ""}).
                    {next ? ` Then: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}${next.detail ? ` (${next.detail})` : ""}.` : ""}
                  </div>
                  <div className="segs">
                    {a.steps.map((_, i) => <div key={i} className={i < r.stepIndex ? "on" : ""} />)}
                  </div>
                  <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => act((d) => stopRun(d, r.id))}>
                    Stop for {firstName(c)}
                  </button>
                </div>
              );
            })}
          </section>

          <section className="card pad">
            <h2 className="h h3" style={{ marginBottom: 8 }}>Timeline</h2>
            {timeline.map((e) => (
              <div key={e.id} className="tl">
                <div className="faint num" style={{ width: 64, flexShrink: 0 }}>{ago(e.at, now)}</div>
                <div className="muted">{e.detail}</div>
              </div>
            ))}
            {timeline.length === 0 && <div className="small faint">Nothing yet.</div>}
          </section>
        </div>
      </div>
    </>
  );
}
