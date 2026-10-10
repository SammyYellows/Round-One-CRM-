"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

// Staff logins (Sammy, 10/10/2026). Management only (Owner or Manager):
// add someone with their name, email and role and they get an email to set
// their password; remove them and their login stops working at once.
// Staff see the day-to-day screens; management see everything.

interface Person { id: string; name: string; role: string; email: string | null; active: boolean; joined: boolean }

export default function StaffPage() {
  const { live } = useStore();
  const [list, setList] = useState<Person[] | null>(null);
  const [me, setMe] = useState("");
  const [roles, setRoles] = useState<string[]>(["Owner", "Manager", "Staff"]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Staff");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const r = await fetch("/api/staff", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setList(j.staff); setMe(j.me); setRoles(j.roles); } else setErr(j.error ?? "Couldn’t load staff");
  };
  useEffect(() => { if (live) load(); }, [live]);

  const call = async (method: string, body: unknown) => {
    setErr(""); setNote("");
    const r = await fetch("/api/staff", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? j.note ?? "Something went wrong"); else if (j.note) setNote(j.note);
    await load();
    return r.ok;
  };

  const add = async () => {
    setBusy(true);
    if (await call("POST", { action: "add", name, email, role })) { setName(""); setEmail(""); setRole("Staff"); }
    setBusy(false);
  };

  if (!live) return <div className="card empty">Staff logins need the live CRM.</div>;
  const active = (list ?? []).filter((p) => p.active), removed = (list ?? []).filter((p) => !p.active);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Management only · who can log in to the CRM</div>
          <h1 className="h h1">Staff</h1>
        </div>
      </header>

      <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div className="label" style={{ margin: 0 }}>Add someone</div>
        <div className="small muted">They get an email from bookings@round1boxfit.co.uk to choose their password (8 characters or more). <strong>Staff</strong> see the day-to-day screens; <strong>Owner</strong> and <strong>Manager</strong> also see Mailouts, Automations, Reports, Forms, Meta ads, Train Champ, everyone’s Champ chats and this page, and can change messages and settings.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">{roles.map((r) => <option key={r}>{r}</option>)}</select>
          <button className="btn btn-red" disabled={busy || !name.trim() || !email.trim()} onClick={add}>{busy ? "Adding…" : "Add and send invite"}</button>
        </div>
        {err && <div className="small" style={{ color: "var(--red)" }} role="alert">{err}</div>}
        {note && <div className="small" aria-live="polite">{note}</div>}
      </section>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1fr) auto" }}>
          <div>Name</div><div>Email</div><div>Role</div><div>Login</div><div />
        </div>
        {active.map((p) => (
          <div key={p.id} className="crow" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1fr) auto" }}>
            <div className="strong">{p.name}{p.id === me ? <span className="faint small"> · you</span> : null}</div>
            <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
            <div>
              <select className="select" style={{ height: 32 }} value={roles.includes(p.role) ? p.role : "Staff"} disabled={p.id === me} onChange={(e) => call("PATCH", { id: p.id, role: e.target.value })} aria-label={`Role for ${p.name}`}>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="small">{p.joined ? <span className="muted">Logged in</span> : <span>Invite sent, not logged in yet</span>}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {!p.joined && <button className="btn btn-ghost btn-sm" onClick={() => call("POST", { action: "resend", id: p.id })}>Resend</button>}
              {p.id !== me && <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Remove ${p.name}? Their login stops working straight away. You can bring them back later.`)) call("PATCH", { id: p.id, active: false }); }}>Remove</button>}
            </div>
          </div>
        ))}
        {list && active.length === 0 && <div className="empty">Nobody yet.</div>}
      </section>

      {removed.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="pad label" style={{ margin: 0 }}>Removed</div>
          {removed.map((p) => (
            <div key={p.id} className="crow" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) auto" }}>
              <div className="muted">{p.name}</div>
              <div className="faint small">{p.email}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => call("PATCH", { id: p.id, active: true })}>Bring back</button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
