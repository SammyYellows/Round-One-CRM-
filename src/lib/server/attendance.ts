// Attendance from TeamUp for the accountability programme: one member's
// class bookings with their event times (TeamUp's /attendances takes a
// customer filter and can expand the event; it ignores date filters, so
// the cut-off is applied here). Server-only.

import { fetchJson } from "./teamup";

export interface Attended { at: string; status: string; event: string }

export async function fetchAttendance(customerId: string, sinceMs: number): Promise<Attended[]> {
  const out: Attended[] = [];
  let url: string | null = `/attendances?customer=${encodeURIComponent(customerId)}&expand=event&page_size=100`;
  while (url) {
    const page = (await fetchJson(url)) as { results?: Record<string, unknown>[]; next?: string | null };
    for (const r of page.results ?? []) {
      const ev = (r.event && typeof r.event === "object" ? r.event : {}) as Record<string, unknown>;
      const at = typeof ev.starts_at === "string" ? ev.starts_at : "";
      if (!at || Date.parse(at) < sinceMs) continue;
      out.push({ at: new Date(at).toISOString(), status: String(r.status ?? ""), event: String(ev.name ?? "") });
    }
    url = page.next ? page.next.replace(/^https:\/\/goteamup\.com\/api\/v2/, "") : null;
  }
  return out;
}
