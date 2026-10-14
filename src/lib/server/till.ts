// The till's money, read from Epos Now (Sammy, 14/10/2026): takings, cash
// put in the till since the last cash-out, best sellers, and the cash-outs
// management record here. Read only on the till. Epos Now gives times as UK
// wall clock. Management only (gym-wide money). Server-only.

import { fromUkWallClock, toUkWallClock, ukParts, ukTime, ukWeekStart } from "@/lib/time";
import { eposConfigured, eposGet } from "./eposnow";
import { db } from "./supabase";

type Tx = { TransactionID: number; DateTime: string };
type Tender = { TransactionID: number; TypeID: number; Amount: number; Change: number };
type Row = Record<string, unknown>;
export type EndOfDay = {
  StartDate: string; EndDate: string; PrevBal: number; Sales: number; PayOuts: number; PettyCash: number; FloatAdjust: number;
  CustomerCredits: number; Expected: number; Actual: number; Variance: number; Tenders: unknown;
};
/** One sale: when, and how it was paid (net of change). */
export type Sale = { id: number; at: number; paid: { type: string; amount: number }[] };

const PAGE = 200;
const list = <T,>(j: unknown): T[] => (Array.isArray(j) ? (j as T[]) : []);
const q = (search: string) => `search=${encodeURIComponent(search)}`;
const money = (n: number) => Math.round(n * 100) / 100;
const isCash = (type: string) => /^cash$/i.test(type);

