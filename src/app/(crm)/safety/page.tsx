"use client";

import Link from "next/link";
import { useMemo } from "react";
import WhoIsIn from "@/components/WhoIsIn";
import { useStore } from "@/lib/store";

// Everyone without a waiver or emergency contact (improvement item 20).
// Reached from "List everyone" on the alert, not the sidebar (Sammy,
// 10/10/2026: at the start there'll be lots). Top: who's in the gym now,
// with "Spoke to them". Below: every active member with a gap, to work
// through. Fixes happen in TeamUp; the nightly sync clears them here.

export default function SafetyPage() {
  const { s, live } = useStore();
  const gaps = useMemo(
    () =>
      s.contacts
        .filter((c) => c.membership?.status === "active" && c.safety && (!c.safety.waiverSignedAt || !(c.safety.emergencyPhone || c.safety.emergencyName)))
        .sort((a, b) => Number(!!a.safety?.waiverSignedAt) - Number(!!b.safety?.waiverSignedAt) || a.name.localeCompare(b.name)),
    [s.contacts],
  );
  const noWaiver = gaps.filter((c) => !c.safety?.waiverSignedAt).length;
  const noEmergency = gaps.filter((c) => !(c.safety?.emergencyPhone || c.safety?.emergencyName)).length;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Waivers and emergency contacts, from TeamUp</div>
          <h1 className="h h1">Safety</h1>
        </div>
      </header>

      {live ? <WhoIsIn /> : <div className="card empty">The in-the-gym check needs the live CRM.</div>}

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "16px 22px 8px" }}>
          <div className="label" style={{ margin: 0 }}>Active members with something missing</div>
          <div className="small muted">{noWaiver} without a waiver · {noEmergency} without an emergency contact. Sort it in TeamUp next time they’re in; they drop off here after the nightly sync.</div>
        </div>
        <div className="crow thead">
          <div>Name</div><div>Membership</div><div>Waiver</div><div>Emergency contact</div><div /><div />
        </div>
        {gaps.map((c) => (
          <Link key={c.id} href={`/contacts/${c.id}`} className="crow">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{c.name}</div>
              <div className="faint num" style={{ fontSize: 12 }}>{c.phone || c.email}</div>
            </div>
            <div className="muted">{c.membership?.name}</div>
            <div>{c.safety?.waiverSignedAt ? <span className="muted small">Signed</span> : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>No waiver</span>}</div>
            <div className="small">{c.safety?.emergencyPhone || c.safety?.emergencyName ? <span className="muted">{c.safety.emergencyName ?? "On file"}</span> : <span className="chip chip-red" style={{ height: 20, fontSize: 10 }}>None</span>}</div>
            <div /><div />
          </Link>
        ))}
        {gaps.length === 0 && <div className="empty">{s.contacts.some((c) => c.safety) ? "Every active member has a waiver and an emergency contact." : "Nothing yet. This fills in after the nightly TeamUp sync."}</div>}
      </section>
    </>
  );
}
