import { redirect } from "next/navigation";
import { AuthShell, Notice } from "@/components/AuthShell";
import { Sidebar } from "@/components/Sidebar";
import { currentUser, staffFor } from "@/lib/server/staff";
import { supabaseConfigured } from "@/lib/supabase/env";

// Staff screens. Middleware has already made sure someone is signed in; here
// we check that the login belongs to a staff member.
export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  let staff: { name: string } | undefined;
  if (supabaseConfigured()) {
    const user = await currentUser();
    if (!user) redirect("/login");
    const member = await staffFor(user);
    if (!member) {
      return (
        <AuthShell title="Not set up yet">
          <Notice tone="info">{user.email} can log in, but isn’t set up as staff. Ask Sammy to add you.</Notice>
          <form method="post" action="/auth/logout">
            <button className="btn btn-ghost">Log out</button>
          </form>
        </AuthShell>
      );
    }
    staff = { name: member.name };
  }
  return (
    <div className="app">
      <Sidebar staff={staff} />
      <main className="main">{children}</main>
    </div>
  );
}
