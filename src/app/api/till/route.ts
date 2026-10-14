// The Till page and the till cards (Sammy, 14/10/2026). Management only:
// gym-wide money. GET: takings, cash in the till since the last cash-out,
// best sellers and the cash-out history (?summary=1: just today and the cash
// in the till, for Today). POST: a cash-out, only with confirm.

import { eposConfigured } from "@/lib/server/eposnow";
import { requireManager } from "@/lib/server/staff";
import { bestSellers, cashInTill, cashOuts, periods, recordCashOut, salesSince, summarise } from "@/lib/server/till";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  if (!eposConfigured()) return Response.json({ connected: false });
  try {
    const p = periods();
    const history = await cashOuts();
    const last = history[0];
    if (new URL(req.url).searchParams.get("summary")) {
      const from = Math.min(p.today, last ? Date.parse(last.at) : p.today);
      const sales = await salesSince(from);
      return Response.json({ connected: true, today: summarise(sales, p.today), inTill: await cashInTill(last, sales) });
    }
    const from = Math.min(p.lastMonth, last ? Date.parse(last.at) : p.lastMonth);
    const sales = await salesSince(from);
    return Response.json({
      connected: true,
      today: summarise(sales, p.today),
      week: summarise(sales, p.week),
      month: summarise(sales, p.month),
      lastMonth: summarise(sales, p.lastMonth, p.month),
      inTill: await cashInTill(last, sales),
      bestSellers: await bestSellers(sales.filter((s) => s.at >= p.month)).catch(() => null),
      history,
    });
  } catch (e) {
    console.error("[till]", e);
    return Response.json({ connected: true, error: e instanceof Error ? e.message : "Couldn’t read the till" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { counted?: unknown; floatLeft?: unknown; note?: unknown; confirm?: unknown };
  const counted = Number(b.counted), floatLeft = Number(b.floatLeft ?? 0);
  if (b.confirm !== true) return Response.json({ error: "Confirm the cash-out first" }, { status: 400 });
  if (!Number.isFinite(counted) || counted < 0 || counted > 100000) return Response.json({ error: "Enter the amount counted in the till" }, { status: 400 });
  if (!Number.isFinite(floatLeft) || floatLeft < 0 || floatLeft > counted) return Response.json({ error: "The float left in can’t be more than what you counted" }, { status: 400 });
  try {
    const saved = await recordCashOut({ by: auth.staff.name, counted, floatLeft, note: typeof b.note === "string" ? b.note.slice(0, 500) : undefined });
    return Response.json({ ok: true, cashOut: saved });
  } catch (e) {
    console.error("[till cash-out]", e);
    return Response.json({ error: "Couldn’t save the cash-out. Try again." }, { status: 500 });
  }
}
