import { redirect } from "next/navigation";
import { AuthShell, Notice } from "@/components/AuthShell";
import { currentUser } from "@/lib/server/staff";

export default async function SetPasswordPage({ searchParams }: { searchParams: { error?: string; done?: string } }) {
  const user = await currentUser();
  if (!user) redirect(searchParams.done ? "/login?password=1" : "/login?error=link");
  if (searchParams.done) {
    return (
      <AuthShell title="Password saved">
        <Notice tone="done"><strong>Your new password is saved.</strong><br />You’re logged in as {user.email}. Next time, log in with the new password.</Notice>
        <a className="btn btn-red" href="/" style={{ textAlign: "center" }}>Go to the CRM</a>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Set your password">
      <Notice tone="info">For {user.email}. Use at least 10 characters.</Notice>
      {searchParams.error && <Notice tone="error">Those passwords don’t match or are too short. Try again.</Notice>}
      <form method="post" action="/auth/password" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Type it again</label>
          <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
        <button className="btn btn-red">Save password</button>
      </form>
    </AuthShell>
  );
}
