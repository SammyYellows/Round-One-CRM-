"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { describeStep, firstName } from "@/lib/engine";
import { ago, dayTime, shortDate, time, toLocalInput } from "@/lib/format";
import { useStore } from "@/lib/store";
import { LOST_REASONS, STAGES, Stage, apptStatusLabel, sourceLabel, stageLabel } from "@/lib/types";

const STATUS: Record<string, string> = { queued: "Sending", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" };

const FAKE_REPLIES = ["Sounds good, see you then", "Can I bring a friend?", "What should I wear?", "Great, thanks"];

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const { s, now, act, live } = useStore();
  const [draft, setDraft] = useState("");
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
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
  const submitted = s.events.find((e) => e.contactId === id && e.type === "form.submitted");

  const send = () => {
    if (!draft.trim() || !windowOpen) return;
    act("sendMessage", c.id, draft);
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
          {c.stage === "booked" && (
            <button className="btn btn-ghost" onClick={() => act("markNoShow", c.id)}>Mark as no-show</button>
          )}
          {c.stage === "attended" && (
            <button className="btn btn-ghost" onClick={() => act("setStage", c.id, "nurture")}>Move to nurture</button>
          )}
          {c.stage === "sold_programme" && !c.tags.includes("did-not-convert") && (
            <button className="btn btn-ghost" onClick={() => act("addTag", c.id, "did-not-convert")} title="Sends the catch-up WhatsApp">
              Did not convert
            </button>
          )}
          {(c.stage === "attended" || c.stage === "nurture") && (
            <>
              <button className="btn btn-red" onClick={() => act("setStage", c.id, "sold_programme")}>Sold programme</button>
              <button className="btn btn-red" onClick={() => act("setStage", c.id, "sold_membership")}>Sold membership</button>
            </>
          )}
        </div>
      </header>

      <div className="grid cols-contact">
        <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="stage" className="label">Stage</label>
            <select
              id="stage"
              className="select"
              value={losing ? "lost" : c.stage}
              onChange={(e) => {
                const next = e.target.value as Stage;
                // Lost always needs a reason, so ask for one before moving.
                if (next === "lost") return setLosing(true);
                setLosing(false);
                act("setStage", c.id, next);
              }}
            >
              {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
            {c.stage === "lost" && c.lostReason && <div className="small muted" style={{ marginTop: 6 }}>Reason: {c.lostReason}</div>}
          </div>
          {losing && (
            <div>
              <label htmlFor="lost-reason" className="label">Why are they lost?</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select id="lost-reason" className="select" style={{ minWidth: 0 }} value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
                  {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  className="btn btn-red"
                  style={{ padding: "0 14px" }}
                  onClick={() => { act("setStage", c.id, "lost", { lostReason }); setLosing(false); }}
                >
                  Mark lost
                </button>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setLosing(false)}>Cancel</button>
            </div>
          )}
          <div>
            <label htmlFor="trial" className="label">{c.trialAt ? `Trial: ${dayTime(c.trialAt)}` : "Book a trial"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="trial" type="datetime-local" className="input" style={{ minWidth: 0 }} value={trialAt} onChange={(e) => setTrialAt(e.target.value)} />
              <button className="btn btn-red" style={{ padding: "0 14px" }} onClick={() => act("bookTrial", c.id, new Date(trialAt).toISOString())}>
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
            <div className="field"><dt>Added</dt><dd>{ago(c.createdAt, now)}</dd></div>
            {c.membership && (
              <div className="field">
                <dt>Coach</dt>
                <dd>
                  <select className="select" style={{ height: 36 }} aria-label="Coach" value={c.coachId ?? ""} onChange={(e) => act("setCoach", c.id, e.target.value)}>
                    <option value="">Nobody yet</option>
                    {s.staff.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </dd>
              </div>
            )}
            {c.activity && (
              <div className="field">
                <dt>Last in</dt>
                <dd>
                  {c.activity.lastSeenAt ? `${shortDate(c.activity.lastSeenAt)} · ${ago(c.activity.lastSeenAt, now)}` : "Not seen in 60 days"}
                  <div className="small faint">{c.activity.last30} session{c.activity.last30 === 1 ? "" : "s"} in 30 days, {c.activity.prev30} the 30 before{c.activity.alertedAt ? ` · coach told ${ago(c.activity.alertedAt, now)}` : ""}</div>
                </dd>
              </div>
            )}
          </dl>
          {c.membership && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>Membership (TeamUp)</div>
              <div className="strong">{c.membership.name}</div>
              <div className="small muted">
                {c.membership.category} · {c.membership.status === "active" ? "Active" : c.membership.status === "on_hold" ? "On hold" : "Ended"}{c.membership.cancelling && c.membership.status !== "ended" ? " · gave notice" : ""}{(c.membership.paymentRetries ?? 0) > 0 ? ` · ${c.membership.paymentRetries} failed payment attempt${c.membership.paymentRetries === 1 ? "" : "s"}` : ""}{c.membership.owed ? ` · owes ${c.membership.owed.total.toFixed(2).replace(/^/, "£")}` : ""}
                {c.membership.startedAt ? ` · since ${shortDate(c.membership.startedAt)}` : ""}
                {c.membership.endsAt ? ` · ${c.membership.status === "ended" ? "ended" : "ends or renews"} ${shortDate(c.membership.endsAt)}` : ""}
              </div>
              <div className="small faint">Change it in TeamUp; synced {ago(c.membership.syncedAt, now)}.</div>
            </div>
          )}
          {c.accountability && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>Accountability</div>
              <div className="strong">{c.accountability.active ? `${c.accountability.floor === 1 ? "Once" : c.accountability.floor === 2 ? "Twice" : `${c.accountability.floor} times`} a week, stretch ${c.accountability.stretch}` : "Left the programme"}</div>
              {c.accountability.active && (
                <div className="small muted">
                  {c.accountability.style === "straight" ? "Straight talk" : c.accountability.style === "facts" ? "Just the facts" : "Encouragement"} · check-in {c.accountability.slot} · since {shortDate(c.accountability.joinedAt)}
                  {c.accountability.why ? <><br />“{c.accountability.why}”</> : null}
                </div>
              )}
              {c.accountability.active && <button className="link-btn faint" style={{ alignSelf: "flex-start" }} onClick={() => { if (confirm(`Take ${firstName(c)} off the accountability programme?`)) act("leaveAccountability", c.id, "staff"); }}>End their place on the programme</button>}
            </div>
          )}
          {c.membership?.status === "active" && !c.accountability?.active && (
            <div className="small" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <button className="link-btn" onClick={() => { const url = `${window.location.origin}/f/accountability?c=${c.id}`; navigator.clipboard?.writeText(url).then(() => alert("Link copied. Send it to them to join the accountability programme.")).catch(() => window.prompt("Copy this link", url)); }}>Copy their accountability invite link</button>
            </div>
          )}
          {c.teamup && !c.membership && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>TeamUp</div>
              <div className="strong">Never had a membership</div>
              <div className="small muted">
                Came in {c.teamup.createdAt ? shortDate(c.teamup.createdAt) : "–"}
                {c.teamup.status ? ` · TeamUp says ${c.teamup.status.replace(/_/g, " ")}` : ""}
              </div>
            </div>
          )}
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <input type="checkbox" checked={!!c.marketingOptOut} onChange={(e) => act("setMarketingOptOut", c.id, e.target.checked)} />
            No marketing messages{c.marketingOptOut ? "" : " (they can reply STOP to set this)"}
          </label>
          {c.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.tags.map((t) => <span key={t} className={`chip ${t === "no-show" ? "chip-red" : ""}`}>{t}</span>)}
            </div>
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {c.answers.length > 0 && (
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="eyebrow">{submitted ? `Answered ${ago(submitted.at, now)}` : "From the form"}</div>
                  <h2 className="h h3">Questionnaire</h2>
                </div>
              </div>
              <dl className="qa">
                {c.answers.map((a) => (
                  <div key={a.question} className="qa-row">
                    <dt>{a.question}</dt>
                    <dd className={a.answer ? "" : "faint"}>{a.answer || "Skipped"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {c.insight?.summary && (
            <section className="card" style={{ borderLeft: "3px solid var(--red)" }}>
              <div className="card-head">
                <div>
                  <div className="eyebrow">What they’ve told us · read from {c.insight.fromMessages} message{c.insight.fromMessages === 1 ? "" : "s"}, {ago(c.insight.updatedAt, now)}</div>
                  <h2 className="h h3">In their words</h2>
                </div>
              </div>
              <div className="pad" style={{ paddingTop: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{c.insight.summary}</div>
              {c.insight.suggestedReply && !c.insight.replyUsedAt && !c.insight.replyDismissedAt && (
                <div style={{ margin: "0 22px 18px", padding: "12px 14px", background: "var(--char)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="label" style={{ margin: 0 }}>Suggested reply · nothing goes until you send it</div>
                  <div className="small" style={{ whiteSpace: "pre-wrap" }}>{c.insight.suggestedReply}</div>
                  <div className="actions" style={{ gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" disabled={!windowOpen} title={windowOpen ? "Puts it in the message box to edit and send" : "Their 24-hour reply window has closed; only templates can go"} onClick={() => { setDraft(c.insight!.suggestedReply!); act("settleInsightReply", c.id, true); }}>Use it</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => act("settleInsightReply", c.id, false)}>No reply needed</button>
                    {!windowOpen && <span className="small faint">Reply window closed.</span>}
                  </div>
                </div>
              )}
            </section>
          )}
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
            </>
          ) : (
            <div style={{ padding: "14px 22px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="small muted">
                It’s been more than 24 hours since {firstName(c)} last messaged, so WhatsApp only allows approved templates.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.keys(s.templates).map((t) => (
                  <button key={t} className="qr" title={s.templates[t]} onClick={() => act("sendTemplateTo", c.id, t)}>{t}</button>
                ))}
              </div>
              <QuickReplies />
            </div>
          )}
          {!live && (
            <div style={{ padding: "12px 22px 22px" }}>
              <button
                className="link-btn faint"
                onClick={() => act("receiveMessage", c.id, FAKE_REPLIES[msgs.length % FAKE_REPLIES.length])}
              >
                Simulate a reply from {firstName(c)}
              </button>
            </div>
          )}
        </section>

        </div>

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
                  <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => act("stopRun", r.id)}>
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
