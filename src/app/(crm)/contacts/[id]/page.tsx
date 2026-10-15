"use client";

import Link from "next/link";
import { ClassPassChip } from "@/components/ClassPassChip";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { describeStep, firstName } from "@/lib/engine";
import { ago, dayTime, shortDate, time, toLocalInput } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CHANNELS, Channel, LOST_REASONS, ON_PIPELINE, STAGES, Stage, apptStatusLabel, channelOf, sourceLabel, stageLabel, teamupCustomerUrl } from "@/lib/types";
import { PRIORITY_LABEL, inactivityAdvice } from "@/lib/inactivity";
import { useIsManager } from "@/components/StaffContext";
import { MessageThread, replyWindow } from "@/components/MessageThread";


export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const { s, now, act, live, removed } = useStore();
  const manager = useIsManager();
  const [removing, setRemoving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [trialAt, setTrialAt] = useState(() => {
    const d = new Date(now + 86400e3);
    d.setHours(18, 0, 0, 0);
    return toLocalInput(d.getTime());
  });
  const [inactiveDaysSetting, setInactiveDaysSetting] = useState(20);
  useEffect(() => { if (live) fetch("/api/members/inactivity", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.days) setInactiveDaysSetting(j.days); }).catch(() => undefined); }, [live]);

  const c = s.contacts.find((x) => x.id === id);
  const msgs = s.messages.filter((m) => m.contactId === id);
  const advice = c ? inactivityAdvice(c, now, inactiveDaysSetting) : null;


  const gone = c ? undefined : removed.find((x) => x.id === id);
  if (gone) {
    return (
      <>
        <header className="page-head">
          <div>
            <div className="eyebrow"><Link href="/contacts" style={{ color: "var(--muted)" }}>Contacts</Link> / Removed</div>
            <h1 className="h h1">{gone.name}</h1>
          </div>
        </header>
        <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <p style={{ margin: 0 }}>{gone.removed!.by} removed {gone.name} from the CRM {ago(gone.removed!.at, now)} ({shortDate(gone.removed!.at)}). They don’t show anywhere and nothing is sent to them. If they fill in the form or book a trial again, they come back by themselves.</p>
          <div className="small muted">{[gone.email, gone.phone].filter(Boolean).join(" · ") || "No contact details"}</div>
          {manager && <button className="btn btn-red" onClick={() => act("restoreContact", gone.id)}>Put back</button>}
        </div>
      </>
    );
  }

  if (!c) {
    return (
      <div className="card pad">
        <p>We can’t find that contact.</p>
        <Link href="/contacts">Back to contacts</Link>
      </div>
    );
  }

  // Their conversations: WhatsApp unless they've only messaged on Facebook or
  // Instagram, plus each of those they've used (14/10/2026). A suggested reply
  // goes in the box for wherever they last messaged.
  const used = (ch: Channel) => msgs.some((m) => channelOf(m) === ch) || (ch === "facebook" ? !!c.social?.facebookId : ch === "instagram" ? !!c.social?.instagramId : !!c.phone);
  const threads = CHANNELS.filter(used);
  if (!threads.length) threads.push("whatsapp");
  const lastInChannel = msgs.filter((m) => m.dir === "in").at(-1);
  const primary: Channel = lastInChannel ? channelOf(lastInChannel) : threads[0];
  // Meta only allows free-text replies for a while after their last message.
  const windowOpen = replyWindow(c.id, msgs, now, primary).open;

  const runs = s.runs.filter((r) => r.contactId === id && r.status === "waiting");
  const appts = s.appointments.filter((a) => a.contactId === id).sort((a, b) => Date.parse(b.start) - Date.parse(a.start)).slice(0, 6);
  const timeline = s.events.filter((e) => e.contactId === id).slice(0, 12);
  const submitted = s.events.find((e) => e.contactId === id && e.type === "form.submitted");

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link href="/pipeline" style={{ color: "var(--muted)" }}>Pipeline</Link> / {stageLabel(c.stage)}</div>
          <h1 className="h h1">{c.name}</h1>
          <div style={{ marginLeft: -6 }}><ClassPassChip email={c.email} /></div>
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
          {c.source === "email" && !c.tags.includes(ON_PIPELINE) && (
            <button className="btn btn-ghost" onClick={() => act("addTag", c.id, ON_PIPELINE)} title="Email enquiries stay off the Meta pipeline unless you put them on">Put on pipeline</button>
          )}
          {manager && !removing && <button className="btn btn-ghost" onClick={() => setRemoving(true)}>Remove</button>}
        </div>
      </header>

      {removing && (
        <div className="enq-confirm" role="alertdialog" aria-label={`Remove ${c.name}`}>
          <div><strong>Remove {c.name} from the CRM?</strong> They’ll disappear from the pipeline, contacts and every list, their automations stop, any trial still to come is cancelled without a message, and nothing is sent to them. Their history is kept and you can put them back from Contacts → Removed.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-red btn-sm" onClick={() => { act("removeContact", c.id); setRemoving(false); }}>Remove</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRemoving(false)}>Keep them</button>
          </div>
        </div>
      )}

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
            <div className="field"><dt>Source</dt><dd>{sourceLabel(c.source)}<ClassPassChip email={c.email} /></dd></div>
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
          {advice && (
            <div className="answers-strip" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`chip ${advice.priority === "high" ? "chip-red" : advice.priority === "medium" ? "chip-light" : ""}`} style={{ height: 20, fontSize: 10 }}>{PRIORITY_LABEL[advice.priority]} priority</span>
                <span className="small strong">{advice.reason}</span>
              </div>
              <div className="small">{advice.action}</div>
              <div className="small faint">Suggested for staff only; nothing is sent to {firstName(c)} by the CRM.</div>
            </div>
          )}
          {c.safety && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>Safety (TeamUp)</div>
              <div className="strong">
                {c.safety.waiverSignedAt ? `Waiver signed ${shortDate(c.safety.waiverSignedAt)}` : <span style={{ color: "var(--red)" }}>No waiver signed</span>}
                {c.safety.waiverName && c.safety.waiverSignedAt ? <span className="muted small"> · {c.safety.waiverName}</span> : null}
              </div>
              <div className="small">
                {c.safety.emergencyName || c.safety.emergencyPhone
                  ? <>Emergency contact: {c.safety.emergencyName ?? "–"}{c.safety.emergencyRelationship ? ` (${c.safety.emergencyRelationship})` : ""}{c.safety.emergencyPhone ? <> · <a className="num" href={`tel:${c.safety.emergencyPhone}`}>{c.safety.emergencyPhone}</a></> : ""}</>
                  : <span style={{ color: "var(--red)" }}>No emergency contact on file</span>}
                {c.safety.dateOfBirth ? <span className="muted"> · born {shortDate(c.safety.dateOfBirth)}</span> : null}
              </div>
              <div className="small faint">Fix it in TeamUp (their profile → forms and waivers); synced {ago(c.safety.syncedAt, now)}.</div>
            </div>
          )}
          {c.membership && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>Membership (TeamUp)</div>
              <div className="strong">{c.membership.name}</div>
              <div className="small muted">
                {c.membership.category} · {c.membership.status === "active" ? "Active" : c.membership.status === "on_hold" ? "On hold" : "Ended"}{c.membership.cancelling && c.membership.status !== "ended" ? " · gave notice" : ""}{(c.membership.paymentRetries ?? 0) > 0 ? ` · ${c.membership.paymentRetries} failed payment attempt${c.membership.paymentRetries === 1 ? "" : "s"}` : ""}{c.membership.owed ? ` · owes ${c.membership.owed.total.toFixed(2).replace(/^/, "£")}` : ""}{c.teamup?.blocked ? " · blocked in TeamUp" : ""}
                {c.membership.startedAt ? ` · since ${shortDate(c.membership.startedAt)}` : ""}
                {c.membership.endsAt ? ` · ${c.membership.status === "ended" ? "ended" : "ends or renews"} ${shortDate(c.membership.endsAt)}` : ""}
              </div>
              <div className="small faint">Change it in TeamUp; synced {ago(c.membership.syncedAt, now)}.</div>
              <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }} href={teamupCustomerUrl(c.teamup?.customerId ?? c.membership.customerId)} target="_blank" rel="noreferrer">Open in TeamUp</a>
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
          {c.answers.length > 0 ? (
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
          ) : (
            <section className="card pad" style={{ borderLeft: "3px solid var(--line)" }}>
              <h2 className="h h3" style={{ marginBottom: 6 }}>Questionnaire</h2>
              <div className="strong">No questionnaire answers</div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {c.gymgrow ? "Imported from GymGrow, which didn’t include their answers. Ask them at the intro meeting."
                  : c.source === "teamup" ? "Signed up straight in TeamUp, so they never filled in the questionnaire."
                  : c.source === "email" ? "Came in by email, so they never filled in the questionnaire."
                  : c.source === "whatsapp" ? "Messaged us on WhatsApp first, so they never filled in the questionnaire."
                  : c.source === "facebook" ? "Messaged us on Facebook first, so they never filled in the questionnaire."
                  : c.source === "instagram" ? "Messaged us on Instagram first, so they never filled in the questionnaire."
                  : "They haven’t filled in the questionnaire. Ask them at the intro meeting, or send them the form."}
              </div>
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
                    <button className="btn btn-ghost btn-sm" disabled={!windowOpen} title={windowOpen ? "Puts it in the message box to edit and send" : "Their reply window has closed"} onClick={() => { setDraft(c.insight!.suggestedReply!); act("settleInsightReply", c.id, true); }}>Use it</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => act("settleInsightReply", c.id, false)}>No reply needed</button>
                    {!windowOpen && <span className="small faint">Reply window closed.</span>}
                  </div>
                </div>
              )}
            </section>
          )}
        <section className="card">
          <div className="card-head">
            <h2 className="h h3">Notes</h2>
            <span className="small muted">{c.notes?.length ? `${c.notes.length} note${c.notes.length === 1 ? "" : "s"}` : "For staff only"}</span>
          </div>
          <form className="pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!noteDraft.trim()) return; act("addNote", c.id, noteDraft); setNoteDraft(""); }}>
            <label htmlFor="note" className="sr-only">Add a note</label>
            <textarea id="note" className="input" rows={2} style={{ height: "auto", paddingTop: 10, resize: "vertical" }} placeholder="Add a note: a call, what they said at the desk, anything the team should know" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={4000} />
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={!noteDraft.trim()}>Add note</button>
          </form>
          {(c.notes ?? []).map((n) => (
            <div key={n.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4, paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{n.text}</div>
              <div className="faint" style={{ fontSize: 12 }}>{n.by} · {ago(n.at, now)}</div>
            </div>
          ))}
        </section>

        {threads.map((ch) => ch === primary
          ? <MessageThread key={ch} contactId={c.id} channel={ch} draft={draft} setDraft={setDraft} />
          : <MessageThread key={ch} contactId={c.id} channel={ch} />)}

        {live && <EarlierMessages contactId={c.id} />}
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

type Earlier = { id: string; channel: "whatsapp" | "sms" | "email" | "call"; dir: "in" | "out"; subject: string | null; body: string; status: string | null; at: string };
const CHANNEL_LABEL: Record<Earlier["channel"], string> = { whatsapp: "WhatsApp", sms: "Text", email: "Email", call: "Call" };

/** Their messages from GymGrow, before the switch (Sammy, 12/10/2026). History only: loaded from /api/contacts/<id>/history, never sent, never "waiting". */
function EarlierMessages({ contactId }: { contactId: string }) {
  const [rows, setRows] = useState<Earlier[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setRows(null);
    fetch(`/api/contacts/${contactId}/history`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { messages: [] })).then((j) => setRows(j.messages ?? [])).catch(() => setRows([]));
  }, [contactId]);
  if (!rows || rows.length === 0) return null;
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">From GymGrow, before the switch · {rows.length} message{rows.length === 1 ? "" : "s"}</div>
          <h2 className="h h3">Earlier messages</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div className="pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
          {rows.map((m) => (
            <div key={m.id} style={{ alignSelf: m.dir === "in" ? "flex-start" : "flex-end", maxWidth: "85%", padding: "10px 12px", background: m.dir === "in" ? "var(--well)" : "var(--char)", borderLeft: m.dir === "in" ? "3px solid var(--line)" : undefined, fontSize: 13, lineHeight: 1.5 }}>
              <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>
                {CHANNEL_LABEL[m.channel]} · {m.dir === "in" ? "from them" : "from Round One"} · {shortDate(m.at)} {time(m.at)}{m.status === "failed" ? " · not delivered" : ""}
              </div>
              {m.subject && <div className="strong" style={{ marginBottom: 4 }}>{m.subject}</div>}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.body || (m.channel === "call" ? "Phone call" : "(no text)")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

