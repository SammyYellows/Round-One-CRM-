// UK time helpers. The server runs in UTC, so "18:00 tomorrow" has to be
// worked out in Europe/London explicitly, not with the machine's local time.

const TZ = "Europe/London";

function offsetMinutes(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The UK calendar date `days` after `fromMs`, at hour:minute UK time. */
export function ukTime(fromMs: number, days: number, hour: number, minute = 0) {
  const d = new Date(fromMs + offsetMinutes(fromMs) * 60000); // UK wall clock, read via UTC getters
  const guess = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, hour, minute);
  let t = guess - offsetMinutes(guess) * 60000;
  const again = guess - offsetMinutes(t) * 60000;
  if (again !== t) t = again;
  return new Date(t);
}

/** The UK wall-clock parts of a moment: weekday (0 = Sunday), hour, and the date as YYYY-MM-DD. */
export function ukParts(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { weekday, hour: +p.hour, minute: +p.minute, date: `${p.year}-${p.month}-${p.day}` };
}

/** Monday 00:00 UK of the week containing `ms`. */
export function ukWeekStart(ms: number) {
  const { weekday } = ukParts(ms);
  const back = (weekday + 6) % 7; // days since Monday
  return ukTime(ms, -back, 0, 0);
}
