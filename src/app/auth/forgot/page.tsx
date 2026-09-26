import { AuthShell } from "@/components/AuthShell";

export default function ForgotPage() {
  return (
    <AuthShell title="Reset password">
      <form method="post" action="/auth/reset" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="label" htmlFor="email">Your staff email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <button className="btn btn-red">Send reset link</button>
      </form>
      <a className="small" href="/login" style={{ color: "var(--muted)" }}>Back to login</a>
    </AuthShell>
  );
}
