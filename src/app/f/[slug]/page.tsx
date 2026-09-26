"use client";

import { useParams } from "next/navigation";
import { FormRunner } from "@/components/FormRunner";
import { readAttribution, submitForm } from "@/lib/engine";
import { useStore } from "@/lib/store";

// The public form people reach from an ad or the website. No sidebar.
// Try the demo link on Forms: it carries campaign, ad set and ad like a real Meta ad would.

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { s, act } = useStore();
  const form = s.forms.find((f) => f.slug === slug);

  if (!form) {
    return <div className="loading">We can’t find that form.</div>;
  }

  const onSubmit = (answers: Record<string, string>) => {
    const utm = readAttribution(window.location.search);
    act((d) => submitForm(d, form.id, answers, utm));
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <FormRunner form={form} onSubmit={onSubmit} style={{ width: "100%", maxWidth: 480, minHeight: "min(720px, calc(100vh - 32px))" }} />
    </div>
  );
}
