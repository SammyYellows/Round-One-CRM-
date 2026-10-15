// Where members come from (Sammy, 15/10/2026): active members counted by
// postcode area ("BS5"), taken from the address on their TeamUp form by the
// safety stage. Only the area is kept, never the address, and the map shows
// a circle per area, so no one's home is on it. Each area's centre comes from
// postcodes.io (free, UK; only the area is sent), cached in sync_payloads.

import { db } from "./supabase";

type Point = [number, number]; // lat, lng
const CACHE_KEY = "map:outcodes";

async function locate(areas: string[]): Promise<Record<string, Point | null>> {
  const { data } = await db().from("sync_payloads").select("value").eq("key", CACHE_KEY).maybeSingle();
  const cache = ((data?.value as Record<string, Point | null> | undefined) ?? {});
  const missing = areas.filter((a) => !(a in cache));
  if (missing.length) {
    await Promise.all(missing.map(async (a) => {
      const r = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(a)}`, { cache: "no-store" }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { result?: { latitude?: number; longitude?: number } } | null;
      // Unknown areas are remembered as null so we don't ask again; a failed request is retried next time.
      if (r?.ok && j?.result?.latitude != null && j.result.longitude != null) cache[a] = [j.result.latitude, j.result.longitude];
      else if (r?.status === 404) cache[a] = null;
    }));
    await db().from("sync_payloads").upsert({ key: CACHE_KEY, value: cache, updated_at: new Date().toISOString() });
  }
  return cache;
}

export async function memberMap() {
  const rows: { membership: { status?: string } | null; safety: { area?: string } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("contacts").select("membership, safety").is("removed", null).not("membership", "is", null).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const active = rows.filter((r) => r.membership?.status === "active");
  const counts = new Map<string, number>();
  for (const r of active) { const a = r.safety?.area; if (a) counts.set(a, (counts.get(a) ?? 0) + 1); }
  const where = await locate([...counts.keys()]);
  const areas = [...counts.entries()].map(([area, members]) => ({ area, members, at: where[area] ?? null })).sort((a, b) => b.members - a.members);
  return { activeMembers: active.length, withArea: areas.reduce((n, a) => n + a.members, 0), areas };
}
