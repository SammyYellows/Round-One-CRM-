export function ago(iso: string, now: number) {
  const diff = now - Date.parse(iso);
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60e3);
  let out: string;
  if (m < 1) return "just now";
  if (m < 60) out = `${m} min`;
  else if (m < 60 * 24) out = `${Math.round(m / 60)}h`;
  else out = `${Math.round(m / 1440)}d`;
  return future ? `in ${out}` : `${out} ago`;
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const dayTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

export const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export const gbp = (n: number, dp = 0) =>
  "£" + n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const isSameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

// For <input type="datetime-local">, which wants local time without a zone.
export function toLocalInput(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
