"use client";

import { useRef, useState } from "react";
import { FormRunner } from "@/components/FormRunner";
import { readAttribution } from "@/lib/engine";
import { samePhone } from "@/lib/phone";
import { StoreProvider, useStore } from "@/lib/store";
import { Form } from "@/lib/types";

function Frame({ form, onSubmit, bookHref, note, children }: { form: Form; onSubmit: (answers: Record<string, string>) => void; bookHref?: string; note?: string; children?: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <FormRunner form={form} onSubmit={onSubmit} bookHref={bookHref} note={note} style={{ width: "100%", maxWidth: 480, minHeight: "min(720px, calc(100vh - 32px))" }} />
      {children}
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Live: answers go to the server, which creates the contact with its ad.
 * `token` (from the server, when the page loaded) lets it tell people from
 * bots; the hidden "website" field is a trap only bots fill in.
 */
export function PublicForm({ form, token }: { form: Form; token: string }) {
  const [bookHref, setBookHref] = useState<string>();
  const [note, setNote] = useState<string>();
  const trap = useRef<HTMLInputElement>(null);
  const onSubmit = async (answers: Record<string, string>) => {
    // A personalised link (?c=<contact id>) says who this is, e.g. the accountability commitment form sent to a member.
    const contactId = new URLSearchParams(window.location.search).get("c") ?? undefined;
    const body = JSON.stringify({ answers, utm: readAttribution(window.location.search), token, hp: trap.current?.value ?? "", contactId });
    const send = () => fetch(`/api/forms/${form.slug}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await send().catch(() => null);
      if (res?.ok || (res && res.status !== 425 && res.status < 500)) break;
      // Too quick for the spam check: wait the few seconds left, then send again.
      // Otherwise a network blip: try again straight away.
      const tooFast = res?.status === 425 ? ((await res.json().catch(() => null)) as { waitMs?: number } | null) : null;
      if (tooFast?.waitMs) await wait(Math.min(tooFast.waitMs + 250, 10000));
    }
    const json = res ? ((await res.json().catch(() => null)) as { contactId?: string; error?: string } | null) : null;
    if (!res?.ok) setNote(json?.error && json.error !== "too_fast" ? json.error : "We couldn’t save your answers. Please check your connection and try again.");
    else if (json?.contactId && form.bookButton) setBookHref(`/book/${json.contactId}`);
  };
  return (
    <Frame form={form} onSubmit={onSubmit} bookHref={bookHref} note={note}>
      {/* Trap for bots: hidden from people and screen readers. */}
      <input ref={trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }} />
    </Frame>
  );
}

function LocalForm({ slug }: { slug: string }) {
  const { s, act } = useStore();
  const [phone, setPhone] = useState<string>();
  const form = s.forms.find((f) => f.slug === slug);
  if (!form) return <div className="loading">We can’t find that form.</div>;
  const contact = phone ? s.contacts.find((c) => samePhone(c.phone, phone)) : undefined;
  const onSubmit = (answers: Record<string, string>) => {
    act("submitForm", form.id, answers, readAttribution(window.location.search));
    setPhone(answers[form.questions.find((q) => q.field === "phone")?.id ?? ""]);
  };
  return <Frame form={form} onSubmit={onSubmit} bookHref={contact ? `/book/${contact.id}` : undefined} />;
}

/** Local prototype: the form runs against the sample data in this browser. */
export function LocalPublicForm({ slug }: { slug: string }) {
  return (
    <StoreProvider local>
      <LocalForm slug={slug} />
    </StoreProvider>
  );
}
