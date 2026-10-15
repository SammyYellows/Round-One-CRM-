// Changing a WhatsApp template's wording from the CRM (Sammy, 15/10/2026:
// pick from three versions). A template Meta hasn't seen yet is just
// rewritten. One Meta has (approved or waiting) can't be edited, so the
// chosen wording goes to Meta as a new version (name_v2, _v3…); the current
// one keeps sending until Meta approves it, then every automation and draft
// mailout using the old name switches over (`applyTemplateSwaps`, from
// /api/cron). Nothing here sends a message to anyone.

import { db } from "./supabase";
import { submitTemplates } from "./waTemplates";

export interface TemplateSwap { from: string; to: string; at: string; by: string; status: "submitted" | "rejected"; note?: string }

const KEY = "template_swaps";

export async function swaps(): Promise<TemplateSwap[]> {
  const { data } = await db().from("settings").select("value").eq("id", KEY).maybeSingle();
  return Array.isArray(data?.value) ? (data!.value as TemplateSwap[]) : [];
}
const saveSwaps = (list: TemplateSwap[]) => db().from("settings").upsert({ id: KEY, value: list, updated_at: new Date().toISOString() });

const waba = () => process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "";

/** Use `body` for template `name`: in place if Meta hasn't seen it, otherwise as a new version sent to Meta. */
export async function chooseWording(name: string, body: string, by: string) {
  const { data: row } = await db().from("templates").select("*").eq("name", name).maybeSingle();
  if (!row) return { error: "That template isn’t there any more" };
  if ((await swaps()).some((x) => x.from === name && x.status === "submitted")) return { error: "A new wording for this one is already with Meta. Wait for that first." };
  if (row.meta_status === "draft") {
    await db().from("templates").update({ body, updated_at: new Date().toISOString() }).eq("name", name);
    return { mode: "updated" as const, name };
  }
  if (!waba()) return { error: "The WhatsApp account isn’t set up on the server" };
  const base = name.replace(/_v\d+$/, "");
  const { data: names } = await db().from("templates").select("name").like("name", `${base}%`);
  const used = new Set((names ?? []).map((r) => r.name as string));
  let n = 2;
  while (used.has(`${base}_v${n}`)) n++;
  const to = `${base}_v${n}`;
  const { name: _old, updated_at: _u, meta_status: _m, ...rest } = row as Record<string, unknown>;
  const { error } = await db().from("templates").insert({ ...rest, name: to, body, meta_status: "draft", updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  const result = await submitTemplates(waba(), { only: [to] });
  const line = result.find((l) => l.startsWith(`${to}:`)) ?? "";
  if (/not submitted/i.test(line)) {
    await db().from("templates").delete().eq("name", to);
    return { error: `Meta didn’t take it: ${line.replace(`${to}: not submitted. `, "")}` };
  }
  await saveSwaps([...(await swaps()).filter((x) => x.from !== name), { from: name, to, at: new Date().toISOString(), by, status: "submitted" }]);
  return { mode: "submitted" as const, name: to };
}

/** From /api/cron: once Meta approves a new version, everything using the old one switches to it. */
export async function applyTemplateSwaps() {
  const list = await swaps();
  const waiting = list.filter((x) => x.status === "submitted");
  if (!waiting.length || !waba()) return { waiting: 0 };
  const lines = await submitTemplates(waba(), { only: waiting.map((x) => x.to), statusOnly: true });
  let switched = 0;
  for (const sw of waiting) {
    const line = lines.find((l) => l.startsWith(`${sw.to}:`)) ?? "";
    if (/: approved/.test(line)) {
      const { data: autos } = await db().from("automations").select("id, steps");
      for (const a of (autos ?? []) as { id: string; steps: { kind: string; template?: string }[] }[]) {
        if (!a.steps.some((st) => st.kind === "whatsapp" && st.template === sw.from)) continue;
        await db().from("automations").update({ steps: a.steps.map((st) => (st.kind === "whatsapp" && st.template === sw.from ? { ...st, template: sw.to } : st)) }).eq("id", a.id);
      }
      await db().from("mailouts").update({ template: sw.to }).eq("template", sw.from).eq("status", "draft");
      list.splice(list.indexOf(sw), 1);
      switched++;
    } else if (/: rejected/.test(line)) {
      sw.status = "rejected";
      sw.note = line.replace(`${sw.to}: `, "");
    }
  }
  await saveSwaps(list);
  return { waiting: waiting.length, switched };
}
