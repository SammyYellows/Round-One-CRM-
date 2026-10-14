// The till's money, read from Epos Now (Sammy, 14/10/2026): takings, cash
// taken since the last cash-out, and the till's own past cash-ups. Read
// only. Epos Now gives times as UK wall clock. Server-only.

import { fromUkWallClock, toUkWallClock } from "@/lib/time";
import { eposConfigured, eposGet } from "./eposnow";

type Tx = { TransactionID: number; DeviceID: number; DateTime: string; Total: number; PaymentStatus?: string };
type Tender = { TransactionID: number; TypeID: number; Amount: number; Change: number };
export type EndOfDay = {
  EndOfDayID: number; TillName: string; OpenedBy: string; ClosedBy: string; StartDate: string; EndDate: string;
  PrevBal: number; Sales: number; PayOuts: number; PettyCash: number; FloatAdjust: number; CustomerCredits: number;
  Expected: number; Actual: number; Variance: number; Tenders: unknown;
};

const PAGE = 200;
const list = <T,>(j: unknown): T[] => (Array.isArray(j) ? (j as T[]) : []);
const q = (search: string) => `search=${encodeURIComponent(search)}`;

/** Every page of a V2 list (200 a page), up to `max` pages. */
async function allPages<T>(path: string, max = 30): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= max; page++) {
    const r = await eposGet(`${path}${path.includes("?") ? "&" : "?"}page=${page}`);
    if (!r.ok) throw new Error(`Epos Now said ${r.status}: ${JSON.stringify(r.json).slice(0, 160)}`);
    const rows = list<T>(r.json);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

let types: { at: number; names: Map<number, string> } | null = null;
/** Payment types by id: Cash, Card, Round1… (kept an hour). */
export async function tenderTypes() {
  if (types && Date.now() - types.at < 3600e3) return types.names;
  const rows = await allPages<{ TypeID: number; Name: string }>("V2/TenderType", 2);
  types = { at: Date.now(), names: new Map(rows.map((t) => [t.TypeID, t.Name])) };
  return types.names;
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Sales between two moments: how many, the total, each payment type, and
 * the cash that went into the till (cash paid minus change given).
 */
export async function takings(fromMs: number, toMs = Date.now()) {
  if (!eposConfigured()) throw new Error("Epos Now isn’t connected");
  const from = toUkWallClock(fromMs);
  const txs = (await allPages<Tx>(`V2/Transaction?${q(`(DateTime|>=|${from})`)}`))
    .filter((t) => { const at = fromUkWallClock(t.DateTime); return at >= fromMs && at < toMs; });
  const names = await tenderTypes();
  const byType: Record<string, number> = {};
  let cash = 0;
  if (txs.length) {
    const ids = new Set(txs.map((t) => t.TransactionID));
    const min = Math.min(...ids);
    const tenders = (await allPages<Tender>(`V2/Tender?${q(`(TransactionID|>=|${min})`)}`)).filter((t) => ids.has(t.TransactionID));
    for (const t of tenders) {
      const name = names.get(t.TypeID) ?? `Type ${t.TypeID}`;
      const net = (t.Amount ?? 0) - (t.Change ?? 0);
      byType[name] = money((byType[name] ?? 0) + net);
      if (/^cash$/i.test(name)) cash += net;
    }
  }
  return {
    from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(),
    sales: txs.length,
    total: money(txs.reduce((n, t) => n + (t.Total ?? 0), 0)),
    byType,
    cash: money(cash),
    lastSaleAt: txs.length ? new Date(Math.max(...txs.map((t) => fromUkWallClock(t.DateTime)))).toISOString() : null,
  };
}

/** The till's own cash-ups (Epos Now end of day) between two moments, newest first. */
export async function tillCashUps(fromMs: number, toMs = Date.now()): Promise<EndOfDay[]> {
  const r = await eposGet(`Reports/EndOfDay?FromDate=${toUkWallClock(fromMs)}&ToDate=${toUkWallClock(toMs)}`);
  if (!r.ok) throw new Error(`Epos Now said ${r.status}`);
  return list<EndOfDay>(r.json).sort((a, b) => fromUkWallClock(b.EndDate) - fromUkWallClock(a.EndDate));
}

/**
 * For checking the sums before the Till page goes live: the till's last few
 * cash-ups next to what the CRM works out for the same periods.
 */
export async function tillCompare(n = 5) {
  const ups = (await tillCashUps(Date.now() - 14 * 86400e3)).filter((u) => u.EndDate).slice(0, n);
  const out = [];
  for (const u of ups) {
    const t = await takings(fromUkWallClock(u.StartDate), fromUkWallClock(u.EndDate));
    out.push({
      till: { start: u.StartDate, end: u.EndDate, prevBal: u.PrevBal, sales: u.Sales, payOuts: u.PayOuts, pettyCash: u.PettyCash, floatAdjust: u.FloatAdjust, credits: u.CustomerCredits, expected: u.Expected, actual: u.Actual, variance: u.Variance, tenders: u.Tenders },
      crm: { sales: t.sales, total: t.total, byType: t.byType, cash: t.cash, expectedIfFloatIsPrevBal: money(u.PrevBal + t.cash) },
    });
  }
  return out;
}
