"use client";

import Link from "next/link";
import { useIsManager } from "@/components/StaffContext";
import { MANUAL } from "@/lib/manual";

// The staff manual (Sammy, 10/10/2026). Same text Champ reads.
export default function ManualPage() {
  const manager = useIsManager();
  const sections = MANUAL.filter((m) => manager || m.who === "everyone");
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">How to use the CRM · ask Champ if you can’t find it here</div>
          <h1 className="h h1">Manual</h1>
        </div>
      </header>
      <section className="card">
        {sections.map((m, i) => (
          <Link key={m.slug} href={`/manual/${m.slug}`} className="crow" style={{ gridTemplateColumns: "40px minmax(0, 1fr)", borderTop: i ? undefined : 0 }}>
            <div className="h" style={{ fontSize: 22, color: "var(--red)" }}>{i + 1}</div>
            <div>
              <div className="strong">{m.title}{m.who === "management" ? <span className="chip" style={{ height: 20, fontSize: 10, marginLeft: 8 }}>Management</span> : null}</div>
              <div className="small muted">{m.summary}</div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
