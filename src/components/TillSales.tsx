"use client";

// Takings from the till (Epos Now), by period and payment type, and the
// month's best sellers (Sammy, 14/10/2026). Management only: shown on the
// Till page and the Till tab of Reports.

export type TillSummary = { sales: number; total: number; byType: Record<string, number>; cash: number; cashSales: number; lastSaleAt: string | null };
export type BestSeller = { name: string; qty: number; takings: number };

export const pounds = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TillSales({ periods, best }: { periods: { label: string; s: TillSummary }[]; best?: BestSeller[] | null }) {
  return (
    <>
      <div className="grid stats4">
        {periods.map(({ label, s }) => (
          <div key={label} className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">{label}</div>
            <div className="h num" style={{ fontSize: 44, lineHeight: 1 }}>{pounds(s.total)}</div>
            <div className="small muted">{s.sales} sale{s.sales === 1 ? "" : "s"}</div>
            <div className="small" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Object.entries(s.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span className="muted">{k}</span><span className="num">{pounds(v)}</span></span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {best && best.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="h h3">Best sellers this month</h2><span className="small muted">By how many sold</span></div>
          {best.map((b, i) => (
            <div key={b.name} className="row" style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 22px", borderTop: "1px solid var(--line)", fontSize: 14 }}>
              <span className="num faint" style={{ width: 22 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{b.name}</span>
              <span className="num">{b.qty} sold</span>
              {b.takings > 0 && <span className="num muted" style={{ width: 90, textAlign: "right" }}>{pounds(b.takings)}</span>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
