import { AuthShell, Notice } from "@/components/AuthShell";

const ERRORS: Record<string, string> = {
  login: "That email and password don’t match. Try again, or reset your password.",
  link: "That link has expired or already been used. Ask for a new one.",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string; reset?: string } }) {
  return (
    <AuthShell title="Staff login">
      {searchParams.error && <Notice tone="error">{ERRORS[searchParams.error] ?? ERRORS.login}</Notice>}
      {searchParams.reset && <Notice tone="info">If that email has a staff account, we’ve sent a link to set a new password.</Notice>}
      <form method="post" action="/auth/login" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="next" value={searchParams.next ?? "/"} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        <button className="btn btn-red">Log in</button>
      </form>
      <a className="small" href="/auth/forgot" style={{ color: "var(--muted)" }}>Forgotten your password?</a>
    </AuthShell>
  );
}
