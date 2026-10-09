"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { describeStep, describeTrigger } from "@/lib/engine";
import { ago, dayTime } from "@/lib/format";
import { useStore } from "@/lib/store";

const KIND_CHIP: Record<string, string> = { Do: "chip-light", Wait: "", If: "chip-ink" };

// The automations by what they're for (Sammy, 09/10/2026: the one list was
// too much). Same page, picked with ?group=, so the sidebar stays as it is.
const GROUPS: { id: string; label: string; blurb: string; match: (id: string) => boolean }[] = [
  { id: "leads", label: "Leads and trials", blurb: "From the questionnaire to the intro meeting: the GymGrow journey.", match: (id) => ["new_lead", "trial_booked", "trial_moved", "trial_cancelled", "no_show", "trial_attended"].includes(id) },
  { id: "sales", label: "Sales", blurb: "What happens when staff mark a sale on the pipeline.", match: (id) => ["sold_programme", "sold_membership", "programme_week_one", "did_not_convert"].includes(id) },
  { id: "program", label: "Program", blurb: "The 28 Day Program messages, by day, from TeamUp's start date. Edit and approve them on Program members.", match: (id) => id.startsWith("program_") },
  { id: "members", label: "Members", blurb: "Cancellations and payments, from the nightly TeamUp sync. Edit and approve on Cancellations and Failed payments.", match: (id) => ["win_back", "payment_failed"].includes(id) },
  { id: "accountability", label: "Accountability", blurb: "The opt-in programme: welcome, weekly check-in, mid-week nudge. Edit and approve on Accountability.", match: (id) => id.startsWith("accountability_") },
];
const groupOf = (id: string) => GROUPS.find((g) => g.match(id))?.id ?? "other";

export default function AutomationsPage() {
  return <Suspense><AutomationsInner /></Suspense>;
}

function AutomationsInner() {
  const { s, now, act } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const groupId = params.get("group") ?? "leads";
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const others = s.automations.filter((x) => groupOf(x.id) === "other");
  const list = groupId === "other" ? others : s.automations.filter((x) => group.match(x.id));
  const [sel, setSel] = useState<string | undefined>();
  const a = list.find((x) => x.id === sel) ?? list[0];
  const pick = (g: string) => { setSel(undefined); router.replace(`/automations?group=${g}`); };
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

      <div className="filters" role="navigation" aria-label="Automation groups">
        <div className="filters-row" style={{ gap: 8, flexWrap: "wrap" }}>
          {GROUPS.map((g) => {
            const n = s.automations.filter((x) => g.match(x.id));
            return <button key={g.id} className={`fchip ${groupId === g.id ? "on" : ""}`} aria-pressed={groupId === g.id} onClick={() => pick(g.id)}>{g.label} <span className="faint" style={{ marginLeft: 6 }}>{n.filter((x) => x.enabled).length}/{n.length}</span></button>;
          })}
          {others.length > 0 && <button className={`fchip ${groupId === "other" ? "on" : ""}`} aria-pressed={groupId === "other"} onClick={() => pick("other")}>Other <span className="faint" style={{ marginLeft: 6 }}>{others.length}</span></button>}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>{groupId === "other" ? "Automations that don't fit a group yet." : group.blurb}</div>
      </div>

      {!a && <div className="card pad muted">Nothing in this group.</div>}
      {a && (
      <div className="grid cols-auto">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((x) => (
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
          {groupId === "leads" && (
            <p className="small faint" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>
              To watch a flow run: open the trial form, submit it, then use +1 day in the sidebar to move the clock on.
            </p>
          )}
        </div>

        <section className="card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <h2 className="h" style={{ fontSize: 32 }}>{a.name}</h2>
              <span className={`chip ${a.enabled ? "chip-red" : ""}`}>{a.enabled ? "Live" : "Paused"}</span>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>{a.summary}</div>
            {a.stopOnReply && <div className="small faint">Stops for anyone who replies on WhatsApp.</div>}
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
      )}
    </>
  );
}
