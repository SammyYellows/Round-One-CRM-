"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

// One automation's email, editable and approvable from a screen: the wording,
// named saved drafts, an AI rewrite from an instruction, and a switch with a
// confirm. Used for the win-back on Cancellations and the Program messages.

interface Draft { id: string; name: string; subject: string; body: string; savedAt: string; savedBy: string }

export function EmailAutomationCard({ automationId, title, purpose, when, startOpen = true }: { automationId: string; title: string; purpose: string; when: string; startOpen?: boolean }) {
  const { s, act, live } = useStore();
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
  useEffect(() => { setSubject(liveSubject); setBody(liveBody); }, [liveSubject, liveBody]);
  useEffect(() => {
    if (!live) return;
    fetch(`/api/automation-drafts?automation=${encodeURIComponent(automationId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { drafts: [] })).then((j) => setDrafts(j.drafts ?? [])).catch(() => undefined);
  }, [automationId, live]);

  if (!automation || emailStep?.kind !== "email") return null;
  const dirty = subject !== liveSubject || body !== liveBody;

  const api = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/automation-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automation: automationId, purpose, ...payload }) });
    return { ok: res.ok, ...((await res.json().catch(() => ({}))) as Record<string, unknown>) } as { ok: boolean; error?: string; drafts?: Draft[]; subject?: string; body?: string };
  };
  const loadDraft = (id: string) => {
    setDraftId(id);
    const d = drafts.find((x) => x.id === id);
    if (d) { setSubject(d.subject); setBody(d.body); setDraftName(d.name); setConfirming(false); setNote(`Loaded “${d.name}”. It isn’t live until you save the wording or approve it.`); }
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
    setNote("Rewritten. Read it through, then save it as a draft or save the wording.");
  };
  const saveWording = () => { act("setEmailStep", automationId, emailIndex, subject, body); setNote("Wording saved."); };
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label className="label" htmlFor={`${automationId}-draft`}>Saved drafts</label>
              <select id={`${automationId}-draft`} className="select" value={draftId} onChange={(e) => loadDraft(e.target.value)}>
                <option value="">{drafts.length ? "Pick a saved draft to load" : "No saved drafts yet"}</option>
                {drafts.map((d) => <option key={d.id} value={d.id}>{d.name} · {new Date(d.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</option>)}
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
              <div className="small faint" style={{ marginTop: 6 }}>Goes to people with a mobile number, through Meta. Templates need Meta’s approval and only reach the test phone until the real number moves over at go-live. To change the words, tell Claude: each change is re-submitted to Meta.</div>
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
            <div className="enq-confirm" role="alertdialog" aria-labelledby={`${automationId}-confirm`}>
              <div id={`${automationId}-confirm`} className="strong">Switch “{title}” on?</div>
              <div className="small muted">{when}, with the wording above, to everyone it applies to from now on. You can switch it off here any time.</div>
              <div className="actions" style={{ gap: 10 }}>
                <button className="btn btn-red" onClick={switchOn}>Yes, switch it on</button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
