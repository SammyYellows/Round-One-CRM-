import { notFound } from "next/navigation";
import { db } from "@/lib/server/supabase";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Form } from "@/lib/types";
import { LocalPublicForm, PublicForm } from "./PublicForm";

// The public form people reach from an ad or the website. No sidebar, no login.
// Try the demo link on Forms: it carries campaign, ad set and ad like a real Meta ad would.
export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  if (!supabaseConfigured()) return <LocalPublicForm slug={params.slug} />;
  const { data } = await db().from("forms").select("id, slug, name, questions, thanks, responses").eq("slug", params.slug).maybeSingle();
  if (!data) notFound();
  return <PublicForm form={data as Form} />;
}
