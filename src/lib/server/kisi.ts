// Kisi door access, read-only (docs/accountability.md step 6). Kisi tells
// us when a member actually came through the door, which catches open-gym
// sessions TeamUp never sees. Needs KISI_API_KEY (an organisation-owner
// key, Kisi → account → API). Without it, nothing is read and attendance
// comes from TeamUp classes alone. Server-only.
//
// Checked against the live account on 09/10/2026: members are looked up by
// email (`/members?query=`), and history comes from an "event set" you
// create with filters (`POST /event_sets`, finished at once for small
// ranges, at most 90 days wide) and page with `cursor`. Successful door
// entries are events of type `lock.unlock` with `success: true`.

const BASE = "https://api.kisi.io";

export const kisiConfigured = () => Boolean(process.env.KISI_API_KEY);

const headers = () => ({ Authorization: `KISI-LOGIN ${process.env.KISI_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" });

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Kisi ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Kisi's user id for an email address (events are keyed by user), or null if they're not in Kisi. */
export async function kisiMemberId(email: string): Promise<string | null> {
  if (!email) return null;
  const rows = (await call(`/members?query=${encodeURIComponent(email)}&limit=5`)) as { user_id?: number; user?: { id?: number; email?: string } }[];
  const hit = (rows ?? []).find((m) => (m.user?.email ?? "").toLowerCase() === email.toLowerCase());
  const id = hit?.user_id ?? hit?.user?.id;
  return id !== undefined ? String(id) : null;
}

export interface DoorEntry { at: string; door?: string }

type EventSet = { id: number; status: "in_progress" | "finished" | "failed"; cursor?: string | null; events?: { type: string; success?: boolean; created_at: string; object_name?: string }[] };

/** Successful door entries by this user since `sinceMs` (at most 90 days back). */
export async function kisiEntries(userId: string, sinceMs: number): Promise<DoorEntry[]> {
  const from = new Date(Math.max(sinceMs, Date.now() - 89 * 86400e3)).toISOString();
  const to = new Date().toISOString();
  let set = (await call("/event_sets", { method: "POST", body: JSON.stringify({ event_set: { interval: `${from}/${to}`, event_actor_id: Number(userId), event_actor_type: "User", event_type: "lock.unlock", event_success: true } }) })) as EventSet;
  for (let i = 0; i < 10 && set.status === "in_progress"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    set = (await call(`/event_sets/${set.id}`)) as EventSet;
  }
  if (set.status !== "finished") throw new Error(`Kisi event set ${set.id} ${set.status}`);
  const out: DoorEntry[] = [];
  let page: EventSet = set;
  for (let n = 0; n < 20; n++) {
    for (const e of page.events ?? []) if (e.type === "lock.unlock" && e.success !== false) out.push({ at: new Date(e.created_at).toISOString(), door: e.object_name });
    if (!page.cursor || !(page.events?.length)) break;
    page = (await call(`/event_sets/${set.id}?limit=200&cursor=${encodeURIComponent(page.cursor)}`)) as EventSet;
    if (page.cursor === set.cursor && n > 0) break;
  }
  return out;
}
