import { redirect } from "next/navigation";
import { checkPassword, createSession, isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(form: FormData) {
  "use server";
  if (!checkPassword(String(form.get("password") ?? ""))) redirect("/login?error=1");
  await createSession();
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthed()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="public">
      <div className="brand">
        ROUND <span>1</span> CRM
      </div>
      <form action={login} className="panel" style={{ maxWidth: 380 }}>
        <h1>Staff login</h1>
        <label className="field" style={{ margin: "16px 0" }}>
          <span>Password</span>
          <input type="password" name="password" autoFocus required />
        </label>
        {error && <p className="error">Incorrect password.</p>}
        <button className="btn" style={{ width: "100%" }}>
          Log in
        </button>
      </form>
    </main>
  );
}
