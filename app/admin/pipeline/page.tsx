import { db } from "@/lib/db";
import type { Lead } from "@/lib/leads";
import { PIPELINE_STAGES, stageInfo } from "@/lib/stages";
import Topbar from "../Topbar";
import Board, { type BoardCard } from "./Board";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const like = `%${q}%`;
  const rows = db()
    .prepare(
      `SELECT l.*, (SELECT starts_at FROM appointments a WHERE a.lead_id = l.id AND a.status IN ('booked','confirmed')
         AND a.starts_at >= ? ORDER BY starts_at LIMIT 1) AS next_appt
       FROM leads l WHERE l.stage != 'unqualified'
       ${q ? "AND (l.first_name || ' ' || l.last_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)" : ""}
       ORDER BY l.stage_changed_at DESC`,
    )
    .all(new Date(Date.now() - 86400_000).toISOString(), ...(q ? [like, like, like] : [])) as (Lead & { next_appt: string | null })[];

  const columns = PIPELINE_STAGES.map((key) => {
    const cards: BoardCard[] = rows
      .filter((r) => r.stage === key)
      .map((r) => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        source: r.source,
        value: r.value_pence,
        nextAppt: r.next_appt,
        stageChangedAt: r.stage_changed_at,
      }));
    return { ...stageInfo(key), cards, value: cards.reduce((a, c) => a + c.value, 0) };
  });

  return (
    <>
      <Topbar title="Opportunities">
        <form>
          <input name="q" defaultValue={q} placeholder="Search opportunities" style={{ width: 220 }} />
        </form>
        <span className="badge">{rows.length} opportunities</span>
      </Topbar>
      <div className="content">
        <Board columns={columns} />
      </div>
    </>
  );
}
