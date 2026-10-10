"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Rich } from "@/components/Rich";
import { useIsManager } from "@/components/StaffContext";
import { MANUAL } from "@/lib/manual";

export default function ManualSectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const manager = useIsManager();
  const sections = MANUAL.filter((m) => manager || m.who === "everyone");
  const i = sections.findIndex((m) => m.slug === slug);
  const m = sections[i];
  if (!m) return <div className="card empty">That page isn’t in the manual. <Link href="/manual">All pages</Link></div>;
  const prev = sections[i - 1], next = sections[i + 1];
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link href="/manual">Manual</Link> · {i + 1} of {sections.length}</div>
          <h1 className="h h1">{m.title}</h1>
        </div>
      </header>
      <section className="card pad" style={{ maxWidth: 820, fontSize: 15, lineHeight: 1.6 }}>
        <Rich text={m.body} />
      </section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, maxWidth: 820, flexWrap: "wrap" }}>
        {prev ? <Link href={`/manual/${prev.slug}`} className="btn btn-ghost btn-sm">‹ {prev.title}</Link> : <span />}
        {next ? <Link href={`/manual/${next.slug}`} className="btn btn-ghost btn-sm">{next.title} ›</Link> : <span />}
      </div>
    </>
  );
}
