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
