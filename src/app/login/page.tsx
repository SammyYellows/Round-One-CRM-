import { AuthShell, Notice } from "@/components/AuthShell";
import { lastEmail } from "@/lib/server/lastEmail";
import { PasswordInput } from "@/components/ShowPasswords";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  login: "That email and password don’t match. Try again, or reset your password.",
  link: "That link has expired or already been used. Ask for a new one.",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string; reset?: string; password?: string } }) {
  const email = lastEmail();
  return (
    <AuthShell title="Staff login">
      {searchParams.error && <Notice tone="error">{ERRORS[searchParams.error] ?? ERRORS.login}</Notice>}
      {searchParams.reset && <Notice tone="done">If that email has a staff account, we’ve sent a link to set a new password. Check your inbox and junk.</Notice>}
      {searchParams.password && <Notice tone="done"><strong>Password changed.</strong> Log in with your new password.</Notice>}
      <form method="post" action="/auth/login" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="next" value={searchParams.next ?? "/"} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={email} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" autoFocus={!!email} />
        </div>
        <button className="btn btn-red">Log in</button>
      </form>
      <a className="small" href="/auth/forgot" style={{ color: "var(--muted)" }}>Forgotten your password?</a>
    </AuthShell>
  );
}
