// Timezone helpers. Everything is stored as UTC ISO strings and shown in UK time.
import { GYM } from "./config";

const TZ = GYM.timezone;

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type LocalParts = { y: number; m: number; d: number; h: number; min: number; dow: number };

export function localParts(date: Date): LocalParts {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour,
    min: +p.minute,
    dow: WEEKDAYS.indexOf(p.weekday),
  };
}

function offsetMinutes(date: Date): number {
  const p = localParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, date.getUTCSeconds());
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Converts a UK wall-clock time to a real instant. */
export function localToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const off = offsetMinutes(new Date(guess));
  let t = guess - off * 60000;
  const off2 = offsetMinutes(new Date(t));
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}

/** YYYY-MM-DD in UK time. */
export function dateKey(date: Date): string {
  const p = localParts(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

export function addDaysKey(key: string, days: number): string {
  const { y, m, d } = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing `key`. */
export function startOfWeekKey(key: string): string {
  const dow = weekdayOfKey(key);
  return addDaysKey(key, dow === 0 ? -6 : 1 - dow);
}

/** Start of a UK calendar day as a UTC instant. */
export function dayStart(key: string): Date {
  const { y, m, d } = parseKey(key);
  return localToUtc(y, m, d, 0, 0);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const dateTimeFmt = fmt({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso)).replace(" ", "");
export const formatDay = (iso: string | Date) => dayFmt.format(new Date(iso));
export const formatShortDay = (iso: string | Date) => shortFmt.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTimeFmt.format(new Date(iso));
export const formatSlot = (iso: string | Date) => `${formatDay(iso)} at ${formatTime(iso)}`;

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const v =
    a < 60 ? `${a}s` : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : `${Math.round(a / 86400)}d`;
  return future ? `in ${v}` : `${v} ago`;
}

/** Push a send time out of quiet hours (21:00–08:00 UK) to 09:00. */
export function outsideQuietHours(date: Date): Date {
  const p = localParts(date);
  if (p.h >= 21) {
    const next = addDaysKey(dateKey(date), 1);
    const { y, m, d } = parseKey(next);
    return localToUtc(y, m, d, 9, 0);
  }
  if (p.h < 8) return localToUtc(p.y, p.m, p.d, 9, 0);
  return date;
}
