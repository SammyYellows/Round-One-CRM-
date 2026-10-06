// The win-back email's saved drafts (named versions staff can switch
// between) and an AI rewrite from an instruction. Drafts live in the
// settings table; the live wording is the automation's email step.

import { rewriteTemplate } from "@/lib/server/ai";
import { getFacts } from "@/lib/server/enquiries";
import { requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export interface WinBackDraft { id: string; name: string; subject: string; body: string; savedAt: string; savedBy: string }
const KEY = "winback_drafts";

async function load(): Promise<WinBackDraft[]> {
  const { data } = await db().from("settings").select("value").eq("id", KEY).maybeSingle();
  return Array.isArray(data?.value) ? (data!.value as WinBackDraft[]) : [];
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  return Response.json({ drafts: await load() });
}

type Body =
  | { action: "save"; id?: string; name: string; subject: string; body: string }
  | { action: "delete"; id: string }
  | { action: "rewrite"; subject: string; body: string; instruction: string };

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (b.action === "rewrite") {
    if (!b.instruction?.trim()) return Response.json({ ok: false, error: "Say what you’d like changed" }, { status: 400 });
    try {
      const out = await rewriteTemplate({ subject: b.subject ?? "", body: b.body ?? "", instruction: b.instruction.slice(0, 1000), facts: await getFacts(), purpose: "the day after a member gives notice to cancel, to see if anything would change their mind (win-back)" });
      if (!out.body) return Response.json({ ok: false, error: "The AI came back empty" }, { status: 400 });
      return Response.json({ ok: true, ...out });
    } catch (e) {
      return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }
  const drafts = await load();
  let next = drafts;
  if (b.action === "save") {
    const name = (b.name ?? "").trim().slice(0, 60);
    if (!name) return Response.json({ ok: false, error: "Give the draft a name" }, { status: 400 });
    const draft: WinBackDraft = { id: b.id ?? crypto.randomUUID(), name, subject: (b.subject ?? "").slice(0, 200), body: (b.body ?? "").slice(0, 20000), savedAt: new Date().toISOString(), savedBy: auth.staff.name };
    next = drafts.some((d) => d.id === draft.id) ? drafts.map((d) => (d.id === draft.id ? draft : d)) : [...drafts, draft].slice(-30);
  } else if (b.action === "delete") {
    next = drafts.filter((d) => d.id !== b.id);
  } else {
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
  const { error } = await db().from("settings").upsert({ id: KEY, value: next, updated_at: new Date().toISOString() });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, drafts: next });
}
