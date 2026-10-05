"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Today", icon: <path d="M3 11 12 4l9 7v9H3z" /> },
  { href: "/calendar", label: "Calendar", icon: <><rect x="3" y="4" width="18" height="17" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
  { href: "/pipeline", label: "Meta pipeline", icon: <><rect x="3" y="4" width="5" height="16" /><rect x="10" y="4" width="5" height="11" /><rect x="17" y="4" width="4" height="7" /></> },
  { href: "/pipeline/teamup", label: "TeamUp pipeline", icon: <><rect x="3" y="4" width="5" height="7" /><rect x="10" y="4" width="5" height="11" /><rect x="17" y="4" width="4" height="16" /></> },
  { href: "/contacts", label: "Contacts", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></> },
  { href: "/enquiries", label: "Enquiries", icon: <><rect x="3" y="5" width="18" height="14" /><path d="m3 6 9 7 9-7" /></> },
  { href: "/mailouts", label: "Mailouts", icon: <><path d="M3 8h13l5 4-5 4H3z" /><path d="M7 12h6" /></> },
  { href: "/members", label: "Members", icon: <><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c1-3.5 3.5-5.5 6-5.5s5 2 6 5.5M15 19c.5-2 2-3.5 4-3.5s2.5 1 2 3.5" /></> },
  { href: "/automations", label: "Automations", icon: <path d="M13 2 4 14h7l-1 8 9-12h-7z" /> },
  { href: "/forms", label: "Forms", icon: <><rect x="5" y="3" width="14" height="18" /><path d="M9 8h6M9 12h6M9 16h4" /></> },
  { href: "/ads", label: "Meta ads", icon: <path d="M5 20V11M11 20V5M17 20v-6M3 21h18" /> },
];

export function Sidebar({ staff }: { staff?: { name: string } }) {
  const path = usePathname();
  const { now, act, reset, live } = useStore();
  const isOn = (href: string) => (href === "/" || href === "/pipeline" ? path === href : path.startsWith(href));
  const shift = (hours: number) => act("shiftClock", hours);

  return (
    <nav className="sidebar" aria-label="Main">
      <Link href="/" className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt="Round One" width={116} style={{ display: "block", height: "auto" }} />
      </Link>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={`nav ${isOn(n.href) ? "on" : ""}`} aria-current={isOn(n.href) ? "page" : undefined}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{n.icon}</svg>
          {n.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      {staff && (
        <form method="post" action="/auth/logout" className="clock" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="eyebrow">Signed in</div>
          <div className="small">{staff.name}</div>
          <div className="clock-btns"><button>Log out</button></div>
        </form>
      )}
      {!live && (
        <div className="clock">
          <div className="eyebrow">Prototype clock</div>
          <div className="small num">
            {new Date(now).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="clock-btns">
            <button onClick={() => shift(1)}>+1 hour</button>
            <button onClick={() => shift(24)}>+1 day</button>
            <button
              onClick={() => { if (confirm("Reset all prototype data back to the sample data?")) reset(); }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
