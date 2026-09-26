import { redirect } from "next/navigation";
import { AuthShell, Notice } from "@/components/AuthShell";
import { currentUser } from "@/lib/server/staff";

export default async function SetPasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login?error=link");
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
