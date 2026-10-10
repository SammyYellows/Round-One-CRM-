"use client";

import { useEffect, useState } from "react";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";

// Teach Champ (Sammy, 10/10/2026): what Champ knows about Round One. Notes
// written here and the text of uploaded documents; Champ reads every one
// that's switched on before it answers. Management only (Owner or Manager
// logins), reached from the Champ screen, not the sidebar.

interface Row { id: string; title: string; body: string; kind: "note" | "document"; file_name: string | null; size: number | null; status: "ready" | "failed"; error: string | null; active: boolean; created_by: string; updated_at: string; chars: number }

const SUGGESTIONS = ["Equipment", "Class formats", "Coaching standards", "Safety and house rules", "Intro meetings and sales", "Who's who"];

export default function KnowledgePage() {
  const { now, live } = useStore();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [used, setUsed] = useState(0);
  const [max, setMax] = useState(400000);
  const [denied, setDenied] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; body: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/champ/knowledge", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) { setDenied(j.error ?? "Management only"); return; }
    if (r.ok) { setRows(j.rows); setUsed(j.used); setMax(j.max); }
  };
  useEffect(() => { if (live) load(); }, [live]);

  const call = async (method: string, payload?: unknown, query = "") => {
    const r = await fetch(`/api/champ/knowledge${query}`, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "Something went wrong");
    return j;
  };

  const addNote = async () => {
    setErr(""); setNote(""); setBusy("note");
    try { await call("POST", { action: "note", title, body }); setTitle(""); setBody(""); setNote("Saved. Champ uses it from the next question."); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy("");
  };

  const upload = async () => {
    if (!file) return;
    setErr(""); setNote(""); setBusy("doc");
    try {
      const { path, signedUrl } = await call("POST", { action: "upload-url", name: file.name, size: file.size });
      const put = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("The upload didn't go through. Try again.");
      setBusy("reading");
      const j = await call("POST", { action: "document", path, name: file.name, title: docTitle });
      setFile(null); setDocTitle("");
      setNote(`Read ${j.chars.toLocaleString("en-GB")} characters. Champ uses it from the next question.${j.note ? ` ${j.note}` : ""}`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); await load(); }
    setBusy("");
  };

  const toggle = async (r: Row) => { setErr(""); try { await call("PATCH", { id: r.id, active: !r.active }); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  const remove = async (r: Row) => { if (!confirm(`Remove “${r.title}” from Champ’s knowledge? This can’t be undone.`)) return; setErr(""); try { await call("DELETE", undefined, `?id=${r.id}`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  const saveEdit = async () => { if (!edit) return; setErr(""); try { await call("PATCH", edit); setEdit(null); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };

  if (!live) return <div className="card empty">Teaching Champ needs the live CRM.</div>;
  if (denied) return <div className="card empty">Only management logins can change what Champ knows.</div>;
  const pct = Math.min(100, Math.round((used / max) * 100));

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Management only · Champ reads everything switched on here before it answers</div>
          <h1 className="h h1">Teach Champ</h1>
        </div>
      </header>

      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="small muted">Knowledge used: {used.toLocaleString("en-GB")} of {max.toLocaleString("en-GB")} characters ({pct}%). The more there is, the more each question costs, so keep it to what staff need.</div>
        <div style={{ height: 6, background: "var(--line)", marginTop: 8 }}><div style={{ width: `${pct}%`, height: "100%", background: pct > 90 ? "var(--red)" : "var(--white)" }} /></div>
        {err && <div className="small" style={{ color: "var(--red)", marginTop: 8 }} role="alert">{err}</div>}
        {note && <div className="small" style={{ marginTop: 8 }} aria-live="polite">{note}</div>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
        <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="label" style={{ margin: 0 }}>Write a note</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{SUGGESTIONS.map((s) => <button key={s} className="fchip fchip-sm" style={{ textTransform: "none", letterSpacing: 0 }} onClick={() => setTitle(s)}>{s}</button>)}</div>
          <input className="input" placeholder="Title, e.g. Equipment" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <textarea className="input" rows={8} style={{ paddingTop: 10, resize: "vertical" }} placeholder={"What Champ should know, in plain words. For example:\n12 heavy bags, 6 pairs of pads, kettlebells 8 to 24kg, 4 rowers, 2 sleds, slam balls 6 to 12kg, one ring."} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn btn-red btn-sm" disabled={!title.trim() || !body.trim() || busy !== ""} onClick={addNote}>{busy === "note" ? "Saving…" : "Save note"}</button>
        </section>

        <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="label" style={{ margin: 0 }}>Upload a document</div>
          <div className="small muted">PDF, Word (.docx) or text, up to 20 MB. Champ keeps the text, not the layout. A long PDF can take a minute or two to read.</div>
          <input type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="small" />
          <input className="input" placeholder="Title (optional, defaults to the file name)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} maxLength={120} />
          <button className="btn btn-red btn-sm" disabled={!file || busy !== ""} onClick={upload}>{busy === "doc" ? "Uploading…" : busy === "reading" ? "Reading the document…" : "Upload"}</button>
        </section>
      </div>

      <section className="card">
        <div className="crow thead" style={{ borderTop: 0, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto" }}>
          <div>What Champ knows</div><div>Size</div><div>Added</div><div />
        </div>
        {(rows ?? []).map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 22px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <button className="link-btn strong" style={{ textAlign: "left" }} onClick={() => setOpen(open === r.id ? null : r.id)}>{r.title}</button>
                <div className="faint small">{r.kind === "document" ? `Document: ${r.file_name}` : "Note"}{!r.active && r.status === "ready" ? " · switched off" : ""}</div>
                {r.status === "failed" && <div className="small" style={{ color: "var(--red)" }}>Couldn’t read it: {r.error}</div>}
                {r.status === "ready" && r.error && <div className="small faint">{r.error}</div>}
              </div>
              <div className="small muted">{r.chars.toLocaleString("en-GB")} characters</div>
              <div className="small muted">{r.created_by} · {ago(r.updated_at, now)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {r.status === "ready" && <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>{r.active ? "Switch off" : "Switch on"}</button>}
                {r.status === "ready" && <button className="btn btn-ghost btn-sm" onClick={() => { setEdit({ id: r.id, title: r.title, body: r.body }); setOpen(r.id); }}>Edit</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Remove</button>
              </div>
            </div>
            {open === r.id && (
              edit?.id === r.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  <textarea className="input" rows={12} style={{ paddingTop: 10, resize: "vertical" }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                  <div style={{ display: "flex", gap: 8 }}><button className="btn btn-red btn-sm" onClick={saveEdit}>Save changes</button><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button></div>
                </div>
              ) : (
                <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "var(--ui)", marginTop: 10, maxHeight: 360, overflowY: "auto", color: "var(--white)" }}>{r.body || "(nothing read)"}</pre>
              )
            )}
          </div>
        ))}
        {rows && rows.length === 0 && <div className="empty">Nothing yet. Start with an Equipment note so Champ can plan classes around your kit.</div>}
      </section>
    </>
  );
}
