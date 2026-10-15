// Weekly reminders on the to-do list (Sammy, 15/10/2026: "add it to the to-do
// lists from November, a reminder once a week to improve it"). Kept in the
// `reminders` setting as data: each has its words, a weekday and a first date.
// From /api/cron: on that weekday from 09:00 UK, the week's to-do goes on Needs
// you. Last week's, if nobody ticked it, is ticked off, so there's only ever
// one and it comes back to the top each week. Nothing is sent to anyone.

import { addTask, completeTask } from "@/lib/engine";
import { ukParts } from "@/lib/time";
import { applyMany } from "./state";
import { db } from "./supabase";

export interface Reminder {
  id: string; // also starts each week's task id, so a week is added once only
  text: string;
  weekday: number; // 0 = Sunday, 1 = Monday…
  from: string; // YYYY-MM-DD (UK): nothing before this
  until?: string; // YYYY-MM-DD (UK): nothing after this
  lastAt?: string; // the UK date it was last added
}

export async function remindersTick(now = Date.now()) {
  const { data } = await db().from("settings").select("value").eq("id", "reminders").maybeSingle();
  const list = ((data?.value as { list?: Reminder[] } | null)?.list ?? []);
  const today = ukParts(now);
  const due = list.filter((r) =>
    r.weekday === today.weekday && today.hour >= 9 && today.date >= r.from && (!r.until || today.date <= r.until) && (r.lastAt ?? "") < today.date);
  if (!due.length) return { added: [] as string[] };
  await applyMany((s) => {
    for (const r of due) {
      for (const t of s.tasks) if (!t.done && t.id.startsWith(`${r.id}:`)) completeTask(s, t.id);
      addTask(s, { id: `${r.id}:${today.date}`, text: r.text });
    }
  });
  const next = list.map((r) => (due.includes(r) ? { ...r, lastAt: today.date } : r));
  await db().from("settings").upsert({ id: "reminders", value: { list: next }, updated_at: new Date().toISOString() });
  return { added: due.map((r) => r.id) };
}
