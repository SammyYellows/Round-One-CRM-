"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PasswordInput } from "@/components/ShowPasswords";

// Staff logins (Sammy, 10/10/2026). Management only (Owner or Manager):
// add someone with their name, email and role and they get an email to set
// their password; remove them and their login stops working at once.
// Staff see the day-to-day screens; management see everything.
// Shared logins (Sammy, 11/10/2026): a username and a password set here, no
// email; one for management and one for staff, shared by everyone at that level.

interface Person { id: string; name: string; role: string; email: string | null; shared: boolean; username: string | null; active: boolean; joined: boolean }

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
  const [sName, setSName] = useState("");
  const [sUser, setSUser] = useState("");
  const [sRole, setSRole] = useState("Staff");
  const [sPass, setSPass] = useState("");
  const [pwFor, setPwFor] = useState("");
  const [pw, setPw] = useState("");

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

  const addShared = async () => {
    setBusy(true);
    if (await call("POST", { action: "add-shared", name: sName, username: sUser, role: sRole, password: sPass })) { setSName(""); setSUser(""); setSRole("Staff"); setSPass(""); }
    setBusy(false);
  };

  const setPassword = async (p: Person) => {
    if (!confirm(`Set a new password for ${p.username}? Everyone signed in on it will be signed out and need the new one.`)) return;
    setBusy(true);
    if (await call("POST", { action: "set-password", id: p.id, password: pw })) { setPwFor(""); setPw(""); }
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
      </section>

      <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div className="label" style={{ margin: 0 }}>Add a shared login</div>
        <div className="small muted">A username instead of an email, shared by everyone at that level (for example <strong>staff</strong> for the front desk and coaches). You choose the password; no email is sent. Forgotten password doesn’t work for these, so if someone forgets it or leaves, set a new one here.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <input className="input" placeholder="Name (e.g. Staff)" value={sName} onChange={(e) => setSName(e.target.value)} aria-label="Name for the shared login" />
          <input className="input" placeholder="Username (e.g. staff)" value={sUser} onChange={(e) => setSUser(e.target.value.toLowerCase().replace(/\s/g, ""))} aria-label="Username" autoCapitalize="none" spellCheck={false} />
          <select className="select" value={sRole} onChange={(e) => setSRole(e.target.value)} aria-label="Role for the shared login">{roles.map((r) => <option key={r}>{r}</option>)}</select>
          <PasswordInput id="shared-password" autoComplete="new-password" placeholder="Password" value={sPass} onChange={(e) => setSPass(e.target.value)} aria-label="Password for the shared login" />
          <button className="btn btn-red" disabled={busy || !sName.trim() || !sUser.trim() || sPass.length < 8} onClick={addShared}>{busy ? "Adding…" : "Add login"}</button>
        </div>
      </section>

      {err && <div className="small" style={{ color: "var(--red)", marginBottom: 12 }} role="alert">{err}</div>}
      {note && <div className="small" style={{ marginBottom: 12 }} aria-live="polite">{note}</div>}

      <section className="card">
        <div className="crow thead staff-head" style={{ borderTop: 0, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1fr) auto" }}>
          <div>Name</div><div>Email or username</div><div>Role</div><div>Login</div><div />
        </div>
        {active.map((p) => (
          <div key={p.id} className="crow staff-row" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1fr) auto" }}>
            <div className="strong">{p.name}{p.id === me ? <span className="faint small"> · you</span> : null}</div>
            <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.shared ? <>Username: <strong>{p.username}</strong></> : p.email}</div>
            <div>
              <select className="select" style={{ height: 32 }} value={roles.includes(p.role) ? p.role : "Staff"} disabled={p.id === me} onChange={(e) => call("PATCH", { id: p.id, role: e.target.value })} aria-label={`Role for ${p.name}`}>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="small">{p.shared ? <span className="muted">Shared login</span> : p.joined ? <span className="muted">Logged in</span> : <span>Invite sent, not logged in yet</span>}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {p.shared && <button className="btn btn-ghost btn-sm" onClick={() => { setPwFor(pwFor === p.id ? "" : p.id); setPw(""); }}>{pwFor === p.id ? "Cancel" : "Set password"}</button>}
              {!p.joined && !p.shared && <button className="btn btn-ghost btn-sm" onClick={() => call("POST", { action: "resend", id: p.id })}>Resend</button>}
              {p.id !== me && <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Remove ${p.name}? Their login stops working straight away. You can bring them back later.`)) call("PATCH", { id: p.id, active: false }); }}>Remove</button>}
            </div>
            {pwFor === p.id && (
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 220px" }}><PasswordInput id={`pw-${p.id}`} autoComplete="new-password" placeholder="New password (8 or more)" value={pw} onChange={(e) => setPw(e.target.value)} aria-label={`New password for ${p.username}`} autoFocus /></div>
                <button className="btn btn-red" disabled={busy || pw.length < 8} onClick={() => setPassword(p)}>Save password</button>
              </div>
            )}
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
