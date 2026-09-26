import { db } from "./db";
import { FUNNEL_STAGES, STAGES, type StageKey } from "./stages";

export function dashboardStats(sinceIso: string | null) {
  const d = db();
  const where = sinceIso ? "WHERE created_at >= ?" : "";
  const args = sinceIso ? [sinceIso] : [];

  const byStage = new Map(
    (d.prepare(`SELECT stage, COUNT(*) n, SUM(value_pence) v FROM leads ${where} GROUP BY stage`).all(...args) as {
      stage: StageKey;
      n: number;
      v: number;
    }[]).map((r) => [r.stage, r]),
  );
  const stages = STAGES.map((s) => ({ ...s, count: byStage.get(s.key)?.n ?? 0, value: byStage.get(s.key)?.v ?? 0 }));
  const qualifiedTotal = stages.filter((s) => s.key !== "unqualified").reduce((a, s) => a + s.count, 0);
  const total = qualifiedTotal + (byStage.get("unqualified")?.n ?? 0);
  const won = (byStage.get("won")?.n ?? 0) + (byStage.get("recurring")?.n ?? 0);
  const totalValue = stages.reduce((a, s) => a + s.value, 0);

  // Funnel: leads that ever reached each stage (or any later one on the happy path).
  const hist = d
    .prepare(
      `SELECT h.lead_id, h.stage FROM stage_history h JOIN leads l ON l.id = h.lead_id ${sinceIso ? "WHERE l.created_at >= ?" : ""}`,
    )
    .all(...args) as { lead_id: number; stage: StageKey }[];
  const furthest = new Map<number, number>();
  for (const h of hist) {
    const i = FUNNEL_STAGES.indexOf(h.stage);
    if (i >= 0) furthest.set(h.lead_id, Math.max(furthest.get(h.lead_id) ?? -1, i));
  }
  const funnel = FUNNEL_STAGES.map((key, i) => {
    const reached = [...furthest.values()].filter((f) => f >= i).length;
    return { ...STAGES.find((s) => s.key === key)!, reached };
  });

  const appt = d
    .prepare(
      `SELECT SUM(status = 'attended') attended, SUM(status = 'no_show') no_show, SUM(status = 'cancelled') cancelled, COUNT(*) total
       FROM appointments ${sinceIso ? "WHERE created_at >= ?" : ""}`,
    )
    .get(...args) as { attended: number | null; no_show: number | null; cancelled: number | null; total: number };
  const attended = appt.attended ?? 0;
  const noShow = appt.no_show ?? 0;

  const sources = d
    .prepare(`SELECT source, COUNT(*) n FROM leads ${where} GROUP BY source ORDER BY n DESC LIMIT 6`)
    .all(...args) as { source: string; n: number }[];

  return {
    stages,
    total,
    qualifiedTotal,
    won,
    totalValue,
    conversion: qualifiedTotal ? won / qualifiedTotal : 0,
    bookingRate: funnel[0].reached ? funnel[1].reached / funnel[0].reached : 0,
    showRate: attended + noShow ? attended / (attended + noShow) : 0,
    appointments: { attended, noShow, cancelled: appt.cancelled ?? 0, total: appt.total },
    funnel,
    sources,
  };
}
