import Link from "next/link";
import { getWorkflow, messageQueue, workflowStats, WORKFLOWS } from "@/lib/workflows";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/time";
import { whatsappConfigured } from "@/lib/whatsapp";
import { smsConfigured } from "@/lib/sms";
import { emailConfigured } from "@/lib/email";
import { runAutomationsNow } from "../actions";
import Topbar from "../Topbar";

function delayLabel(d: { afterMinutes: number } | { beforeAppointmentMinutes: number }) {
  const fmt = (m: number) => (m === 0 ? "immediately" : m % 1440 === 0 ? `${m / 1440}d` : m % 60 === 0 ? `${m / 60}h` : `${m}m`);
  return "afterMinutes" in d
    ? d.afterMinutes === 0
      ? "Immediately"
      : `Wait ${fmt(d.afterMinutes)}`
    : `${fmt(d.beforeAppointmentMinutes)} before appointment`;
}

const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp → SMS", email: "Email", internal: "Team notification" };

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "workflows" } = await searchParams;
  const stats = workflowStats();
  const formLeads = (db().prepare("SELECT COUNT(*) n FROM activities WHERE type = 'form'").get() as { n: number }).n;
  const queue = tab === "queue" ? messageQueue({ status: "pending", limit: 200 }) : [];
  const log = tab === "log" ? messageQueue({ limit: 200 }).filter((m) => m.status !== "pending") : [];

  return (
    <>
      <Topbar title="Automation">
        <Link className={`btn btn-sm ${tab === "workflows" ? "" : "btn-ghost"}`} href="/admin/automations">
          Workflows
        </Link>
        <Link className={`btn btn-sm ${tab === "queue" ? "" : "btn-ghost"}`} href="/admin/automations?tab=queue">
          Scheduled
        </Link>
        <Link className={`btn btn-sm ${tab === "log" ? "" : "btn-ghost"}`} href="/admin/automations?tab=log">
          Execution log
        </Link>
        <form action={runAutomationsNow}>
          <button className="btn btn-ghost btn-sm">Run due now</button>
        </form>
      </Topbar>
      <div className="content stack">
        <div className="notice small">
          WhatsApp: <b>{whatsappConfigured() ? "live" : "dry run"}</b> · SMS fallback: <b>{smsConfigured() ? "live" : "dry run"}</b> · Email:{" "}
          <b>{emailConfigured() ? "live" : "dry run"}</b>. In dry run, messages are written to each lead&apos;s activity feed instead of
          being sent. Add the API keys in <code>.env</code> to go live.
        </div>

        {tab === "workflows" && (
          <>
            <div className="card">
              <div className="spread">
                <div>
                  <h2>0. Questionnaire → CRM</h2>
                  <div className="muted small">Trigger: questionnaire submitted · creates/updates the contact and opportunity</div>
                </div>
                <span className="badge">{formLeads} submissions</span>
              </div>
            </div>
            {WORKFLOWS.map((w) => (
              <div key={w.key} className="card">
                <div className="spread">
                  <div>
                    <h2>
                      {w.number}. {w.name}
                    </h2>
                    <div className="muted small">
                      Trigger: {w.trigger}
                      {w.stopOnReply ? " · stops when the contact replies" : ""}
                    </div>
                  </div>
                  <div className="row small">
                    <span className="badge">{stats[w.key].total} enrolled</span>
                    <span className="badge">{stats[w.key].active} active</span>
                    <span className="badge">{stats[w.key].sent} sent</span>
                  </div>
                </div>
                <table className="table" style={{ marginTop: 8 }}>
                  <tbody>
                    {w.steps.map((s) => (
                      <tr key={s.key} style={{ opacity: s.disabled ? 0.45 : 1 }}>
                        <td style={{ width: 190 }} className="small">
                          {delayLabel(s.delay)}
                        </td>
                        <td style={{ width: 150 }} className="small">
                          <span className="badge">{CHANNEL[s.channel]}</span>
                          {s.variant && <div className="muted">if {s.variant.replace("_", "-")}</div>}
                          {s.disabled && <div className="muted">disabled</div>}
                        </td>
                        <td className="small">
                          {s.subject && <b>{s.subject}</b>}
                          <div style={{ whiteSpace: "pre-wrap" }}>{s.text}</div>
                          {s.template && <div className="muted">template: {s.template}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        {tab !== "workflows" && (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{tab === "queue" ? "Sends" : "Sent"}</th>
                  <th>Contact</th>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "queue" ? queue : log).map((m) => {
                  const wf = getWorkflow(m.workflow);
                  return (
                    <tr key={m.id}>
                      <td className="small" style={{ whiteSpace: "nowrap" }}>
                        {formatDateTime(m.send_at)}
                        <div className="muted">{timeAgo(m.send_at)}</div>
                      </td>
                      <td>
                        <Link href={`/admin/leads/${m.lead_id}`}>
                          {m.first_name} {m.last_name}
                        </Link>
                      </td>
                      <td className="small">
                        {wf?.number}. {m.step.replace(/_/g, " ")}
                      </td>
                      <td>
                        <span className="badge">{m.status}</span>
                      </td>
                      <td className="small">{m.error ? <span className="error">{m.error}</span> : m.body}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
