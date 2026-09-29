// Keeps bots off the public trial form, with no outside service:
// - a signed start time, given out when the form page loads, so answers that
//   come back faster than a person could type them are refused;
// - a hidden "trap" field that people never see but form-filling bots do;
// - a limit on how often one connection, or one mobile number, can submit.
// Server-only.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./supabase";

/** No one answers all the questions faster than this. */
export const MIN_FORM_SECONDS = 8;
const PER_IP_PER_HOUR = 10; // a gym's wifi can have a few people on it
const PER_PHONE_PER_HOUR = 5;

// Derived from the server's secret key, so there's no extra setting to manage.
const key = () => createHash("sha256").update(`form-guard:${process.env.SUPABASE_SECRET_KEY ?? ""}`).digest();
const sign = (text: string) => createHmac("sha256", key()).update(text).digest("base64url");

/** Given to the form page when it loads: "<time>.<signature>". */
export function issueFormToken(slug: string, now = Date.now()) {
  return `${now}.${sign(`${slug}:${now}`)}`;
}

export type TokenCheck = { ok: true } | { ok: false; reason: "invalid" } | { ok: false; reason: "too_fast"; waitMs: number };

export function checkFormToken(token: unknown, slug: string, now = Date.now()): TokenCheck {
  if (typeof token !== "string") return { ok: false, reason: "invalid" };
  const [ts, sig] = token.split(".");
  const expected = Buffer.from(sign(`${slug}:${ts}`));
  const given = Buffer.from(sig ?? "");
  if (!/^\d+$/.test(ts ?? "") || given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  const waitMs = Number(ts) + MIN_FORM_SECONDS * 1000 - now;
  return waitMs > 0 ? { ok: false, reason: "too_fast", waitMs } : { ok: true };
}

const hashIp = (ip: string) => createHash("sha256").update(`ip:${ip}`).update(key()).digest("hex");

/** The caller's address, from Vercel's headers. Only a hash of it is stored. */
export function clientIp(req: Request) {
  return (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "unknown";
}

/**
 * Records this attempt and says whether it's over the limit. Rows older than
 * a day are cleared as it goes.
 */
export async function overLimit(ip: string, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const ipHash = hashIp(ip);
  const digits = phone.replace(/\D/g, "");
  const [byIp, byPhone] = await Promise.all([
    db().from("form_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", since),
    digits
      ? db().from("form_attempts").select("id", { count: "exact", head: true }).eq("phone", digits).gte("at", since)
      : Promise.resolve({ count: 0 }),
  ]);
  await db().from("form_attempts").insert({ ip_hash: ipHash, phone: digits || null });
  await db().from("form_attempts").delete().lt("at", new Date(Date.now() - 86400e3).toISOString());
  return (byIp.count ?? 0) >= PER_IP_PER_HOUR || (byPhone.count ?? 0) >= PER_PHONE_PER_HOUR;
}
