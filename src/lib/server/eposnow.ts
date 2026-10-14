// Epos Now, the till (Sammy, 14/10/2026). Read only: the CRM never changes
// anything on the till. Basic auth with the API key and secret from the
// Back Office (Apps → API → Access Credentials), kept in Vercel as
// EPOSNOW_API_KEY and EPOSNOW_API_SECRET. Server-only.

const BASE = "https://api.eposnowhq.com/api";

export const eposConfigured = () => Boolean(process.env.EPOSNOW_API_KEY && process.env.EPOSNOW_API_SECRET);

const auth = () => "Basic " + Buffer.from(`${process.env.EPOSNOW_API_KEY}:${process.env.EPOSNOW_API_SECRET}`).toString("base64");

export async function eposGet(path: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: auth(), Accept: "application/json" }, cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { ok: res.ok, status: res.status, json };
}

type Row = Record<string, unknown>;
const rows = (j: unknown): Row[] => (Array.isArray(j) ? (j as Row[]) : Array.isArray((j as { Data?: unknown })?.Data) ? ((j as { Data: Row[] }).Data) : []);
const has = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== 0;

/**
 * Can the CRM read the till, and what's there? Counts and field names only,
 * never anyone's details, so it's safe to show while setting up.
 */
export async function eposCheck() {
  if (!eposConfigured()) return { error: "EPOSNOW_API_KEY and EPOSNOW_API_SECRET aren’t set in Vercel" };
  const out: Record<string, unknown> = {};
  for (const v of ["V2", "V4"]) {
    const [tx, cu, pr] = await Promise.all([eposGet(`${v}/Transaction?page=1`), eposGet(`${v}/Customer?page=1`), eposGet(`${v}/Product?page=1`)]);
    const t = rows(tx.json), c = rows(cu.json), p = rows(pr.json);
    const dates = t.map((x) => String(x.DateTime ?? x.TransactionDate ?? x.Date ?? "")).filter(Boolean).sort();
    out[v] = {
      transactions: { status: tx.status, onFirstPage: t.length, withCustomer: t.filter((x) => has(x.CustomerId ?? x.CustomerID)).length, dates: dates.length ? [dates[0].slice(0, 10), dates[dates.length - 1].slice(0, 10)] : null, fields: t[0] ? Object.keys(t[0]) : null, error: tx.ok ? undefined : tx.json },
      customers: { status: cu.status, onFirstPage: c.length, withEmail: c.filter((x) => has(x.EmailAddress ?? x.Email)).length, fields: c[0] ? Object.keys(c[0]) : null, error: cu.ok ? undefined : cu.json },
      products: { status: pr.status, onFirstPage: p.length, error: pr.ok ? undefined : pr.json },
    };
    if (tx.ok) break; // V2 works: no need to try V4
  }
  return out;
}
