"use client";

import Link from "next/link";
import { useState } from "react";
import { describeStep, describeTrigger } from "@/lib/engine";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";

const KIND_CHIP: Record<string, string> = { Do: "chip-light", Wait: "", If: "chip-ink" };

export default function AutomationsPage() {
  const { s, now, act } = useStore();
  const [sel, setSel] = useState(s.automations[0]?.id);
  const a = s.automations.find((x) => x.id === sel) ?? s.automations[0];
  const waiting = s.runs.filter((r) => r.automationId === a.id && r.status === "waiting");
  const contact = (id: string) => s.contacts.find((c) => c.id === id);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{s.automations.filter((x) => x.enabled).length} of {s.automations.length} running</div>
          <h1 className="h h1">Automations</h1>
        </div>
        <button className="btn btn-red" disabled title="The flow editor comes next">New automation</button>
      </header>

      <div className="grid cols-auto">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {s.automations.map((x) => (
            <div key={x.id} className={`arow ${x.id === a.id ? "on" : ""}`}>
              <button className="aname" onClick={() => setSel(x.id)}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{x.name}</span>
                <span className="small muted">{describeTrigger(x, s.forms)}</span>
                <span className="faint" style={{ fontSize: 12 }}>{x.enabled ? `Ran ${x.runs} times` : "Paused"}</span>
              </button>
              <button
                className={`tog ${x.enabled ? "on" : ""}`}
                aria-pressed={x.enabled}
                aria-label={`${x.enabled ? "Pause" : "Turn on"} ${x.name}`}
                onClick={() => act("toggleAutomation", x.id)}
              />
            </div>
          ))}
          <p className="small faint" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>
            To watch a flow run: open the trial form, submit it, then use +1 day in the sidebar to move the clock on.
          </p>
        </div>

        <section className="card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <h2 className="h" style={{ fontSize: 32 }}>{a.name}</h2>
              <span className={`chip ${a.enabled ? "chip-red" : ""}`}>{a.enabled ? "Live" : "Paused"}</span>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>{a.summary}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div className="step" style={{ background: "var(--black)" }}>
              <span className="chip chip-red">When</span>
              <div className="strong" style={{ fontSize: 15 }}>{describeTrigger(a, s.forms)}</div>
            </div>
            {a.steps.map((step, i) => {
              const d = describeStep(step, s.templates);
              return (
                <div key={i}>
                  <div className="connector" />
                  <div className="step">
                    <span className={`chip ${KIND_CHIP[d.kind]}`}>{d.kind}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                      <div className="strong" style={{ fontSize: 15 }}>{d.title}</div>
                      {d.detail && <div className="small muted">{d.detail}</div>}
                      {"preview" in d && d.preview && <div className="small faint" style={{ lineHeight: 1.5 }}>“{d.preview}”</div>}
                    </div>
                    <span className="h faint" style={{ fontSize: 16 }}>{i + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="h h3" style={{ marginBottom: 4 }}>Waiting now</h3>
            {waiting.length === 0 && <div className="small faint">No one is part-way through this flow.</div>}
            {waiting.map((r) => (
              <div key={r.id} className="tl" style={{ alignItems: "baseline" }}>
                <Link href={`/contacts/${r.contactId}`} className="strong" style={{ width: 160 }}>{contact(r.contactId)?.name}</Link>
                <span className="muted">
                  Step {r.stepIndex + 1} of {a.steps.length} at {r.resumeAt ? dayTime(r.resumeAt) : "later"} ({r.resumeAt ? ago(r.resumeAt, now) : ""})
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
