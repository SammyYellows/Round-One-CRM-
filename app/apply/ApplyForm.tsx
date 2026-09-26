"use client";

import { useActionState, useState } from "react";
import type { Question } from "@/lib/config";
import { submitApplication, type ApplyState } from "./actions";

export default function ApplyForm({ questions, source, campaign }: { questions: Question[]; source: string; campaign: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, {});
  // step 0 = intro, 1..n = questions, n+1 = details
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const total = questions.length + 1;

  const choose = (key: string, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTimeout(() => setStep((s) => s + 1), 150);
  };

  return (
    <div className="panel">
      {step > 0 && (
        <div className="progress">
          <div style={{ width: `${(step / total) * 100}%` }} />
        </div>
      )}

      {step === 0 && (
        <div>
          <h1>Start your journey at Round 1 🥊</h1>
          <p className="sub">
            Answer a few quick questions to see if you&apos;re eligible for a <b>free consultation</b> with one of our coaches. It takes
            under a minute.
          </p>
          <button className="btn" onClick={() => setStep(1)}>
            Let&apos;s go →
          </button>
        </div>
      )}

      {questions.map((q, i) =>
        step === i + 1 ? (
          <div key={q.key}>
            <p className="muted small">
              Question {i + 1} of {questions.length}
            </p>
            <h1>{q.title}</h1>
            {q.subtitle && <p className="sub">{q.subtitle}</p>}
            <div style={{ marginTop: 16 }}>
              {q.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`choice ${answers[q.key] === o.value ? "selected" : ""}`}
                  onClick={() => choose(q.key, o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          </div>
        ) : null,
      )}

      <form action={action} style={{ display: step === total ? "block" : "none" }}>
        <h1>Nearly there!</h1>
        <p className="sub">Where should we send your consultation details?</p>
        {questions.map((q) => (
          <input key={q.key} type="hidden" name={`q_${q.key}`} value={answers[q.key] ?? ""} />
        ))}
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="campaign" value={campaign} />
        <div className="stack">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}>
              <span>First name</span>
              <input name="first_name" autoComplete="given-name" required />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Last name</span>
              <input name="last_name" autoComplete="family-name" />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Mobile (WhatsApp)</span>
            <input name="phone" type="tel" autoComplete="tel" placeholder="07..." required />
          </label>
          <label className="consent">
            <input type="checkbox" name="consent" defaultChecked />
            <span>I&apos;m happy for Round 1 Fitness to contact me by WhatsApp, SMS and email about my consultation. Reply STOP any time.</span>
          </label>
          {state.error && <p className="error">{state.error}</p>}
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
            <button className="btn" disabled={pending}>
              {pending ? "Checking…" : "See if I'm eligible →"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
