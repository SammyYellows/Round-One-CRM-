"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The buttons at the top of a screen that holds two views under one menu
// item (Sammy, 14/10/2026): Pipeline (Meta | TeamUp) and Program members
// (Program | All members). Styled like the Enquiries buttons.
export function PageTabs({ label, tabs }: { label: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="enq-tabs" aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`btn ${path === t.href ? "btn-red" : "btn-ghost"}`} aria-current={path === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const PIPELINE_TABS = [{ href: "/pipeline", label: "Meta" }, { href: "/pipeline/teamup", label: "TeamUp" }];
export const MEMBER_TABS = [{ href: "/program", label: "Program" }, { href: "/members", label: "All members" }];
