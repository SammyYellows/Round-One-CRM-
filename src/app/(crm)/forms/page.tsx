"use client";

import { useState } from "react";
import { FormRunner } from "@/components/FormRunner";
import { demoAdLink, uid } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { Form, Question, QuestionType } from "@/lib/types";

const TYPES: { id: QuestionType; label: string }[] = [
  { id: "text", label: "Short text" },
  { id: "name", label: "First and last name" },
  { id: "long", label: "Long text" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "choice", label: "Choice" },
  { id: "multi", label: "Tick boxes" },
  { id: "scale", label: "Scale 1–10" },
];

export default function FormsPage() {
  const { s, act } = useStore();
  const [formId, setFormId] = useState(s.forms[0]?.id);
  const [step, setStep] = useState(0);
  const form = s.forms.find((f) => f.id === formId) ?? s.forms[0];
  const automation = s.automations.find((a) => a.trigger.type === "form.submitted" && a.trigger.formId === form.id);
  const liveUrl = demoAdLink(form.slug);

  const save = (next: Form) => act("updateForm", next);
  const setQ = (i: number, patch: Partial<Question>) =>
    save({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i: number, dir: -1 | 1) => {
    const qs = [...form.questions];
    [qs[i], qs[i + dir]] = [qs[i + dir], qs[i]];
    save({ ...form, questions: qs });
    setStep(i + dir);
  };
  const remove = (i: number) => {
    save({ ...form, questions: form.questions.filter((_, j) => j !== i) });
    setStep(Math.max(0, i - 1));
  };
  const add = () => {
    save({ ...form, questions: [...form.questions, { id: uid(), type: "choice", text: "New question", options: ["Option A", "Option B"] }] });
    setStep(form.questions.length);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Forms / {form.name} · changes save as you type</div>
          <h1 className="h h1">Forms</h1>
        </div>
        <div className="actions">
          <a className="btn btn-red" href={liveUrl} target="_blank" rel="noreferrer">Open live form</a>
        </div>
      </header>

      <div className="grid cols-forms">
        <nav aria-label="Forms" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {s.forms.map((f) => (
            <button key={f.id} className={`flink ${f.id === form.id ? "on" : ""}`} aria-current={f.id === form.id ? "page" : undefined} onClick={() => { setFormId(f.id); setStep(0); }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{f.responses} responses</span>
            </button>
          ))}
        </nav>

        <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="h" style={{ fontSize: 24 }}>Questions</h2>
            <span className="small muted">One per screen</span>
          </div>

          {form.questions.map((q, i) => (
            <div key={q.id} className={`qedit ${i === step ? "on" : ""}`} onFocus={() => setStep(i)} onClick={() => setStep(i)}>
              <span className="h" style={{ fontSize: 20, color: "var(--red)", paddingTop: 10 }}>{i + 1}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="input" aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
                {(q.type === "choice" || q.type === "multi") && (
                  <input
                    className="input"
                    aria-label={`Options for question ${i + 1}, separated by commas`}
                    value={(q.options ?? []).join(", ")}
                    onChange={(e) => setQ(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                  />
                )}
                {q.type === "multi" && (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }} className="small muted">
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Tick up to <input className="input" style={{ width: 64, height: 36 }} type="number" min={1} max={10} value={q.max ?? 1} onChange={(e) => setQ(i, { max: Math.max(1, Number(e.target.value) || 1) })} /></label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!q.other} onChange={(e) => setQ(i, { other: e.target.checked })} /> With an “Other” box</label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!q.optional} onChange={(e) => setQ(i, { optional: e.target.checked })} /> Optional</label>
                  </div>
                )}
                {(q.type === "long" || q.type === "text") && (
                  <label className="small muted" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!q.optional} onChange={(e) => setQ(i, { optional: e.target.checked })} /> Optional</label>
                )}
                {q.type === "scale" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" aria-label={`Words for 1, question ${i + 1}`} placeholder="Words for 1" value={q.low ?? ""} onChange={(e) => setQ(i, { low: e.target.value })} />
                    <input className="input" aria-label={`Words for 10, question ${i + 1}`} placeholder="Words for 10" value={q.high ?? ""} onChange={(e) => setQ(i, { high: e.target.value })} />
                  </div>
                )}
                {q.field && <span className="small faint">Saved to the contact’s {q.field}</span>}
              </div>
              <select className="select" aria-label={`Type of question ${i + 1}`} value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QuestionType })}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()}>
                <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label="Move down" disabled={i === form.questions.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="icon-btn" aria-label="Delete question" onClick={() => remove(i)}>✕</button>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={add}>Add question</button>

          <div style={{ marginTop: 8 }}>
            <h3 className="h" style={{ fontSize: 18, marginBottom: 4 }}>When someone submits</h3>
            <div className="tl"><span className="chip chip-red">Do</span><span>Create a contact in <strong>Pipeline · New lead</strong>, or update them if the mobile number matches</span></div>
            <div className="tl">
              <span className="chip chip-red">Do</span>
              <span>{automation ? <>Run automation <strong>{automation.name}</strong>{automation.enabled ? "" : " (paused)"}</> : "No automation linked yet"}</span>
            </div>
            <div className="tl"><span className="chip">Track</span><span className="muted">Save the campaign, ad set and ad the person came from (utm_campaign, utm_term, utm_content, ad_id)</span></div>
          </div>
          <div>
            <label className="label" htmlFor="thanks-title">End screen headline</label>
            <input id="thanks-title" className="input" placeholder="Thanks. See you at Round One." value={form.thanksTitle ?? ""} onChange={(e) => save({ ...form, thanksTitle: e.target.value || undefined })} />
          </div>
          <div>
            <label className="label" htmlFor="thanks">Thank-you message</label>
            <input id="thanks" className="input" value={form.thanks} onChange={(e) => save({ ...form, thanks: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="book-button">Booking button</label>
            <input id="book-button" className="input" placeholder="Leave empty for no button" value={form.bookButton ?? ""} onChange={(e) => save({ ...form, bookButton: e.target.value || undefined })} />
            <div className="small faint" style={{ marginTop: 6 }}>Opens their own booking page, to pick a free-trial slot.</div>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 24 }}>
          <div className="eyebrow">Preview · doesn’t create a lead</div>
          <FormRunner form={form} step={step} onStep={setStep} style={{ height: 680, border: "10px solid var(--black)" }} />
        </div>
      </div>
    </>
  );
}
