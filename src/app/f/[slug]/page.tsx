import { notFound } from "next/navigation";
import { issueFormToken } from "@/lib/server/spam";
import { db } from "@/lib/server/supabase";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Form } from "@/lib/types";
import { LocalPublicForm, PublicForm } from "./PublicForm";

// The public form people reach from an ad or the website. No sidebar, no login.
// Try the demo link on Forms: it carries campaign, ad set and ad like a real Meta ad would.
export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  if (!supabaseConfigured()) return <LocalPublicForm slug={params.slug} />;
  const { data } = await db().from("forms").select("id, slug, name, questions, thanks, thanks_title, book_button").eq("slug", params.slug).maybeSingle();
  if (!data) notFound();
  const form: Form = {
    id: data.id, slug: data.slug, name: data.name, questions: data.questions, thanks: data.thanks, responses: 0,
    thanksTitle: data.thanks_title ?? undefined, bookButton: data.book_button ?? undefined,
  };
  // The consent line appears once the privacy page exists (Vercel setting PRIVACY_URL).
  return <PublicForm form={form} token={issueFormToken(form.slug)} privacyUrl={process.env.PRIVACY_URL || undefined} />;
}
