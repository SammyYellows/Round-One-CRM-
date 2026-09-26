import Link from "next/link";
import { notFound } from "next/navigation";
import { answerLabel, questionLabel } from "@/lib/config";
import { fullName, getLead, leadAppointments, listActivities } from "@/lib/leads";
import { STAGES, stageInfo } from "@/lib/stages";
import { formatDateTime, formatSlot, timeAgo } from "@/lib/time";
import { getWorkflow, messageQueue } from "@/lib/workflows";
import { addNote, appointmentStatus, bookForLead, moveStageForm, sendManualMessage, updateLead } from "../../actions";
import Topbar from "../../Topbar";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(Number(id));
  if (!lead) notFound();
  const answers = JSON.parse(lead.answers_json) as Record<string, string>;
  const appts = leadAppointments(lead.id);
  const activities = listActivities(lead.id);
  const pending = messageQueue({ leadId: lead.id, status: "pending" });
  const st = stageInfo(lead.stage);
  const nowIso = new Date().toISOString();

  return (
    <>
      <Topbar title={fullName(lead)}>
        <span className="badge" style={{ background: st.color, color: "#fff" }}>
          {st.label}
        </span>
        <form action={moveStageForm} className="row">
          <input type="hidden" name="id" value={lead.id} />
          <select name="stage" defaultValue={lead.stage} style={{ width: 170 }}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-sm">Move stage</button>
        </form>
      </Topbar>
      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.4fr)", alignItems: "start" }}>
          <div className="stack">
            <form action={updateLead} className="card stack">
              <input type="hidden" name="id" value={lead.id} />
              <h2>Contact</h2>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <label className="field">
                  <span>First name</span>
                  <input name="first_name" defaultValue={lead.first_name} />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input name="last_name" defaultValue={lead.last_name} />
                </label>
              </div>
              <label className="field">
                <span>Mobile</span>
                <input name="phone" defaultValue={lead.phone} />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" defaultValue={lead.email} />
              </label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <label className="field">
                  <span>Source</span>
                  <input name="source" defaultValue={lead.source} />
                </label>
                <label className="field">
                  <span>Value (£)</span>
                  <input name="value" defaultValue={(lead.value_pence / 100).toFixed(2)} />
                </label>
              </div>
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" name="whatsapp_opt_in" defaultChecked={!!lead.whatsapp_opt_in} style={{ width: "auto" }} />
                Opted in to WhatsApp/SMS
                {lead.sms_fallback ? <span className="badge">SMS fallback</span> : null}
              </label>
              <div className="spread">
                <span className="small muted">Created {formatDateTime(lead.created_at)}</span>
                <button className="btn btn-sm">Save</button>
              </div>
            </form>

            <div className="card">
              <h2>Consultations</h2>
              {appts.length === 0 && <p className="muted">No consultations yet.</p>}
              {appts.map((a) => (
                <div key={a.id} className="spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ textDecoration: ["cancelled", "no_show"].includes(a.status) ? "line-through" : undefined }}>
                      {formatSlot(a.starts_at)}
                    </div>
                    <span className="badge">{a.status.replace("_", "-")}</span>
                  </div>
                  {["booked", "confirmed"].includes(a.status) && (
                    <div className="row" style={{ gap: 4 }}>
                      {a.status === "booked" && <StatusBtn id={a.id} status="confirmed" label="Confirm" />}
                      {a.starts_at <= nowIso && <StatusBtn id={a.id} status="attended" label="Attended" cls="btn-ok" />}
                      {a.starts_at <= nowIso && <StatusBtn id={a.id} status="no_show" label="No-show" cls="btn-danger" />}
                      <StatusBtn id={a.id} status="cancelled" label="Cancel" cls="btn-ghost" />
                    </div>
                  )}
                </div>
              ))}
              <form action={bookForLead} className="row" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="datetime-local" name="when" required step={900} style={{ flex: 1 }} />
                <button className="btn btn-sm">Book</button>
              </form>
              <p className="small muted">
                Lead&apos;s own booking link: <a href={`/book/${lead.token}`}>/book/{lead.token}</a>
              </p>
            </div>

            <div className="card">
              <h2>Questionnaire</h2>
              {lead.disqualify_reason && <p className="error small">Not qualified: {lead.disqualify_reason}</p>}
              {Object.keys(answers).length === 0 ? (
                <p className="muted">No questionnaire answers.</p>
              ) : (
                <table className="table">
                  <tbody>
                    {Object.entries(answers).map(([k, v]) => (
                      <tr key={k}>
                        <td className="muted small">{questionLabel(k)}</td>
                        <td>{answerLabel(k, v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <h2>Message</h2>
              <form action={sendManualMessage} className="stack">
                <input type="hidden" name="id" value={lead.id} />
                <textarea name="body" placeholder={`WhatsApp ${lead.first_name}…`} />
                <div className="spread">
                  <span className="small muted">Free-form WhatsApp only delivers within 24h of their last message.</span>
                  <button className="btn btn-sm">Send WhatsApp</button>
                </div>
              </form>
              <form action={addNote} className="stack" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={lead.id} />
                <textarea name="body" placeholder="Add an internal note…" />
                <div style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm">Add note</button>
                </div>
              </form>
            </div>

            {pending.length > 0 && (
              <div className="card">
                <h2>Scheduled automations</h2>
                <table className="table">
                  <tbody>
                    {pending.map((m) => {
                      const wf = getWorkflow(m.workflow);
                      return (
                        <tr key={m.id}>
                          <td className="small">
                            {wf?.number}. {wf?.name}
                            <div className="muted">{m.step.replace(/_/g, " ")}</div>
                          </td>
                          <td className="small" style={{ whiteSpace: "nowrap" }}>
                            {formatDateTime(m.send_at)}
                            <div className="muted">{timeAgo(m.send_at)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card">
              <h2>Activity</h2>
              <ul className="timeline">
                {activities.map((a) => (
                  <li key={a.id} className={a.type}>
                    <div className="small muted">
                      {formatDateTime(a.created_at)} · {a.type.replace("_", " ")}
                    </div>
                    <div className="bubble">{a.body}</div>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/admin/pipeline" className="small">
              ← Back to pipeline
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusBtn({ id, status, label, cls = "" }: { id: number; status: string; label: string; cls?: string }) {
  return (
    <form action={appointmentStatus}>
      <input type="hidden" name="appointment" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn btn-sm ${cls}`}>{label}</button>
    </form>
  );
}
