"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: "▦" },
  { href: "/admin/calendar", label: "Calendar", icon: "▤" },
  { href: "/admin/pipeline", label: "Opportunities", icon: "▥" },
  { href: "/admin/leads", label: "Contacts", icon: "☺" },
  { href: "/admin/automations", label: "Automation", icon: "⚡" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav>
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""}>
            <span style={{ width: 16, textAlign: "center" }}>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
