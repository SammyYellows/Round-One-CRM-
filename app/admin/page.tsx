import Link from "next/link";
import { appointmentsBetween, fullName } from "@/lib/leads";
import { dashboardStats } from "@/lib/stats";
import { money, pct } from "@/lib/format";
import { addDaysKey, dateKey, dayStart, formatTime } from "@/lib/time";
import Topbar from "./Topbar";

const RANGES: Record<string, { label: string; days: number | null }> = {
  "7": { label: "Last 7 days", days: 7 },
  "30": { label: "Last 30 days", days: 30 },
  "90": { label: "Last 90 days", days: 90 },
  all: { label: "All time", days: null },
};

function Donut({ parts, total }: { parts: { color: string; count: number }[]; total: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 180" width="180" height="180" role="img">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#eef2f7" strokeWidth="22" />
      {total > 0 &&
        parts
          .filter((p) => p.count > 0)
          .map((p, i) => {
            const len = (p.count / total) * c;
            const el = (
              <circle
                key={i}
                cx="90"
                cy="90"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="22"
                strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 90 90)"
              />
            );
            offset += len;
            return el;
          })}
      <text x="90" y="98" textAnchor="middle" fontSize="26" fontWeight="600" fill="currentColor">
        {total}
      </text>
    </svg>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = "30" } = await searchParams;
  const r = RANGES[range] ?? RANGES["30"];
  const since = r.days ? new Date(Date.now() - r.days * 86400_000).toISOString() : null;
  const s = dashboardStats(since);
  const today = dateKey(new Date());
  const todays = appointmentsBetween(dayStart(today).toISOString(), dayStart(addDaysKey(today, 1)).toISOString());
  const pipelineStages = s.stages.filter((x) => x.key !== "unqualified");
  const maxReached = Math.max(1, s.funnel[0].reached);

  return (
    <>
      <Topbar title="Dashboard">
        {Object.entries(RANGES).map(([k, v]) => (
          <Link key={k} href={`/admin?range=${k}`} className={`btn btn-sm ${k === range ? "" : "btn-ghost"}`}>
            {v.label}
          </Link>
        ))}
      </Topbar>
      <div className="content stack">
        <div className="grid grid-4">
          <div className="card">
            <div className="muted small">New leads</div>
            <div className="stat">{s.total}</div>
            <div className="small muted">{s.total - s.qualifiedTotal} not qualified</div>
          </div>
          <div className="card">
            <div className="muted small">Booking rate</div>
            <div className="stat">{pct(s.bookingRate)}</div>
            <div className="small muted">of qualified leads booked</div>
          </div>
          <div className="card">
            <div className="muted small">Show-up rate</div>
            <div className="stat">{pct(s.showRate)}</div>
            <div className="small muted">
              {s.appointments.attended} attended · {s.appointments.noShow} no-shows
            </div>
          </div>
          <div className="card">
            <div className="muted small">Conversion rate</div>
            <div className="stat">{pct(s.conversion)}</div>
            <div className="small muted">
              {s.won} won/recurring · {money(s.totalValue)} value
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Funnel</h2>
              <span className="muted small">Leads reaching each stage</span>
            </div>
            <div className="bar-row muted small">
              <span />
              <span />
              <span>Cumulative</span>
              <span>Next step</span>
            </div>
            {s.funnel.map((f, i) => {
              const next = s.funnel[i + 1];
              return (
                <div className="bar-row" key={f.key}>
                  <span>{f.label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(f.reached / maxReached) * 100}%`, background: f.color }} />
                  </div>
                  <span>{pct(f.reached / maxReached)}</span>
                  <span>{next ? (f.reached ? pct(next.reached / f.reached) : "–") : ""}</span>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Stage distribution</h2>
              <Link href="/admin/pipeline" className="small">
                Open pipeline →
              </Link>
            </div>
            <div className="row" style={{ alignItems: "center", gap: 24 }}>
              <Donut parts={pipelineStages} total={s.qualifiedTotal} />
              <div className="legend">
                {pipelineStages.map((x) => (
                  <div key={x.key} className="row" style={{ gap: 6 }}>
                    <span className="dot" style={{ background: x.color }} />
                    {x.label} – <b>{x.count}</b>
                    <span className="muted">{s.qualifiedTotal ? `(${pct(x.count / s.qualifiedTotal)})` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Today&apos;s consultations</h2>
              <Link href="/admin/calendar" className="small">
                Calendar →
              </Link>
            </div>
            {todays.length === 0 ? (
              <p className="muted">Nothing booked today.</p>
            ) : (
              <table className="table">
                <tbody>
                  {todays.map((a) => (
                    <tr key={a.id}>
                      <td style={{ width: 80 }}>{formatTime(a.starts_at)}</td>
                      <td>
                        <Link href={`/admin/leads/${a.lead_id}`}>{fullName(a)}</Link>
                      </td>
                      <td>
                        <span className="badge">{a.status.replace("_", "-")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h2>Lead sources</h2>
            <table className="table">
              <tbody>
                {s.sources.map((x) => (
                  <tr key={x.source}>
                    <td>{x.source}</td>
                    <td style={{ textAlign: "right" }}>
                      <b>{x.n}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
