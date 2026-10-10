import { AuthShell, Notice } from "@/components/AuthShell";
import { lastEmail } from "@/lib/server/lastEmail";

export const dynamic = "force-dynamic";

export default function ForgotPage({ searchParams }: { searchParams: { sent?: string } }) {
  const email = lastEmail();
  if (searchParams.sent) {
    return (
      <AuthShell title="Check your email">
        <Notice tone="done">
          <strong>Reset link sent{email ? ` to ${email}` : ""}.</strong>
          <br />Open the email from bookings@round1boxfit.co.uk and tap <em>Reset password</em>. You’ll then choose a new password here.
        </Notice>
        <Notice tone="info">It can take a minute or two. If it isn’t there, check junk or spam. If that email isn’t a staff account, no email is sent.</Notice>
        <form method="post" action="/auth/reset">
          <input type="hidden" name="email" value={email} />
          <button className="btn btn-ghost" disabled={!email} style={{ width: "100%" }}>Send it again</button>
        </form>
        <a className="small" href="/login" style={{ color: "var(--muted)" }}>Back to login</a>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Reset password">
      <Notice tone="info">We’ll email you a link to choose a new password.</Notice>
      <form method="post" action="/auth/reset" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="label" htmlFor="email">Your staff email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={email} required />
        </div>
        <button className="btn btn-red">Send reset link</button>
      </form>
      <a className="small" href="/login" style={{ color: "var(--muted)" }}>Back to login</a>
    </AuthShell>
  );
}
