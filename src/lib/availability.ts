// Which free-trial slots people can book themselves, from the calendar's
// opening hours (UK time) and what's already booked. Pure, so the booking
// page and the server's final check agree.

import { ukTime } from "./time";
import { Appointment, CalendarDef } from "./types";

export interface Slot { start: string; free: boolean }
export interface Day { key: string; label: string; slots: Slot[] }

const UK = "Europe/London";

export function bookableDays(cal: CalendarDef, appts: Appointment[], now: number): Day[] {
  const av = cal.availability;
  if (!av) return [];
  const earliest = now + av.minNoticeHours * 3600e3;
  const taken = appts.filter((a) => a.calendarId === cal.id && (a.status === "booked" || a.status === "confirmed"));
  const days: Day[] = [];
  // Today plus daysAhead days: 7 means up to the same day next week.
  for (let i = 0; i <= av.daysAhead; i++) {
    const noon = ukTime(now, i, 12);
    const weekday = noon.getUTCDay(); // noon in the UK is the same day in UTC
    const slots: Slot[] = [];
    for (const [from, to] of av.hours[weekday] ?? []) {
      const [fh, fm] = from.split(":").map(Number);
      const [th, tm] = to.split(":").map(Number);
      for (let m = fh * 60 + fm; m + av.slotMin <= th * 60 + tm; m += av.slotMin) {
        const start = ukTime(now, i, Math.floor(m / 60), m % 60).getTime();
        if (start < earliest) continue;
        const end = start + av.slotMin * 60e3;
        const booked = taken.filter((a) => Date.parse(a.start) < end && Date.parse(a.end) > start).length;
        slots.push({ start: new Date(start).toISOString(), free: booked < av.capacity });
      }
    }
    if (slots.length) {
      days.push({
        key: noon.toLocaleDateString("en-CA", { timeZone: UK }),
        label: noon.toLocaleDateString("en-GB", { timeZone: UK, weekday: "long", day: "numeric", month: "long" }),
        slots,
      });
    }
  }
  return days;
}

export const isBookable = (cal: CalendarDef, appts: Appointment[], start: string, now: number) =>
  bookableDays(cal, appts, now).some((d) => d.slots.some((s) => s.free && s.start === start));

/** "Tuesday 30 September at 6:00 pm", in UK time. */
export const slotLabel = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: UK, weekday: "long", day: "numeric", month: "long" });
  return `${day} at ${slotTime(iso)}`;
};

export const slotTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: UK, hour: "numeric", minute: "2-digit", hour12: true });