/** Every page of a V2 list (200 a page), up to `max` pages. */
async function allPages<T>(path: string, max = 40): Promise<T[]> {
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
async function tenderTypes() {
  if (types && Date.now() - types.at < 3600e3) return types.names;
  const rows = await allPages<{ TypeID: number; Name: string }>("V2/TenderType", 2);
  types = { at: Date.now(), names: new Map(rows.map((t) => [t.TypeID, t.Name])) };
  return types.names;
}

let recent: { at: number; from: number; sales: Sale[] } | null = null;
/** Every sale since `fromMs`, with its payments. Kept two minutes, so a page load doesn't ask Epos Now twice. */
export async function salesSince(fromMs: number): Promise<Sale[]> {
  if (!eposConfigured()) throw new Error("Epos Now isn’t connected");
  if (recent && Date.now() - recent.at < 120e3 && recent.from <= fromMs) return recent.sales.filter((s) => s.at >= fromMs);
  const txs = (await allPages<Tx>(`V2/Transaction?${q(`(DateTime|>=|${toUkWallClock(fromMs)})`)}`))
    .map((t) => ({ id: t.TransactionID, at: fromUkWallClock(t.DateTime) }))
    .filter((t) => t.at >= fromMs);
  const sales: Sale[] = [];
  if (txs.length) {
    const names = await tenderTypes();
    const min = Math.min(...txs.map((t) => t.id));
    const paid = new Map<number, Sale["paid"]>();
    for (const t of await allPages<Tender>(`V2/Tender?${q(`(TransactionID|>=|${min})`)}`)) {
      const p = paid.get(t.TransactionID) ?? [];
      p.push({ type: names.get(t.TypeID) ?? `Type ${t.TypeID}`, amount: (t.Amount ?? 0) - (t.Change ?? 0) });
      paid.set(t.TransactionID, p);
    }
    for (const t of txs) sales.push({ ...t, paid: paid.get(t.id) ?? [] });
  }
  recent = { at: Date.now(), from: fromMs, sales };
  return sales;
}

/** Takings in a period: sales paid for, the total, each payment type, and the cash put in the till. */
export function summarise(sales: Sale[], fromMs: number, toMs = Infinity) {
  const inRange = sales.filter((s) => s.at >= fromMs && s.at < toMs && s.paid.length);
  const byType: Record<string, number> = {};
  for (const s of inRange) for (const p of s.paid) byType[p.type] = money((byType[p.type] ?? 0) + p.amount);
  const cashSales = inRange.filter((s) => s.paid.some((p) => isCash(p.type)));
  return {
    sales: inRange.length,
    total: money(Object.values(byType).reduce((a, b) => a + b, 0)),
    byType,
    cash: money(Object.entries(byType).filter(([k]) => isCash(k)).reduce((a, [, v]) => a + v, 0)),
    cashSales: cashSales.length,
    lastSaleAt: inRange.length ? new Date(Math.max(...inRange.map((s) => s.at))).toISOString() : null,
  };
}

/** Best sellers among these sales: quantity and takings per product. */
export async function bestSellers(sales: Sale[], top = 10) {
  if (!sales.length) return [];
  const ids = new Set(sales.map((s) => s.id));
  const items = (await allPages<Row>(`V2/TransactionItem?${q(`(TransactionID|>=|${Math.min(...ids)})`)}`)).filter((i) => ids.has(Number(i.TransactionID)));
  const products = new Map((await allPages<Row>("V2/Product", 10)).map((p) => [Number(p.ProductID ?? p.Id), String(p.Name ?? "")]));
  const byProduct = new Map<string, { name: string; qty: number; takings: number }>();
  for (const i of items) {
    const name = products.get(Number(i.ProductID)) || String(i.ProductName ?? i.Name ?? "Other");
    const qty = Number(i.Quantity ?? i.Qty ?? 1);
    const unit = Number(i.UnitPrice ?? i.Price ?? 0);
    const e = byProduct.get(name) ?? { name, qty: 0, takings: 0 };
    e.qty += qty;
    e.takings = money(e.takings + unit * qty);
    byProduct.set(name, e);
  }
  return [...byProduct.values()].sort((a, b) => b.qty - a.qty || b.takings - a.takings).slice(0, top);
}

// ---- Cash-outs ---------------------------------------------------------------

export type CashOut = { id: string; at: string; by: string; counted: number; expected: number | null; floatLeft: number; cashSales: number | null; cashSalesCount: number | null; note: string | null };
const cashOutFrom = (r: Row): CashOut => ({
  id: String(r.id), at: String(r.at), by: String(r.by), counted: Number(r.counted), expected: r.expected === null ? null : Number(r.expected),
  floatLeft: Number(r.float_left), cashSales: r.cash_sales === null ? null : Number(r.cash_sales),
  cashSalesCount: r.cash_sales_count === null ? null : Number(r.cash_sales_count), note: (r.note as string | null) ?? null,
});

export async function cashOuts(limit = 30): Promise<CashOut[]> {
  const { data, error } = await db().from("cash_outs").select("*").order("at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(cashOutFrom);
}

/** What should be in the till now: the float left at the last cash-out plus cash taken since. Null before the first cash-out. */
export async function cashInTill(last: CashOut | undefined, sales?: Sale[]) {
  if (!last) return null;
  const since = Date.parse(last.at);
  const s = summarise(sales ? sales.filter((x) => x.at >= since) : await salesSince(since), since);
  return { since: last.at, float: last.floatLeft, cash: s.cash, cashSales: s.cashSales, expected: money(last.floatLeft + s.cash), lastSaleAt: s.lastSaleAt };
}

/** Records a cash-out. The expected amount is worked out here, at the moment it's saved. */
export async function recordCashOut(input: { by: string; counted: number; floatLeft: number; note?: string }) {
  const [last] = await cashOuts(1);
  const now = await cashInTill(last);
  const { data, error } = await db().from("cash_outs").insert({
    by: input.by, counted: money(input.counted), float_left: money(input.floatLeft), note: input.note?.trim() || null,
    expected: now?.expected ?? null, cash_sales: now?.cash ?? null, cash_sales_count: now?.cashSales ?? null,
  }).select("*").single();
  if (error) throw new Error(error.message);
  // An event like everything else, without the money: staff can see events.
  await db().from("events").insert({ id: crypto.randomUUID(), type: "till.cashed_out", contact_id: null, detail: `Till cashed out by ${input.by}`, data: {} });
  return cashOutFrom(data as Row);
}

// ---- Periods (UK time) -------------------------------------------------------

export function periods(now = Date.now()) {
  const { date } = ukParts(now);
  const day = Number(date.slice(8, 10));
  const today = ukTime(now, 0, 0, 0).getTime();
  const week = ukWeekStart(now).getTime();
  const month = ukTime(now, -(day - 1), 0, 0).getTime();
  const lastMonthDay = Number(ukParts(month - 86400e3).date.slice(8, 10));
  const lastMonth = ukTime(month - 86400e3, -(lastMonthDay - 1), 0, 0).getTime();
  return { today, week, month, lastMonth };
}

// ---- Checking the sums against the till's own end of day ------------------------

async function tillCashUps(fromMs: number, toMs = Date.now()): Promise<EndOfDay[]> {
  const r = await eposGet(`Reports/EndOfDay?FromDate=${toUkWallClock(fromMs)}&ToDate=${toUkWallClock(toMs)}`);
  if (!r.ok) throw new Error(`Epos Now said ${r.status}`);
  return list<EndOfDay>(r.json).sort((a, b) => fromUkWallClock(b.EndDate) - fromUkWallClock(a.EndDate));
}

/** The till's last few end-of-day reports next to the CRM's sums for the same periods. */
export async function tillCompare(n = 5) {
  const ups = (await tillCashUps(Date.now() - 14 * 86400e3)).filter((u) => u.EndDate).slice(0, n);
  const out = [];
  for (const u of ups) {
    const from = fromUkWallClock(u.StartDate), to = fromUkWallClock(u.EndDate);
    const t = summarise(await salesSince(from), from, to);
    out.push({ till: { start: u.StartDate, end: u.EndDate, prevBal: u.PrevBal, sales: u.Sales, expected: u.Expected, actual: u.Actual, tenders: u.Tenders }, crm: t });
  }
  return out;
}
