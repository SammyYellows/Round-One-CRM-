"use client";

import { FormRunner } from "@/components/FormRunner";
import { readAttribution } from "@/lib/engine";
import { StoreProvider, useStore } from "@/lib/store";
import { Form } from "@/lib/types";

function Frame({ form, onSubmit }: { form: Form; onSubmit: (answers: Record<string, string>) => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <FormRunner form={form} onSubmit={onSubmit} style={{ width: "100%", maxWidth: 480, minHeight: "min(720px, calc(100vh - 32px))" }} />
    </div>
  );
}

/** Live: answers go to the server, which creates the contact with its ad. */
export function PublicForm({ form }: { form: Form }) {
  const onSubmit = async (answers: Record<string, string>) => {
    const body = JSON.stringify({ answers, utm: readAttribution(window.location.search) });
    const send = () => fetch(`/api/forms/${form.slug}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    // One retry, so a brief network blip doesn't lose a lead.
    const res = await send().catch(() => null);
    if (!res?.ok) await send().catch((e) => console.error("Form not saved", e));
  };
  return <Frame form={form} onSubmit={onSubmit} />;
}

function LocalForm({ slug }: { slug: string }) {
  const { s, act } = useStore();
  const form = s.forms.find((f) => f.slug === slug);
  if (!form) return <div className="loading">We can’t find that form.</div>;
  return <Frame form={form} onSubmit={(answers) => act("submitForm", form.id, answers, readAttribution(window.location.search))} />;
}

/** Local prototype: the form runs against the sample data in this browser. */
export function LocalPublicForm({ slug }: { slug: string }) {
  return (
    <StoreProvider local>
      <LocalForm slug={slug} />
    </StoreProvider>
  );
}
