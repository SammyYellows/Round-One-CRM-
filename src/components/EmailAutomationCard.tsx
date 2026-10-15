"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useIsManager } from "@/components/StaffContext";

// One automation's email, editable and approvable from a screen: the wording,
// named saved drafts, an AI rewrite from an instruction, and a switch with a
// confirm. Used for the win-back on Cancellations and the Program messages.

interface Draft { id: string; name: string; subject: string; body: string; savedAt: string; savedBy: string }

export function EmailAutomationCard({ automationId, title, purpose, when, startOpen = true }: { automationId: string; title: string; purpose: string; when: string; startOpen?: boolean }) {
  const { s, act, live } = useStore();
  const manager = useIsManager();
  const automation = s.automations.find((a) => a.id === automationId);
  const emailIndex = automation?.steps.findIndex((st) => st.kind === "email" && st.to === "contact") ?? -1;
  const emailStep = emailIndex >= 0 ? automation!.steps[emailIndex] : undefined;
  const waStep = automation?.steps.find((st) => st.kind === "whatsapp");
  const waName = waStep?.kind === "whatsapp" ? waStep.template : null;
  const waText = waName ? s.templates[waName] : null;
  const hasWhatsApp = !!waName;

  const [open, setOpen] = useState(startOpen);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [draftName, setDraftName] = useState("");

  const liveSubject = emailStep?.kind === "email" ? emailStep.subject : "";
  const liveBody = emailStep?.kind === "email" ? emailStep.body ?? "" : "";
  const [showLive, setShowLive] = useState(false);
  // What has happened to this automation: last wording change, last switch, how many sent.
  const lastChange = s.events.find((e) => e.type === "automation.changed" && e.data?.automation === automationId && e.data?.subject);
  const lastSwitch = s.events.find((e) => e.type === "automation.changed" && e.data?.automation === automationId && e.data?.enabled);
  const sentCount = s.events.filter((e) => e.type === "email.sent" && e.data?.automation === automationId && e.data?.to === "contact").length;
  const lastSent = s.events.find((e) => e.type === "email.sent" && e.data?.automation === automationId && e.data?.to === "contact");
  useEffect(() => { setSubject(liveSubject); setBody(liveBody); }, [liveSubject, liveBody]);
  useEffect(() => {
    if (!live) return;
    fetch(`/api/automation-drafts?automation=${encodeURIComponent(automationId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { drafts: [] })).then((j) => setDrafts(j.drafts ?? [])).catch(() => undefined);
  }, [automationId, live]);

  if (!automation || emailStep?.kind !== "email") return null;
  const dirty = subject !== liveSubject || body !== liveBody;
  const liveDraft = drafts.find((d) => d.subject === liveSubject && d.body === liveBody);
  const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const api = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/automation-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automation: automationId, purpose, ...payload }) });
    return { ok: res.ok, ...((await res.json().catch(() => ({}))) as Record<string, unknown>) } as { ok: boolean; error?: string; drafts?: Draft[]; subject?: string; body?: string };
  };
  const loadDraft = (id: string) => {
    setDraftId(id);
    const d = drafts.find((x) => x.id === id);
    if (d) { setSubject(d.subject); setBody(d.body); setDraftName(d.name); setConfirming(false); setNote(`Loaded “${d.name}”. It isn’t live until you press “Make this the live wording” or approve it.`); }
  };
  const currentDraft = drafts.find((d) => d.id === draftId);
  const saveDraft = async () => {
    const name = draftName.trim();
    if (!name) { setNote("Give the draft a name first."); return; }
    setBusy("draft");
    const update = !!currentDraft && currentDraft.name === name;
    const r = await api({ action: "save", id: update ? draftId : undefined, name, subject, body });
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
    setNote("Rewritten. Read it through, then save it as a draft or make it the live wording.");
  };
  const saveWording = () => {
    if (automation.enabled && !confirm(`Replace the live wording of “${title}”? Everyone it applies to from now on gets the new version.`)) return;
    act("setEmailStep", automationId, emailIndex, subject, body);
    setNote(automation.enabled ? "This is now the live wording. It goes out from the next send." : "Wording saved. It goes out once you approve and switch on.");
  };
  const switchOn = () => { if (dirty) act("setEmailStep", automationId, emailIndex, subject, body); act("toggleAutomation", automationId); setConfirming(false); setNote("Switched on."); };
  const switchOff = () => { act("toggleAutomation", automationId); setNote("Switched off. Nothing more will be sent."); };

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="eyebrow">{automation.enabled ? `On · ${when}` : "Off · nothing is sent until you approve it"}</div>
          <h2 className="h h3">{title}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`chip ${automation.enabled ? "chip-red" : ""}`}>{automation.enabled ? "On" : "Off"}</span>
          <span className="small muted">{open ? "Hide" : "Show"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="enq-confirm" style={{ borderColor: automation.enabled ? "var(--red)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <div className="strong">{automation.enabled ? "Live now: this is what gets sent" : "Off: nothing is sent. Wording that would go out if switched on"}</div>
              <button type="button" className="link-btn faint" onClick={() => setShowLive((v) => !v)}>{showLive ? "Hide the message" : "Read the message"}</button>
            </div>
            <div className="small muted">
              Subject: <span className="strong">{liveSubject || "(none)"}</span>
              {liveDraft ? ` · same as saved draft “${liveDraft.name}”` : drafts.length ? " · not one of the saved drafts" : ""}
            </div>
            <div className="small muted">Who: {when}.</div>
            <div className="small faint">
              {lastChange ? `Wording last changed ${dateTime(lastChange.at)}. ` : "Wording unchanged since it was set up. "}
              {lastSwitch ? `Switched ${lastSwitch.data?.enabled === "yes" ? "on" : "off"} ${dateTime(lastSwitch.at)}. ` : ""}
              {sentCount > 0 ? `Sent to ${sentCount} ${sentCount === 1 ? "person" : "people"}, last ${lastSent ? dateTime(lastSent.at) : ""}.` : "Not sent to anyone yet."}
            </div>
            {showLive && <div className="enq-mail" style={{ margin: "6px 0 0", maxHeight: 260 }}>{liveBody || "(empty)"}</div>}
          </div>
          {!manager ? (
            <div className="small faint">Only management can change this message or switch it on or off.</div>
          ) : (<>
          <div className="label" style={{ marginTop: 4 }}>
            Editing{dirty ? (currentDraft && currentDraft.subject === subject && currentDraft.body === body ? ` · draft “${currentDraft.name}” loaded, not live` : " · changed, not live yet") : " · same as live"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label className="label" htmlFor={`${automationId}-draft`}>Saved drafts</label>
              <select id={`${automationId}-draft`} className="select" value={draftId} onChange={(e) => loadDraft(e.target.value)}>
                <option value="">{drafts.length ? "Pick a saved draft to load" : "No saved drafts yet"}</option>
                {drafts.map((d) => <option key={d.id} value={d.id}>{d.name}{liveDraft?.id === d.id ? " · LIVE" : ""} · {new Date(d.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label className="label" htmlFor={`${automationId}-name`}>Draft name</label>
              <input id={`${automationId}-name`} className="input" value={draftName} placeholder="e.g. Friendly short version" onChange={(e) => setDraftName(e.target.value)} />
            </div>
            <button className="btn btn-ghost" disabled={busy !== null || !draftName.trim()} onClick={saveDraft}>{busy === "draft" ? "Saving" : currentDraft && currentDraft.name === draftName.trim() ? "Update draft" : "Save as draft"}</button>
            {draftId && <button className="btn btn-ghost" disabled={busy !== null} onClick={deleteDraft}>Delete draft</button>}
          </div>
          <div>
            <label className="label" htmlFor={`${automationId}-subject`}>Subject</label>
            <input id={`${automationId}-subject`} className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setConfirming(false); }} />
          </div>
          <div>
            <label className="label" htmlFor={`${automationId}-body`}>Message</label>
            <textarea id={`${automationId}-body`} className="input enq-text" rows={12} value={body} onChange={(e) => { setBody(e.target.value); setConfirming(false); }} />
            <div className="small faint" style={{ marginTop: 6 }}>
              {when}. You can use {"{first} {name} {gym} {team}"}.{hasWhatsApp ? " The WhatsApp version below goes at the same time." : ""}
            </div>
          </div>
          {hasWhatsApp && (
            <div>
              <div className="label">WhatsApp version{waName ? ` · ${waName}` : ""}</div>
              <div className="enq-mail" style={{ margin: 0, maxHeight: 200 }}>{waText ?? "Template text not loaded."}</div>
              <div className="small faint" style={{ marginTop: 6 }}>Goes to people with a mobile number, through Meta. Every change to the wording has to be approved by Meta.</div>
              {manager && live && waName && <WhatsAppWording name={waName} />}
            </div>
          )}
          <div>
            <label className="label" htmlFor={`${automationId}-instruction`}>Ask the AI to change it</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id={`${automationId}-instruction`} className="input" style={{ minWidth: 0 }} value={instruction} placeholder="e.g. Warmer and shorter"
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && instruction.trim() && busy === null) rewrite(); }}
              />
              <button className="btn btn-ghost" style={{ padding: "0 14px" }} disabled={busy !== null || !instruction.trim()} onClick={rewrite}>{busy === "rewrite" ? "Rewriting" : "Rewrite"}</button>
            </div>
            <div className="small faint" style={{ marginTop: 6 }}>The AI keeps the placeholders in place. Nothing changes until you save or approve.</div>
          </div>
          {note && <div className="small muted" aria-live="polite">{note}</div>}
          {!confirming ? (
            <div className="actions" style={{ gap: 10, flexWrap: "wrap" }}>
              {automation.enabled ? (
                <>
                  <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Make this the live wording</button>
                  <button className="btn btn-ghost" onClick={switchOff}>Switch off</button>
                </>
              ) : (
                <>
                  <button className="btn btn-red" disabled={!subject.trim() || !body.trim()} onClick={() => setConfirming(true)}>Approve and switch on</button>
                  <button className="btn btn-ghost" disabled={!dirty} onClick={saveWording}>Make this the live wording</button>
                </>
              )}
            </div>
          ) : (
            <div className="enq-confirm" role="alertdialog" aria-labelledby={`${automationId}-confirm`}>
              <div id={`${automationId}-confirm`} className="strong">Switch “{title}” on?</div>
              <div className="small muted">{when}, with the wording above, to everyone it applies to from now on. You can switch it off here any time.</div>
              <div className="actions" style={{ gap: 10 }}>
                <button className="btn btn-red" onClick={switchOn}>Yes, switch it on</button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
          </>)}
        </div>
      )}
    </section>
  );
}

/**
 * Change the WhatsApp wording by picking one of three versions (Sammy,
 * 15/10/2026). The pick goes to Meta; the current wording keeps sending
 * until Meta approves it, then the CRM switches over by itself.
 */
function WhatsAppWording({ name }: { name: string }) {
  const { refresh } = useStore();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [options, setOptions] = useState<string[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<{ to: string; at: string; status: string; note?: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/templates/${name}/wording`, { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { pending?: { to: string; at: string; status: string; note?: string } | null; status?: string | null } | null;
    setPending(j?.pending ?? null);
    setStatus(j?.status ?? null);
  }, [name]);
  useEffect(() => { load(); }, [load]);
  const ask = async () => {
    setBusy(true); setNote(null); setOptions(null); setPick(null); setConfirming(false);
    const r = await fetch(`/api/templates/${name}/wording`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { options?: string[]; error?: string } | null;
    setBusy(false);
    if (r?.ok && j?.options?.length) setOptions(j.options); else setNote(j?.error ?? "Couldn’t write versions. Try again.");
  };
  const use = async () => {
    if (pick === null || !options) return;
    setBusy(true);
    const r = await fetch(`/api/templates/${name}/wording`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: options[pick] }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { mode?: string; name?: string; error?: string } | null;
    setBusy(false); setConfirming(false);
    if (!r?.ok) { setNote(j?.error ?? "Couldn’t save it. Try again."); return; }
    setOptions(null); setPick(null); setInstruction(""); setOpen(false);
    setNote(j?.mode === "updated" ? "Saved. Meta hasn’t seen this one yet, so the new wording goes with it when it’s submitted." : "Sent to Meta for approval. The current wording keeps sending until Meta approves the new one (usually minutes, sometimes a day); then it switches over by itself.");
    refresh();
    load();
  };
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {pending?.status === "submitted" && <div className="small">New wording ({pending.to}) is with Meta for approval since {new Date(pending.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. It takes over once approved.</div>}
      {pending?.status === "rejected" && <div className="small" style={{ color: "var(--red)" }}>Meta turned down the new wording ({pending.note ?? "no reason given"}). The current wording is still in use; try another version.</div>}
      {note && <div className="small muted">{note}</div>}
      {!open ? (
        <div><button className="btn btn-ghost btn-sm" disabled={pending?.status === "submitted"} onClick={() => setOpen(true)}>Change the wording</button>{status === "draft" && <span className="small faint" style={{ marginLeft: 8 }}>Not sent to Meta yet</span>}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--line)" }}>
          <label className="label" style={{ margin: 0 }} htmlFor={`wa-ins-${name}`}>What should change? (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id={`wa-ins-${name}`} className="input" style={{ minWidth: 0 }} value={instruction} disabled={busy} placeholder="e.g. friendlier, and invite them in for a session" onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} />
            <button className="btn btn-ghost" style={{ padding: "0 14px" }} disabled={busy} onClick={ask}>{busy && !options ? "Writing" : options ? "Three more" : "Show me 3 versions"}</button>
          </div>
          {options && (
            <div role="radiogroup" aria-label="Pick a version" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((o, i) => (
                <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, border: `1px solid ${pick === i ? "var(--red)" : "var(--line)"}`, cursor: "pointer" }}>
                  <input type="radio" name={`wa-pick-${name}`} checked={pick === i} onChange={() => { setPick(i); setConfirming(false); }} style={{ marginTop: 4 }} />
                  <span className="small" style={{ whiteSpace: "pre-wrap" }}><strong>{String.fromCharCode(65 + i)}.</strong> {o}</span>
                </label>
              ))}
            </div>
          )}
          {options && !confirming && (
            <div className="actions" style={{ gap: 8 }}>
              <button className="btn btn-red btn-sm" disabled={pick === null || busy} onClick={() => setConfirming(true)}>Use this one</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setOpen(false); setOptions(null); setPick(null); }}>Keep the current wording</button>
            </div>
          )}
          {options && confirming && pick !== null && (
            <div className="enq-confirm" role="alertdialog" aria-label="Confirm the new wording">
              <div className="strong">{status === "draft" ? "Save version" : "Send version"} {String.fromCharCode(65 + pick)} {status === "draft" ? "as this message’s wording?" : "to Meta for approval?"}</div>
              <div className="small muted">{status === "draft" ? "Meta hasn’t seen this template yet, so it’s just saved." : "Nothing is sent to anyone. The current wording keeps going out until Meta approves this one."}</div>
              <div className="actions" style={{ gap: 8 }}>
                <button className="btn btn-red btn-sm" disabled={busy} onClick={use}>{busy ? "Working" : "Yes, use it"}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
