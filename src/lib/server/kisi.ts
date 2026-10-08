// Kisi door access, read-only (docs/accountability.md step 6). Kisi tells
// us when a member actually came through the door, which catches open-gym
// sessions TeamUp never sees. Needs KISI_API_KEY (an organisation-owner
// key, Kisi → Settings → API). Without it, nothing is read and attendance
// comes from TeamUp classes alone. Server-only.
//
// Kisi's API (api.kisi.io): Authorization "KISI-LOGIN <key>"; members are
// looked up by email; unlock events are reported per actor. The exact
// event filters are checked against the live account once the key exists
// (see docs/accountability.md).

const BASE = "https://api.kisi.io";

export const kisiConfigured = () => Boolean(process.env.KISI_API_KEY);

async function get(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `KISI-LOGIN ${process.env.KISI_API_KEY}`, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Kisi ${res.status} for ${url.pathname}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Kisi's member id for an email address, or null if they're not in Kisi. */
export async function kisiMemberId(email: string): Promise<string | null> {
  if (!email) return null;
  const rows = (await get("/members", { query: email, limit: "5" })) as { id?: number | string; email?: string; user?: { email?: string } }[];
  const hit = (rows ?? []).find((m) => (m.email ?? m.user?.email ?? "").toLowerCase() === email.toLowerCase());
  return hit?.id !== undefined ? String(hit.id) : null;
}

export interface DoorEntry { at: string; door?: string }

/** Successful unlocks by this member since `sinceMs`. */
export async function kisiEntries(memberId: string, sinceMs: number): Promise<DoorEntry[]> {
  const out: DoorEntry[] = [];
  let offset = 0;
  for (;;) {
    const rows = (await get("/events", { actor_type: "Member", actor_id: memberId, type: "unlock", limit: "200", offset: String(offset), since: new Date(sinceMs).toISOString() })) as { created_at?: string; success?: boolean; lock_name?: string; object_name?: string }[];
    if (!rows?.length) break;
    for (const r of rows) {
      if (r.success === false || !r.created_at) continue;
      if (Date.parse(r.created_at) < sinceMs) continue;
      out.push({ at: new Date(r.created_at).toISOString(), door: r.lock_name ?? r.object_name });
    }
    if (rows.length < 200) break;
    offset += 200;
  }
  return out;
}
