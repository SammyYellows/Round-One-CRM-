import Link from "next/link";
import { appointmentsBetween, fullName } from "@/lib/leads";
import { addDaysKey, dateKey, dayStart, formatShortDay, formatTime, localParts, parseKey, startOfWeekKey } from "@/lib/time";
import Topbar from "../Topbar";

const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_PX = 80;

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  attended: "Attended",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string }> }) {
  const sp = await searchParams;
  const todayKey = dateKey(new Date());
  const weekKey = startOfWeekKey(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayKey);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekKey, i));
  const appts = appointmentsBetween(dayStart(days[0]).toISOString(), dayStart(addDaysKey(weekKey, 7)).toISOString());
  const view = sp.view === "list" ? "list" : "week";
  const now = localParts(new Date());
  const { d: wd, m: wm } = parseKey(weekKey);
  const endKey = parseKey(days[6]);
  const label = `${wd}/${wm} – ${endKey.d}/${endKey.m}/${endKey.y}`;

  const q = (week: string, v = view) => `/admin/calendar?week=${week}&view=${v}`;

  return (
    <>
      <Topbar title="Calendars">
        <Link className="btn btn-ghost btn-sm" href={q(todayKey)}>
          Today
        </Link>
        <Link className="btn btn-ghost btn-sm" href={q(addDaysKey(weekKey, -7))}>
          ‹
        </Link>
        <span>{label}</span>
        <Link className="btn btn-ghost btn-sm" href={q(addDaysKey(weekKey, 7))}>
          ›
        </Link>
        <Link className={`btn btn-sm ${view === "week" ? "" : "btn-ghost"}`} href={q(weekKey, "week")}>
          Week
        </Link>
        <Link className={`btn btn-sm ${view === "list" ? "" : "btn-ghost"}`} href={q(weekKey, "list")}>
          List
        </Link>
      </Topbar>
      <div className="content">
        <div className="row small muted" style={{ marginBottom: 10 }}>
          <span>
            <span className="dot" style={{ background: "#0891d1" }} /> Booked
          </span>
          <span>
            <span className="dot" style={{ background: "#0e9f6e" }} /> Confirmed
          </span>
          <span>
            <span className="dot" style={{ background: "#7c3aed" }} /> Attended
          </span>
          <span>
            <s>Struck through</s> = cancelled / no-show
          </span>
        </div>

        {view === "list" ? (
          <div className="card">
            {appts.length === 0 ? (
              <p className="muted">No appointments this week.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Lead</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {formatShortDay(a.starts_at)} {formatTime(a.starts_at)}
                      </td>
                      <td>
                        <Link href={`/admin/leads/${a.lead_id}`}>{fullName(a)}</Link>
                      </td>
                      <td>{a.phone}</td>
                      <td>
                        <span className="badge">{STATUS_LABEL[a.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div className="cal" style={{ minWidth: 760 }}>
              <div className="cal-head" style={{ borderLeft: "none" }} />
              {days.map((k) => (
                <div key={k} className={`cal-head ${k === todayKey ? "today" : ""}`}>
                  {formatShortDay(new Date(dayStart(k).getTime() + 12 * 3600_000))}
                </div>
              ))}
              <div className="cal-times" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="cal-time" style={{ top: i * HOUR_PX }}>
                    {i === 0 ? "" : `${((START_HOUR + i + 11) % 12) + 1}${START_HOUR + i < 12 ? "am" : "pm"}`}
                  </div>
                ))}
              </div>
              {days.map((k) => (
                <div key={k} className="cal-day" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i} className="cal-line" style={{ top: i * HOUR_PX }} />
                  ))}
                  {k === todayKey && now.h >= START_HOUR && now.h < END_HOUR && (
                    <div className="cal-now" style={{ top: (now.h - START_HOUR + now.min / 60) * HOUR_PX }} />
                  )}
                  {layout(appts.filter((a) => dateKey(new Date(a.starts_at)) === k)).map(({ a, col, cols }) => {
                    const s = localParts(new Date(a.starts_at));
                    const mins = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
                    const top = (s.h - START_HOUR + s.min / 60) * HOUR_PX;
                    return (
                      <Link
                        key={a.id}
                        href={`/admin/leads/${a.lead_id}`}
                        className={`appt ${a.status}`}
                        title={`${fullName(a)} – ${STATUS_LABEL[a.status]}`}
                        style={{
                          top: Math.max(0, top),
                          height: Math.max(22, (mins / 60) * HOUR_PX - 2),
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          right: "auto",
                        }}
                      >
                        <b>{fullName(a)}</b>
                        {formatTime(a.starts_at)} – {formatTime(a.ends_at)}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Side-by-side columns for overlapping appointments. */
function layout<T extends { starts_at: string; ends_at: string }>(items: T[]) {
  const out: { a: T; col: number; cols: number }[] = [];
  let group: { a: T; col: number; cols: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => out.push({ ...g, cols }));
    group = [];
  };
  for (const a of items) {
    const s = new Date(a.starts_at).getTime();
    const e = new Date(a.ends_at).getTime();
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => new Date(g.a.ends_at).getTime() > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ a, col, cols: 1 });
    groupEnd = Math.max(groupEnd, e);
  }
  flush();
  return out;
}
