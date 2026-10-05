"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";
import { STAGES, Stage } from "@/lib/types";

// One email to many people: members, ex-members and old leads picked from the
// CRM. Nothing sends until Send is pressed and the count confirmed
// (docs/mailouts.md).

interface Audience { membership: "any" | "active" | "ended" | "none"; categories: string[]; endedWithinDays?: number; leadStages: Stage[] }
type Counts = { total: number; queued: number; sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number; failed: number };
interface Mailout { id: string; subject: string; body: string; audience: Audience; status: "draft" | "sending" | "sent"; createdAt: string; createdBy: string | null; startedAt: string | null; finishedAt: string | null; counts: Counts }

const LEAD_STAGES = STAGES.filter((s) => !["sold_programme", "sold_membership"].includes(s.id));
const PLACEHOLDERS = "{first} {name} {gym} {team} {address} {unsubscribe}";

const describeAudience = (a: Audience) => {
  const parts: string[] = [];
  if (a.membership !== "none") {
    const who = a.membership === "active" ? "Current members" : a.membership === "ended" ? "Ex-members" : "Current and ex-members";
    parts.push(`${who}${a.categories.length ? ` (${a.categories.join(", ")})` : ""}${a.membership !== "active" && a.endedWithinDays ? `, ended within ${a.endedWithinDays} days` : ""}`);
  }
  if (a.leadStages.length) parts.push(`Leads: ${a.leadStages.map((s) => STAGES.find((x) => x.id === s)?.label ?? s).join(", ")}`);
  return parts.join(" · ") || "Nobody picked yet";
};

