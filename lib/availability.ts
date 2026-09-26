import { AVAILABILITY } from "./config";
import { db } from "./db";
import { addDaysKey, dateKey, parseKey, localToUtc, weekdayOfKey } from "./time";

export type Slot = { start: string; end: string; available: boolean };
export type Day = { key: string; slots: Slot[] };

function bookedCounts(fromIso: string, toIso: string): Map<string, number> {
  const rows = db()
    .prepare(
      "SELECT starts_at, COUNT(*) AS n FROM appointments WHERE status IN ('booked','confirmed') AND starts_at >= ? AND starts_at < ? GROUP BY starts_at",
    )
    .all(fromIso, toIso) as { starts_at: string; n: number }[];
  return new Map(rows.map((r) => [r.starts_at, r.n]));
}

/** Bookable consultation slots for the next N days, grouped by UK day. */
export function availableDays(now = new Date(), days = AVAILABILITY.daysAhead): Day[] {
  const earliest = now.getTime() + AVAILABILITY.minNoticeHours * 3600_000;
  const todayKey = dateKey(now);
  const result: Day[] = [];
  const counts = bookedCounts(now.toISOString(), new Date(now.getTime() + (days + 1) * 86400_000).toISOString());

  for (let i = 0; i < days; i++) {
    const key = addDaysKey(todayKey, i);
    const { y, m, d } = parseKey(key);
    const slots: Slot[] = [];
    for (const [from, to] of AVAILABILITY.hours[weekdayOfKey(key)] ?? []) {
      const [fh, fm] = from.split(":").map(Number);
      const [th, tm] = to.split(":").map(Number);
      for (let mins = fh * 60 + fm; mins + AVAILABILITY.slotMinutes <= th * 60 + tm; mins += AVAILABILITY.slotMinutes) {
        const start = localToUtc(y, m, d, Math.floor(mins / 60), mins % 60);
        if (start.getTime() < earliest) continue;
        const iso = start.toISOString();
        slots.push({
          start: iso,
          end: new Date(start.getTime() + AVAILABILITY.slotMinutes * 60000).toISOString(),
          available: (counts.get(iso) ?? 0) < AVAILABILITY.capacityPerSlot,
        });
      }
    }
    if (slots.length) result.push({ key, slots });
  }
  return result;
}

export function isSlotAvailable(startIso: string, now = new Date()): boolean {
  return availableDays(now).some((d) => d.slots.some((s) => s.start === startIso && s.available));
}
