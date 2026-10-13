// "Save our number" (Sammy, 13/10/2026): the page the new-number WhatsApp
// and email link to. Public, no login. One tap saves the contact card; the
// other opens a WhatsApp chat with the gym.

import type { Metadata } from "next";
import { GYM } from "@/lib/gym";

export const metadata: Metadata = { title: "Save our number | Round One" };

export default function ContactPage() {
  const wa = `https://wa.me/${GYM.whatsapp.replace(/\D/g, "")}`;
  return (
    <main className="unsub">
      <div className="unsub-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt={GYM.name} width={96} style={{ display: "block", height: "auto" }} />
      </div>
      <div className="unsub-box">
        <h1 className="h h2">Save our number</h1>
        <p>Round One has a new WhatsApp number: <strong>{GYM.whatsappDisplay}</strong>. Save it so you can reach us about classes, bookings and your membership.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a className="btn btn-red" href="/contact.vcf">Save to contacts</a>
          <a className="btn btn-ghost contact-ghost" href={wa}>Message us on WhatsApp</a>
        </div>
        <dl className="contact-list">
          <div><dt>WhatsApp</dt><dd>{GYM.whatsappDisplay}</dd></div>
          <div><dt>Phone</dt><dd>{GYM.phoneDisplay}</dd></div>
          <div><dt>Email</dt><dd>{GYM.email}</dd></div>
          <div><dt>Address</dt><dd>{GYM.address}</dd></div>
        </dl>
      </div>
    </main>
  );
}
