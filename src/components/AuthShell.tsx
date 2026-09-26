// Frame for the login and password pages: logo and one panel, no sidebar.

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card pad" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt="Round One" width={96} style={{ display: "block", height: "auto" }} />
        <h1 className="h" style={{ fontSize: 36, margin: 0 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className="small" style={{ margin: 0, color: tone === "error" ? "var(--red)" : "var(--muted)" }}>
      {children}
    </p>
  );
}
