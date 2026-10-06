"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ago, dayTime, shortDate } from "@/lib/format";
import { useStore } from "@/lib/store";

// Everyone who has given notice to cancel in TeamUp, when, when their
// membership runs out, and what happened with the win-back email
// (Sammy, 06/10/2026). The sync records the notice; the "Gave notice –
// win-back" automation sends the email a day later when it's switched on.

const WIN_BACK = "win_back";
type Window = "30" | "90" | "365" | "all";
const day = shortDate;

export default function CancellationsPage() {
  const { s, now, act } = useStore();
  const [window, setWindow] = useState<Window>("all");
  const [includeEnded, setIncludeEnded] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;
  useEffect(() => setPage(1), [window, includeEnded]);

  const automation = s.automations.find((a) => a.id === WIN_BACK);
  const emailIndex = automation?.steps.findIndex((st) => st.kind === "email") ?? -1;
  const emailStep = emailIndex >= 0 ? automation!.steps[emailIndex] : undefined;
  const waitHours = automation?.steps.find((st) => st.kind === "wait")?.kind === "wait" ? (automation!.steps.find((st) => st.kind === "wait") as { hours: number }).hours : 24;

  // The email's wording, edited and approved here.
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [drafts, setDrafts] = useState<{ id: string; name: string; subject: string; body: string; savedAt: string; savedBy: string }[]>([]);
  const [draftId, setDraftId] = useState<string>("");
  const [draftName, setDraftName] = useState("");
  useEffect(() => {
    fetch("/api/winback", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { drafts: [] })).then((j) => setDrafts(j.drafts ?? [])).catch(() => undefined);
  }, []);
  const api = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/winback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { ok: res.ok, ...((await res.json().catch(() => ({}))) as Record<string, unknown>) } as { ok: boolean; error?: string; drafts?: typeof drafts; subject?: string; body?: string };
  };
  const loadDraft = (id: string) => {
    setDraftId(id);
    const d = drafts.find((x) => x.id === id);
    if (d) { setSubject(d.subject); setBody(d.body); setDraftName(d.name); setConfirming(false); setNote(`Loaded “${d.name}”. It isn’t live until you save the wording or approve it.`); }
  };
  const saveDraft = async (asNew: boolean) => {
    const name = draftName.trim();
    if (!name) { setNote("Give the draft a name first."); return; }
    setBusy("draft");
    const r = await api({ action: "save", id: asNew ? undefined : draftId || undefined, name, subject, body });
    setBusy(null);
    if (!r.ok) { setNote(r.error ?? "Couldn’t save the draft"); return; }
    setDrafts(r.drafts ?? []);
    const saved = (r.drafts ?? []).find((d) => d.name === name && d.subject === subject && d.body === body);
    if (saved) setDraftId(saved.id);
    setNote(`Saved as “${name}”.`);
  };
  const deleteDraft = async () => {
    if (!draftId || !confirm("Delete this saved draft?")) return;
    const r = await api({ action: "delete", id: draftId });
    if (r.ok) { setDrafts(r.drafts ?? []); setDraftId(""); setDraftName(""); setNote("Draft deleted."); }
  };
  const rewrite = async () => {
    if (!instruction.trim()) return;
    setBusy("rewrite");
    const r = await api({ action: "rewrite", subject, body, instruction });
    setBusy(null);
    if (!r.ok || !r.body) { setNote(r.error ?? "Couldn’t rewrite"); return; }
    setSubject(r.subject ?? subject); setBody(r.body); setInstruction(""); setConfirming(false);
    setNote("Rewritten. Read it through, then save it as a draft or save the wording.");
  };
  useEffect(() => {
    if (emailStep?.kind === "email") { setSubject(emailStep.subject); setBody(emailStep.body ?? ""); }
  }, [emailStep?.kind === "email" ? emailStep.subject : "", emailStep?.kind === "email" ? emailStep.body : ""]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = emailStep?.kind === "email" && (subject !== emailStep.subject || body !== (emailStep.body ?? ""));
  const saveWording = () => { act("setEmailStep", WIN_BACK, emailIndex, subject, body); setNote("Wording saved."); };
  const switchOn = () => { if (dirty) act("setEmailStep", WIN_BACK, emailIndex, subject, body); act("toggleAutomation", WIN_BACK); setConfirming(false); setNote("Switched on. From the next notice recorded, the email goes a day later."); };
  const switchOff = () => { act("toggleAutomation", WIN_BACK); setNote("Switched off. Nothing more will be sent."); };

  const rows = useMemo(() => {
    // The notice is logged on the contact's timeline when the sync first sees it.
    const noticeAt = new Map<string, string>();
    for (const e of s.events) {
      if (e.type === "stage.changed" && e.contactId && / gave notice on /.test(e.detail) && !noticeAt.has(e.contactId)) noticeAt.set(e.contactId, e.at);
    }
    const emailAt = new Map<string, string>();
    for (const e of s.events) {
      if (e.type === "email.sent" && e.contactId && e.detail.startsWith("Sorry to see you go") && !emailAt.has(e.contactId)) emailAt.set(e.contactId, e.at);
    }
    return s.contacts
      // Serving notice now, a notice the sync recorded, or (when included)
      // cancellations that have already run out.
      .filter((c) => c.membership && (noticeAt.has(c.id) || (c.membership.cancelling && (includeEnded || c.membership.status !== "ended"))))
      .map((c) => {
        const m = c.membership!;
        const run = s.runs.filter((r) => r.contactId === c.id && r.automationId === WIN_BACK).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
        const sentAt = emailAt.get(c.id);
        let email: { label: string; tone: "sent" | "waiting" | "none" };
        if (sentAt) email = { label: `Sent ${day(sentAt)}`, tone: "sent" };
        else if (run?.status === "waiting" && run.resumeAt) email = { label: `Goes ${dayTime(run.resumeAt)}`, tone: "waiting" };
        else if (run?.status === "stopped") email = { label: "Stopped", tone: "none" };
        else if (c.marketingOptOut) email = { label: "Not sent: opted out", tone: "none" };
        else if (!c.email) email = { label: "Not sent: no email", tone: "none" };
        else if (!noticeAt.has(c.id)) email = { label: "Not sent: notice given before tracking began", tone: "none" };
        else email = { label: automation?.enabled ? "Not sent" : "Not sent: automation off", tone: "none" };
        return { c, m, noticeAt: noticeAt.get(c.id), email };
      })
      .filter((r) => window === "all" || (r.noticeAt ? now - Date.parse(r.noticeAt) <= Number(window) * 86400e3 : false))
      // Recorded notices newest first, then people still serving notice (soonest to end first), then ended ones (most recent first).
      .sort((a, b) => {
        const grp = (r: typeof a) => (r.noticeAt ? 0 : r.m.status !== "ended" ? 1 : 2);
        if (grp(a) !== grp(b)) return grp(a) - grp(b);
        if (grp(a) === 0) return Date.parse(b.noticeAt!) - Date.parse(a.noticeAt!);
        const ea = a.m.endsAt ? Date.parse(a.m.endsAt) : 0, eb = b.m.endsAt ? Date.parse(b.m.endsAt) : 0;
        return grp(a) === 1 ? ea - eb : eb - ea;
      });
  }, [s, now, window, automation, includeEnded]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const sent = rows.filter((r) => r.email.tone === "sent").length;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{rows.length} gave notice · {sent} win-back email{sent === 1 ? "" : "s"} sent · automation {automation?.enabled ? "on" : "off"}</div>
          <h1 className="h h1">Cancellations</h1>
        </div>
        <Link className="btn btn-ghost" href="/automations">All automations</Link>
      </header>

      {automation && emailStep?.kind === "email" && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">{automation.enabled ? "On · goes the day after notice is recorded" : "Off · nothing is sent until you approve it"}</div>
              <h2 className="h h3">The win-back email</h2>
            </div>
            <span className={`chip ${automation.enabled ? "chip-red" : ""}`}>{automation.enabled ? "On" : "Off"}</span>
          </div>
          <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label className="label" htmlFor="wb-draft">Saved drafts</label>
                <select id="wb-draft" className="select" value={draftId} onChange={(e) => loadDraft(e.target.value)}>
                  <option value="">{drafts.length ? "Pick a saved draft to load" : "No saved drafts yet"}</option>
                  {drafts.map((d) => <option key={d.id} value={d.id}>{d.name} · {new Date(d.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <label className="label" htmlFor="wb-name">Draft name</label>
                <input id="wb-name" className="input" value={draftName} placeholder="e.g. Friendly short version" onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <button className="btn btn-ghost" disabled={busy !== null || !draftName.trim()} onClick={() => saveDraft(!draftId || drafts.find((d) => d.id === draftId)?.name !== draftName.trim())}>{busy === "draft" ? "Saving" : draftId && drafts.find((d) => d.id === draftId)?.name === draftName.trim() ? "Update draft" : "Save as draft"}</button>
              {draftId && <button className="btn btn-ghost" disabled={busy !== null} onClick={deleteDraft}>Delete draft</button>}
            </div>
            <div>
              <label className="label" htmlFor="wb-subject">Subject</label>
              <input id="wb-subject" className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setConfirming(false); }} />
            </div>
            <div>
              <label className="label" htmlFor="wb-body">Message</label>
              <textarea id="wb-body" className="input enq-text" rows={12} value={body} onChange={(e) => { setBody(e.target.value); setConfirming(false); }} />
              <div className="small faint" style={{ marginTop: 6 }}>Goes from info@round1boxfit.co.uk {waitHours} hours after a notice is recorded. You can use {"{first} {name} {gym} {team}"}. An unsubscribe line is added at the bottom; anyone opted out is skipped. Replies come into Enquiries.</div>
            </div>
            <div>
              <label className="label" htmlFor="wb-instruction">Ask the AI to change it</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="wb-instruction" className="input" style={{ minWidth: 0 }} value={instruction} placeholder="e.g. Warmer, shorter, and offer a chat with a coach"
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && instruction.trim() && busy === null) rewrite(); }}
                />
                <button className="btn btn-ghost" style={{ padding: "0 14px" }} disabled={busy !== null || !instruction.trim()} onClick={rewrite}>{busy === "rewrite" ? "Rewriting" : "Rewrite"}</button>
              </div>
              <div className="small faint" style={{ marginTop: 6 }}>The AI keeps the placeholders ({"{first}"} and so on) in place. The result lands in the boxes above; nothing changes until you save or approve.</div>
            </div>
            {note && <div className="small muted" aria-live="polite">{note}</div>}
            {!confirming ? (
              <div className="actions" style={{ gap: 10, flexWrap: "wrap" }}>
                {automation.enabled ? (
                  <>
                    <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Save wording</button>
                    <button className="btn btn-ghost" onClick={switchOff}>Switch off</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-red" disabled={!subject.trim() || !body.trim()} onClick={() => setConfirming(true)}>Approve and switch on</button>
                    <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Save wording</button>
                  </>
                )}
              </div>
            ) : (
              <div className="enq-confirm" role="alertdialog" aria-labelledby="wb-confirm-h">
                <div id="wb-confirm-h" className="strong">Switch the win-back email on?</div>
                <div className="small muted">From the next notice the sync records, this email goes to that person {waitHours} hours later, with the wording above. Nobody already serving notice gets it. You can switch it off here any time.</div>
                <div className="actions" style={{ gap: 10 }}>
                  <button className="btn btn-red" onClick={switchOn}>Yes, switch it on</button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="filters" role="search">
        <div className="filters-row">
          <select className="select" style={{ maxWidth: 260 }} aria-label="Gave notice within" value={window} onChange={(e) => setWindow(e.target.value as Window)}>
            <option value="30">Gave notice in the last 30 days</option>
            <option value="90">Gave notice in the last 3 months</option>
            <option value="365">Gave notice in the last year</option>
            <option value="all">Any time (including notices given before tracking began)</option>
          </select>
          <button className={`fchip fchip-sm ${includeEnded ? "on" : ""}`} aria-pressed={includeEnded} onClick={() => setIncludeEnded((v) => !v)}>Include memberships already ended</button>
          <span className="small muted" style={{ marginLeft: "auto" }} aria-live="polite">
            {rows.length} {rows.length === 1 ? "person" : "people"}{pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0 }}>
          <div>Name</div><div>Membership</div><div>Gave notice</div><div>Membership ends</div><div>Win-back email</div><div>Marketing</div>
        </div>
        {shown.map(({ c, m, noticeAt, email }) => (
          <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{c.name}</div>
              <div className="faint num" style={{ fontSize: 12 }}>{c.email || c.phone || "no contact details"}</div>
            </div>
            <div><div>{m.name}</div><div className="muted small">{m.category}</div></div>
            <div className="muted small">{noticeAt ? `${day(noticeAt)} · ${ago(noticeAt, now)}` : "Before 6 Oct 2026"}</div>
            <div className="muted small">{m.status === "ended" ? `Ended${m.endsAt ? ` ${day(m.endsAt)}` : ""}` : m.endsAt ? `${day(m.endsAt)} (${ago(m.endsAt, now)})` : "–"}</div>
            <div>
              <span className={`chip ${email.tone === "sent" ? "chip-red" : email.tone === "waiting" ? "chip-light" : ""}`} style={{ height: 22, fontSize: 10, whiteSpace: "normal", textAlign: "left" }}>{email.label}</span>
            </div>
            <div className="small">{c.marketingOptOut ? "Opted out" : "OK"}</div>
          </Link>
        ))}
        {rows.length === 0 && <div className="empty">Nobody has given notice in this period. Notices given before tracking began (6 Oct 2026) show under “Any time”.</div>}
        {pages > 1 && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="small muted">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, rows.length)} of {rows.length}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </section>
    </>
  );
}
