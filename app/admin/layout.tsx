import { requireAdmin } from "@/lib/auth";
import { GYM } from "@/lib/config";
import { whatsappConfigured } from "@/lib/whatsapp";
import { logout } from "./actions";
import Nav from "./Nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">ROUND 1 CRM</div>
        <div className="loc">
          <b>{GYM.name}</b>
          <br />
          {GYM.city}, England
        </div>
        <Nav />
        <div className="bottom small">
          <p style={{ opacity: 0.7 }}>WhatsApp: {whatsappConfigured() ? "live" : "dry run"}</p>
          <a href="/apply" target="_blank" style={{ color: "#cbe7ee" }}>
            Open questionnaire ↗
          </a>
          <form action={logout} style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm">Log out</button>
          </form>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
