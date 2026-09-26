import Link from "next/link";
import { fullName, listLeads } from "@/lib/leads";
import { STAGES, stageInfo } from "@/lib/stages";
import { formatDateTime } from "@/lib/time";
import { createLead } from "../actions";
import Topbar from "../Topbar";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; add?: string }> }) {
  const sp = await searchParams;
  const leads = listLeads({ q: sp.q, stage: sp.stage || undefined });
  return (
    <>
      <Topbar title="Contacts">
        <form className="row">
          <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" style={{ width: 200 }} />
          <select name="stage" defaultValue={sp.stage ?? ""} style={{ width: 160 }}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm">Filter</button>
        </form>
        <Link href="/admin/leads?add=1" className="btn btn-sm">
          + Add contact
        </Link>
      </Topbar>
      <div className="content stack">
        {sp.add && (
          <form action={createLead} className="card">
            <h2>Add contact</h2>
            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <label className="field">
                <span>First name</span>
                <input name="first_name" required />
              </label>
              <label className="field">
                <span>Last name</span>
                <input name="last_name" />
              </label>
              <label className="field">
                <span>Mobile</span>
                <input name="phone" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" />
              </label>
              <label className="field">
                <span>Source</span>
                <select name="source" defaultValue="Walk-in">
                  {["Walk-in", "Instagram", "Meta Ads", "Referral", "Phone", "Website"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" name="automations" style={{ width: "auto" }} /> Start the New Lead booking push
              </label>
              <button className="btn">Create</button>
              <Link href="/admin/leads" className="btn btn-ghost">
                Cancel
              </Link>
            </div>
          </form>
        )}
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Source</th>
                <th>Stage</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const st = stageInfo(l.stage);
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/admin/leads/${l.id}`}>{fullName(l)}</Link>
                    </td>
                    <td>{l.phone}</td>
                    <td>{l.email}</td>
                    <td>{l.source}</td>
                    <td>
                      <span className="badge">
                        <span className="dot" style={{ background: st.color }} />
                        {st.label}
                      </span>
                    </td>
                    <td className="muted">{formatDateTime(l.created_at)}</td>
                  </tr>
                );
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
