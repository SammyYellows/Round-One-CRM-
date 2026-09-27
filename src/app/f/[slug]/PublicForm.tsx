"use client";

import { useState } from "react";
import { FormRunner } from "@/components/FormRunner";
import { readAttribution } from "@/lib/engine";
import { samePhone } from "@/lib/phone";
import { StoreProvider, useStore } from "@/lib/store";
import { Form } from "@/lib/types";

function Frame({ form, onSubmit, bookHref, note }: { form: Form; onSubmit: (answers: Record<string, string>) => void; bookHref?: string; note?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <FormRunner form={form} onSubmit={onSubmit} bookHref={bookHref} note={note} style={{ width: "100%", maxWidth: 480, minHeight: "min(720px, calc(100vh - 32px))" }} />
    </div>
  );
}

/** Live: answers go to the server, which creates the contact with its ad. */
export function PublicForm({ form }: { form: Form }) {
  const [bookHref, setBookHref] = useState<string>();
  const [note, setNote] = useState<string>();
  const onSubmit = async (answers: Record<string, string>) => {
    const body = JSON.stringify({ answers, utm: readAttribution(window.location.search) });
    const send = () => fetch(`/api/forms/${form.slug}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    // One retry, so a brief network blip doesn't lose a lead.
    let res = await send().catch(() => null);
    if (!res?.ok) res = await send().catch(() => null);
    const json = res?.ok ? ((await res.json().catch(() => null)) as { contactId?: string } | null) : null;
    if (!res?.ok) setNote("We couldn’t save your answers. Please check your connection and try again.");
    else if (json?.contactId) setBookHref(`/book/${json.contactId}`);
  };
  return <Frame form={form} onSubmit={onSubmit} bookHref={bookHref} note={note} />;
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