export default function MailoutsPage() {
  const { now, live } = useStore();
  const [list, setList] = useState<Mailout[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [setup, setSetup] = useState<{ dailyLimit: number | null; sending: boolean }>({ dailyLimit: null, sending: false });
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>({ membership: "active", categories: [], leadStages: [] });
  const [count, setCount] = useState<{ count: number; sample: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/mailouts", { cache: "no-store" });
    if (!res.ok) { setList([]); return; }
    const j = (await res.json()) as { mailouts: Mailout[]; categories: string[]; dailyLimit: number | null; sending: boolean };
    setList(j.mailouts); setCategories(j.categories); setSetup({ dailyLimit: j.dailyLimit, sending: j.sending });
  }, []);
  useEffect(() => { if (live) load(); else setList([]); }, [live, load]);

  // Keep a sending mailout's numbers fresh.
  useEffect(() => {
    if (!live || !list?.some((m) => m.status === "sending")) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [live, list, load]);

  const current = useMemo(() => list?.find((m) => m.id === selected) ?? null, [list, selected]);
  useEffect(() => {
    if (!current) return;
    setSubject(current.subject); setBody(current.body); setAudience(current.audience); setConfirming(false); setNote(null);
  }, [current]);

  // Live count of who the audience reaches.
  useEffect(() => {
    if (!live || !current || current.status !== "draft") { setCount(null); return; }
    let gone = false;
    const t = setTimeout(async () => {
      const res = await fetch("/api/mailouts/count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(audience) });
      if (!gone && res.ok) setCount(await res.json());
    }, 300);
    return () => { gone = true; clearTimeout(t); };
  }, [audience, current, live]);

  const dirty = !!current && current.status === "draft" && (subject !== current.subject || body !== current.body || JSON.stringify(audience) !== JSON.stringify(current.audience));

  async function newMailout() {
    setBusy("new");
    const res = await fetch("/api/mailouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "", body: `Hi {first},\n\n\n\n${"{team}"}`, audience: { membership: "active", categories: [], leadStages: [] } }) });
    const j = (await res.json()) as { id: string };
    await load(); setSelected(j.id); setBusy(null);
  }
  async function save() {
    if (!current) return;
    setBusy("save");
    await fetch(`/api/mailouts/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body, audience }) });
    await load(); setBusy(null);
  }
  async function remove() {
    if (!current || !confirm("Delete this draft?")) return;
    await fetch(`/api/mailouts/${current.id}`, { method: "DELETE" });
    setSelected(null); await load();
  }
  async function test() {
    if (!current) return;
    if (dirty) await save();
    setBusy("test");
    const res = await fetch(`/api/mailouts/${current.id}/test`, { method: "POST" });
    const j = (await res.json()) as { ok: boolean; to?: string; asIf?: string; dryRun?: boolean; error?: string };
    setBusy(null);
    setNote(j.ok ? `Test sent to ${j.to}${j.asIf ? `, filled in as if for ${j.asIf}` : ""}${j.dryRun ? " (email isn’t switched on here)" : ""}` : j.error ?? "Couldn’t send the test");
  }
  async function send() {
    if (!current) return;
    if (dirty) await save();
    setBusy("send");
    const res = await fetch(`/api/mailouts/${current.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    const j = (await res.json()) as { ok: boolean; queued?: number; sent?: number; waitingForTomorrow?: boolean; error?: string };
    setConfirming(false); setBusy(null);
    if (!j.ok) { setNote(j.error ?? "Couldn’t send"); return; }
    setNote(`Queued ${j.queued}. ${j.sent ?? 0} sent straight away${j.waitingForTomorrow ? "; the rest go out from tomorrow" : (j.queued ?? 0) > (j.sent ?? 0) ? "; the rest follow every few minutes" : ""}.`);
    await load();
  }

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const drafts = (list ?? []).filter((m) => m.status === "draft");
  const done = (list ?? []).filter((m) => m.status !== "draft");

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{live ? `${done.length} sent · ${drafts.length} draft${drafts.length === 1 ? "" : "s"}` : "Live data only"}</div>
          <h1 className="h h1">Mailouts</h1>
        </div>
        <div className="actions">
          <button className="btn btn-red" disabled={!live || busy === "new"} onClick={newMailout}>New mailout</button>
        </div>
      </header>

      {live && (setup.dailyLimit || !setup.sending) && (
        <div className="card" style={{ padding: "14px 22px", marginBottom: 20 }}>
          <div className="small muted">
            {!setup.sending && "Email sending isn’t switched on here, so mailouts are only recorded. "}
            {setup.dailyLimit && `On Resend’s free plan: at most ${setup.dailyLimit} mailout emails a day. Bigger sends carry on each day until done. Upgrade to Resend Pro to lift this.`}
          </div>
        </div>
      )}

      <div className="mo">
        <section className="card">
          {list === null ? <div className="empty">Loading…</div> : list.length === 0 ? <div className="empty">No mailouts yet. Press New mailout to write one.</div> : (
            list.map((m) => (
              <button key={m.id} className={`mo-row ${selected === m.id ? "on" : ""}`} onClick={() => setSelected(m.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className="strong">{m.subject || "(no subject)"}</span>
                  <span className="faint small">{ago(m.startedAt ?? m.createdAt, now)}</span>
                </div>
                <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{describeAudience(m.audience)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {m.status === "draft" && <span className="chip">Draft</span>}
                  {m.status === "sending" && <span className="chip chip-light">Sending · {m.counts.total - m.counts.queued}/{m.counts.total}</span>}
                  {m.status === "sent" && <span className="chip chip-red">Sent to {m.counts.total}</span>}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="card">
          {!current ? <div className="empty">Pick a mailout on the left, or press New mailout.</div> : current.status !== "draft" ? (
            <>
              <div className="card-head">
                <div>
                  <div className="eyebrow">{current.status === "sending" ? "Sending" : "Sent"} {current.startedAt ? ago(current.startedAt, now) : ""}{current.createdBy ? ` by ${current.createdBy}` : ""}</div>
                  <h2 className="h h3" style={{ marginTop: 6 }}>{current.subject}</h2>
                  <div className="small muted" style={{ marginTop: 6 }}>{describeAudience(current.audience)}</div>
                </div>
              </div>
              <div className="mo-stats">
                {([["total", "People"], ["queued", "Waiting"], ["sent", "Sent"], ["delivered", "Delivered"], ["opened", "Opened"], ["clicked", "Clicked"], ["bounced", "Bounced"], ["complained", "Spam"], ["failed", "Failed"]] as [keyof Counts, string][])
                  .filter(([k]) => k === "total" || current.counts[k] > 0 || ["sent", "delivered", "opened"].includes(k))
                  .map(([k, label]) => (
                    <div key={k} className="mo-stat"><span className="num">{current.counts[k]}</span><span className="eyebrow">{label}</span></div>
                  ))}
              </div>
              <div className="enq-mail" style={{ marginBottom: 22 }}>{current.body}</div>
            </>
          ) : (
            <>
              <div className="card-head">
                <div>
                  <div className="eyebrow">Draft · {ago(current.createdAt, now)}</div>
                  <h2 className="h h3" style={{ marginTop: 6 }}>Who gets it</h2>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={remove}>Delete draft</button>
              </div>
              <div className="mo-aud">
                <div className="opts">
                  {([["active", "Current members"], ["ended", "Ex-members"], ["any", "Both"], ["none", "No members"]] as [Audience["membership"], string][]).map(([v, l]) => (
                    <button key={v} className={`fchip fchip-sm ${audience.membership === v ? "on" : ""}`} aria-pressed={audience.membership === v} onClick={() => setAudience({ ...audience, membership: v })}>{l}</button>
                  ))}
                </div>
                {audience.membership !== "none" && categories.length > 0 && (
                  <div>
                    <div className="label">Categories (none picked = all)</div>
                    <div className="opts">
                      {categories.map((c) => (
                        <button key={c} className={`fchip fchip-sm ${audience.categories.includes(c) ? "on" : ""}`} aria-pressed={audience.categories.includes(c)} onClick={() => setAudience({ ...audience, categories: toggle(audience.categories, c) })}>{c.replace(/ Memberships?$/, "")}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(audience.membership === "ended" || audience.membership === "any") && (
                  <div>
                    <label className="label" htmlFor="mo-ended">Ex-members whose membership ended within</label>
                    <select id="mo-ended" className="select" style={{ maxWidth: 260 }} value={audience.endedWithinDays ?? 0} onChange={(e) => setAudience({ ...audience, endedWithinDays: Number(e.target.value) || undefined })}>
                      <option value={0}>Any time</option>
                      <option value={90}>3 months</option>
                      <option value={180}>6 months</option>
                      <option value={365}>A year</option>
                      <option value={730}>Two years</option>
                    </select>
                  </div>
                )}
                <div>
                  <div className="label">Old leads who never joined</div>
                  <div className="opts">
                    {LEAD_STAGES.map((s) => (
                      <button key={s.id} className={`fchip fchip-sm ${audience.leadStages.includes(s.id) ? "on" : ""}`} aria-pressed={audience.leadStages.includes(s.id)} onClick={() => setAudience({ ...audience, leadStages: toggle(audience.leadStages, s.id) })}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="mo-count" aria-live="polite">
                  {count === null ? "Counting…" : count.count === 0 ? "Nobody matches yet." : <><span className="strong">{count.count} {count.count === 1 ? "person" : "people"}</span> with an email address who haven’t opted out{count.sample.length ? <span className="muted">, e.g. {count.sample.join(", ")}</span> : null}.</>}
                </div>
              </div>

              <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                <div>
                  <label className="label" htmlFor="mo-subject">Subject</label>
                  <input id="mo-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New Saturday classes at Round One" />
                </div>
                <div>
                  <label className="label" htmlFor="mo-body">Message</label>
                  <textarea id="mo-body" className="input enq-text" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
                  <div className="small faint" style={{ marginTop: 6 }}>Plain text, from info@round1boxfit.co.uk. You can use {PLACEHOLDERS}. An unsubscribe line is added at the bottom of every email.</div>
                </div>
                {note && <div className="small muted" aria-live="polite">{note}</div>}
                {!confirming ? (
                  <div className="actions" style={{ gap: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-red" disabled={busy !== null || !subject.trim() || !body.trim() || !count?.count} onClick={() => setConfirming(true)}>Send</button>
                    <button className="btn btn-ghost" disabled={busy !== null || !subject.trim() || !body.trim()} onClick={test}>{busy === "test" ? "Sending test" : "Send me a test"}</button>
                    <button className="btn btn-ghost" disabled={busy !== null || !dirty} onClick={save}>{busy === "save" ? "Saving" : "Save draft"}</button>
                  </div>
                ) : (
                  <div className="mo-confirm" role="alertdialog" aria-labelledby="mo-confirm-h">
                    <div id="mo-confirm-h" className="strong">Send “{subject}” to {count?.count} {count?.count === 1 ? "person" : "people"}?</div>
                    <div className="small muted">{describeAudience(audience)}. It goes from info@round1boxfit.co.uk with an unsubscribe link. This can’t be undone.</div>
                    <div className="actions" style={{ gap: 10 }}>
                      <button className="btn btn-red" disabled={busy === "send"} onClick={send}>{busy === "send" ? "Sending" : `Yes, send to ${count?.count}`}</button>
                      <button className="btn btn-ghost" disabled={busy === "send"} onClick={() => setConfirming(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
