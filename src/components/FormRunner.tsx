"use client";

import { useEffect, useState } from "react";
import { Form } from "@/lib/types";

// One question per screen, Typeform-style. Used for the live public form and
// for the preview in the builder, so what staff see is what people get.

export function FormRunner({
  form,
  onSubmit,
  step: controlledStep,
  onStep,
  style,
}: {
  form: Form;
  onSubmit?: (answers: Record<string, string>) => void;
  step?: number;
  onStep?: (n: number) => void;
  style?: React.CSSProperties;
}) {
  const [localStep, setLocalStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const step = controlledStep ?? localStep;
  const setStep = (n: number) => { setError(""); (onStep ?? setLocalStep)(n); };

  const Q = form.questions;
  const done = step >= Q.length;
  const q = Q[Math.min(step, Q.length - 1)];

  useEffect(() => setError(""), [step]);

  const valid = (value: string) => {
    if (!q) return true;
    if (!value.trim()) return false;
    if (q.type === "email") return /\S+@\S+\.\S+/.test(value);
    if (q.type === "phone") return value.replace(/\D/g, "").length >= 10;
    return true;
  };

  const next = (value = answers[q?.id] ?? "") => {
    if (!valid(value)) {
      setError(q.type === "email" ? "That doesn’t look like an email address." : q.type === "phone" ? "Please enter a full mobile number." : "Please answer this one to carry on.");
      return;
    }
    const nextAnswers = { ...answers, [q.id]: value };
    setAnswers(nextAnswers);
    if (step === Q.length - 1) onSubmit?.(nextAnswers);
    setStep(step + 1);
  };

  const restart = () => { setAnswers({}); setStep(0); };

  return (
    <div className="runner" style={style}>
      <div className="runner-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt="Round One" width={64} style={{ display: "block", height: "auto" }} />
        <span>{form.name}</span>
      </div>
      <div className="segs" style={{ padding: "16px 24px 0" }}>
        {Q.map((x, i) => <div key={x.id} className={i <= step ? "on" : ""} />)}
      </div>
      <div className="runner-body">
        {done ? (
          <>
            <div className="h" style={{ fontSize: 40 }}>Thanks. See you at Round One.</div>
            <div className="help">{form.thanks}</div>
            <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={restart}>Start again</button>
          </>
        ) : q ? (
          <form
            style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}
            onSubmit={(e) => { e.preventDefault(); next(); }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5A5B5A" }}>
              Question {step + 1} of {Q.length}
            </div>
            <label htmlFor={`q-${q.id}`} className="q">{q.text}</label>
            {q.help && <div className="help">{q.help}</div>}
            {q.type === "choice" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }} role="group" aria-label={q.text}>
                {(q.options ?? []).map((o, j) => (
                  <button
                    type="button"
                    key={o}
                    className={`opt ${answers[q.id] === o ? "on" : ""}`}
                    onClick={() => next(o)}
                  >
                    <span className="key">{String.fromCharCode(65 + j)}</span>{o}
                  </button>
                ))}
              </div>
            ) : (
              <input
                key={q.id}
                id={`q-${q.id}`}
                // Keep the cursor moving on the live form; not in the builder preview, where it would steal focus.
                autoFocus={controlledStep === undefined && step > 0}
                className="pin"
                type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                autoComplete={q.field === "name" ? "name" : q.field === "phone" ? "tel" : q.field === "email" ? "email" : "off"}
                placeholder={q.type === "phone" ? "07…" : q.type === "email" ? "you@example.com" : "Type your answer"}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            )}
            {error && <div className="err" role="alert">{error}</div>}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</button>
              {q.type !== "choice" && (
                <button type="submit" className="btn btn-red" style={{ flex: 1 }}>{step === Q.length - 1 ? "Send" : "OK"}</button>
              )}
            </div>
          </form>
        ) : (
          <div className="help">This form has no questions yet.</div>
        )}
      </div>
    </div>
  );
}
