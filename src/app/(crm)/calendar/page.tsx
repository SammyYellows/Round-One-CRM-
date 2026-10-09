"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { firstName, uid } from "@/lib/engine";
import { isSameDay, time, toLocalInput } from "@/lib/format";
import { useStore } from "@/lib/store";
import { APPT_STATUSES, Appointment, ApptStatus, Availability, apptStatusLabel, stageLabel } from "@/lib/types";

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_PX = 56;
const DAY_MS = 86400e3;

type Panel = { kind: "new"; start: number } | { kind: "appt"; id: string } | { kind: "hours" } | null;

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(ms: number) {
  const d = new Date(startOfDay(ms));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}
function addDays(ms: number, n: number) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Side-by-side lanes for overlapping appointments in one day.
function layoutDay(items: Appointment[]) {
  const sorted = [...items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || Date.parse(b.end) - Date.parse(a.end));
  const out: { a: Appointment; lane: number; lanes: number }[] = [];
  let cluster: typeof out = [];
  let lanes: number[] = [];
  let clusterEnd = 0;
  const flush = () => {
    cluster.forEach((o) => (o.lanes = lanes.length));
    cluster = [];
    lanes = [];
    clusterEnd = 0;
  };
  for (const a of sorted) {
    const s = Date.parse(a.start);
    const e = Date.parse(a.end);
    if (cluster.length && s >= clusterEnd) flush();
    let lane = lanes.findIndex((end) => end <= s);
    if (lane < 0) {
      lane = lanes.length;
      lanes.push(e);
    } else lanes[lane] = e;
    const o = { a, lane, lanes: 1 };
    cluster.push(o);
    out.push(o);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}

export default function CalendarPage() {
  const { s, now, act } = useStore();
  const [view, setView] = useState<"week" | "day" | "list">("week");
  const [anchor, setAnchor] = useState(() => startOfDay(now));
  const [coach, setCoach] = useState<string>("all");
  const [calFilter, setCalFilter] = useState<string>("all");
  const [showCancelled, setShowCancelled] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deep link from a contact page: /calendar?appt=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("appt");
    const a = id && s.appointments.find((x) => x.id === id);
    if (a) {
      setAnchor(startOfDay(Date.parse(a.start)));
      setPanel({ kind: "appt", id: a.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open scrolled to an hour before now (or 8am).
  useEffect(() => {
    const h = new Date(now).getHours();
    const target = Math.max(0, (Math.min(Math.max(h - 1, START_HOUR), END_HOUR - 6) - START_HOUR) * HOUR_PX);
    scrollRef.current?.scrollTo({ top: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const rangeStart = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);

  const visible = useMemo(
    () =>
      s.appointments.filter(
        (a) =>
          (coach === "all" || a.staffId === coach) &&
          (calFilter === "all" || a.calendarId === calFilter) &&
          (showCancelled || a.status !== "cancelled"),
      ),
    [s.appointments, coach, calFilter, showCancelled],
  );
  const inRange = visible
    .filter((a) => Date.parse(a.start) < rangeEnd && Date.parse(a.end) > rangeStart)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const contact = (id: string) => s.contacts.find((c) => c.id === id);
  const cal = (id: string) => s.calendars.find((c) => c.id === id);
  const staff = (id: string) => s.staff.find((c) => c.id === id);

  const step = (dir: -1 | 1) => setAnchor((a) => addDays(a, dir * (view === "day" ? 1 : 7)));
  const fmtRange = () => {
    const f = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString("en-GB", o);
    if (view === "day") return f(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const last = days[6];
    return `${f(days[0], { day: "numeric", month: "short" })} – ${f(last, { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const onColumnClick = (day: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const mins = START_HOUR * 60 + Math.floor((y / HOUR_PX) * 2) * 30;
    setPanel({ kind: "new", start: day + mins * 60e3 });
  };

  const today = startOfDay(now);
  const nowTop = ((now - today) / 3600e3 - START_HOUR) * HOUR_PX;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{inRange.filter((a) => a.status !== "cancelled").length} appointments {view === "day" ? "today" : "this week"}</div>
          <h1 className="h h1">Calendar</h1>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => setPanel({ kind: "hours" })}>Booking hours</button>
          <button className="btn btn-red" onClick={() => {
            const d = new Date(now + 3600e3);
            d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
            setPanel({ kind: "new", start: d.getTime() });
          }}>Book a trial</button>
        </div>
      </header>

      <div className="cal-toolbar">
        <div className="actions" style={{ gap: 8 }}>
          <button className="fchip" onClick={() => setAnchor(startOfDay(now))}>Today</button>
          <button className="icon-btn" style={{ width: 44, height: 44 }} aria-label="Previous" onClick={() => step(-1)}>‹</button>
          <button className="icon-btn" style={{ width: 44, height: 44 }} aria-label="Next" onClick={() => step(1)}>›</button>
          <div className="h" style={{ fontSize: 22, marginLeft: 6 }}>{fmtRange()}</div>
        </div>
        <div className="actions" style={{ gap: 8 }}>
          {(["day", "week", "list"] as const).map((v) => (
            <button key={v} className={`fchip ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "list" ? "List" : v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="actions" style={{ gap: 8 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Coach</span>
          {[{ id: "all", name: "All" }, ...s.staff].map((c) => (
            <button key={c.id} className={`fchip ${coach === c.id ? "on" : ""}`} aria-pressed={coach === c.id} onClick={() => setCoach(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="actions" style={{ gap: 8 }}>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
          {s.calendars.length > 1 && (
            <>
              <label htmlFor="calf" className="eyebrow" style={{ marginLeft: 8 }}>Type</label>
              <select id="calf" className="select" style={{ width: 180 }} value={calFilter} onChange={(e) => setCalFilter(e.target.value)}>
                <option value="all">All types</option>
                {s.calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* The selected person's questionnaire, in the space above the calendar (Sammy, 09/10). */}
      {panel?.kind === "appt" && (() => {
        const ap = s.appointments.find((x) => x.id === panel.id);
        const c = ap && s.contacts.find((x) => x.id === ap.contactId);
        if (!c) return null;
        const answered = c.answers.filter((a) => a.answer);
        return (
          <section className="card answers-strip" aria-label={`${c.name}’s questionnaire`}>
            <div className="answers-head">
              <div>
                <span className="eyebrow">Questionnaire</span>
                <Link href={`/contacts/${c.id}`} className="strong" style={{ color: "var(--white)", marginLeft: 10 }}>{c.name} ›</Link>
                {c.phone && <span className="small muted" style={{ marginLeft: 10 }}>{c.phone}</span>}
              </div>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setPanel(null)}>✕</button>
            </div>
            {answered.length === 0 ? (
              <div className="small muted" style={{ padding: "0 18px 14px" }}>No questionnaire answers for {firstName(c) || c.name}{c.source === "teamup" ? ": they came in through TeamUp" : ""}.</div>
            ) : (
              <div className="answers-grid">
                {answered.map((a) => (
                  <div key={a.question} className="answers-cell">
                    <div className="small faint">{a.question}</div>
                    <div className="small" style={{ whiteSpace: "pre-wrap" }}>{a.answer}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <div className={`cal-wrap ${panel ? "" : "nopanel"}`}>
        {view === "list" ? (
          <section className="card">
            <div className="alist-row thead" style={{ borderTop: 0 }}>
              <div>When</div><div>Who</div><div>Type</div><div>Coach</div><div>Status</div>
            </div>
            {inRange.length === 0 && <div className="empty">Nothing booked in this range.</div>}
            {inRange.map((a, i) => {
              const newDay = i === 0 || !isSameDay(Date.parse(inRange[i - 1].start), Date.parse(a.start));
              return (
                <div key={a.id}>
                  {newDay && (
                    <div className="eyebrow" style={{ padding: "14px 22px 6px", borderTop: "1px solid var(--line)" }}>
                      {new Date(a.start).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                  )}
                  <div className={`alist-row ${a.status === "cancelled" ? "struck" : ""}`}>
                    <div className="num">{time(a.start)}–{time(a.end)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <button className="link-btn" style={{ textAlign: "left", fontSize: 14 }} onClick={() => setPanel({ kind: "appt", id: a.id })}>
                        {contact(a.contactId)?.name}
                      </button>
                      {contact(a.contactId) && <Link href={`/contacts/${a.contactId}`} className="small faint">Open contact ›</Link>}
                    </div>
                    <div><span className={`sw sw-${cal(a.calendarId)?.style}`} /> {cal(a.calendarId)?.name}</div>
                    <div className="muted">{staff(a.staffId)?.name}</div>
                    <select className="select" style={{ height: 36 }} aria-label="Status" value={a.status} onChange={(e) => act("setAppointmentStatus", a.id, e.target.value as ApptStatus)}>
                      {APPT_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="cal" style={{ ["--days" as string]: days.length } as React.CSSProperties}>
            <div className="cal-head">
              <div />
              {days.map((d) => (
                <button
                  key={d}
                  className={`d ${d === today ? "today" : ""}`}
                  onClick={() => { setAnchor(d); setView("day"); }}
                  aria-label={`Show ${new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
                >
                  <span className="eyebrow">{new Date(d).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                  <span className="dn">{new Date(d).getDate()}</span>
                </button>
              ))}
            </div>
            <div className="cal-scroll" ref={scrollRef}>
              <div className="cal-body">
                <div className="gutter" aria-hidden="true">
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i}>{i === 0 ? "" : `${String(START_HOUR + i).padStart(2, "0")}:00`}</div>
                  ))}
                </div>
                {days.map((d) => {
                  const dayAppts = inRange.filter((a) => isSameDay(Date.parse(a.start), d));
                  return (
                    <div key={d} className={`daycol ${d === today ? "today" : ""}`} onClick={(e) => onColumnClick(d, e)} title="Click an empty slot to book">
                      {d === today && nowTop > 0 && nowTop < (END_HOUR - START_HOUR) * HOUR_PX && <div className="nowline" style={{ top: nowTop }} />}
                      {layoutDay(dayAppts).map(({ a, lane, lanes }) => {
                        const st = Date.parse(a.start);
                        const top = ((st - d) / 3600e3 - START_HOUR) * HOUR_PX;
                        const height = Math.max(22, ((Date.parse(a.end) - st) / 3600e3) * HOUR_PX - 2);
                        const c = contact(a.contactId);
                        const k = cal(a.calendarId);
                        const selected = panel?.kind === "appt" && panel.id === a.id;
                        return (
                          <button
                            key={a.id}
                            className={`appt cal-${k?.style} st-${a.status} ${selected ? "sel" : ""}`}
                            style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                            onClick={() => setPanel({ kind: "appt", id: a.id })}
                            aria-label={`${c?.name}, ${k?.name}, ${time(a.start)} to ${time(a.end)}, ${apptStatusLabel(a.status)}`}
                          >
                            <span className="an">{c?.name}</span>
                            {height > 34 && <span>{time(a.start)}–{time(a.end)}</span>}
                            {height > 60 && lanes === 1 && <span>{k?.name} · {staff(a.staffId)?.name.split(" ")[0]}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="legend">
              {s.calendars.map((k) => <span key={k.id}><span className={`sw sw-${k.style}`} />{k.name}</span>)}
              <span><span className="sw sw-cancelled" />Cancelled or no-show</span>
              <span>✓ Showed</span>
            </div>
          </section>
        )}

        {panel?.kind === "new" && <NewPanel start={panel.start} onClose={() => setPanel(null)} onBooked={(id) => setPanel({ kind: "appt", id })} />}
        {panel?.kind === "appt" && <ApptPanel id={panel.id} onClose={() => setPanel(null)} />}
        {panel?.kind === "hours" && <HoursPanel onClose={() => setPanel(null)} />}
      </div>
    </>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, name: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] }));

/** When people can book a free trial themselves, on their booking page. */
function HoursPanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useStore();
  const cal = s.calendars.find((x) => x.bookTrial);
  const [av, setAv] = useState<Availability>(() => cal?.availability ?? { slotMin: 30, capacity: 1, minNoticeHours: 2, daysAhead: 14, hours: {} });
  const [saved, setSaved] = useState(false);
  if (!cal) return null;

  const setDay = (d: number, from: string, to: string) => {
    setSaved(false);
    setAv({ ...av, hours: { ...av.hours, [d]: from && to ? [[from, to]] : [] } });
  };
  const num = (k: "slotMin" | "capacity" | "minNoticeHours" | "daysAhead", v: string) => {
    setSaved(false);
    setAv({ ...av, [k]: Math.max(k === "minNoticeHours" ? 0 : 1, Math.round(Number(v) || 0)) });
  };

  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); act("setAvailability", cal.id, av); setSaved(true); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h h3">Booking hours</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="small muted" style={{ lineHeight: 1.5 }}>
        When people can book a {cal.name.toLowerCase()} themselves, from the form or a WhatsApp link. UK time. Leave a day empty to close it.
      </div>
      {WEEKDAYS.map(({ d, name }) => {
        const [from, to] = av.hours[d]?.[0] ?? ["", ""];
        return (
          <div key={d} style={{ display: "grid", gridTemplateColumns: "84px minmax(0, 1fr) minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
            <span className="small strong">{name}</span>
            <input type="time" className="input" style={{ minWidth: 0, padding: "0 8px" }} aria-label={`${name} from`} step={1800} value={from} onChange={(e) => setDay(d, e.target.value, to || "17:00")} />
            <input type="time" className="input" style={{ minWidth: 0, padding: "0 8px" }} aria-label={`${name} until`} step={1800} value={to} onChange={(e) => setDay(d, from || "09:00", e.target.value)} />
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label className="label" htmlFor="bh-slot">Slot length (min)</label>
          <input id="bh-slot" type="number" min={5} step={5} className="input" value={av.slotMin} onChange={(e) => num("slotMin", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bh-cap">People per slot</label>
          <input id="bh-cap" type="number" min={1} className="input" value={av.capacity} onChange={(e) => num("capacity", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bh-notice">Notice (hours)</label>
          <input id="bh-notice" type="number" min={0} className="input" value={av.minNoticeHours} onChange={(e) => num("minNoticeHours", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bh-ahead">Days ahead</label>
          <input id="bh-ahead" type="number" min={1} className="input" value={av.daysAhead} onChange={(e) => num("daysAhead", e.target.value)} />
        </div>
      </div>
      <button className="btn btn-red" type="submit">Save hours</button>
      {saved && <div className="small muted" role="status">Saved.</div>}
    </form>
  );
}

function NewPanel({ start, onClose, onBooked }: { start: number; onClose: () => void; onBooked: (id: string) => void }) {
  const { s, now, act } = useStore();
  const people = [...s.contacts].sort((a, b) => a.name.localeCompare(b.name));
  const [contactId, setContactId] = useState(people[0]?.id ?? "");
  const [calendarId, setCalendarId] = useState(s.calendars[0]?.id ?? "");
  const [staffId, setStaffId] = useState(s.staff[0]?.id ?? "");
  const [at, setAt] = useState(toLocalInput(start));
  const [notes, setNotes] = useState("");
  const k = s.calendars.find((x) => x.id === calendarId);

  useEffect(() => setAt(toLocalInput(start)), [start]);

  const book = (e: React.FormEvent) => {
    e.preventDefault();
    const id = uid();
    act("createAppointment", { contactId, calendarId, staffId, start: new Date(at).toISOString(), notes: notes || undefined }, id);
    onBooked(id);
  };

  return (
    <form className="panel" onSubmit={book}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h h3">Book a trial</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div>
        <label className="label" htmlFor="na-who">Who</label>
        <select id="na-who" className="select" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          {people.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Link href="/contacts?new=1" className="small" style={{ display: "inline-block", marginTop: 6 }}>Someone new? Add them first</Link>
      </div>
      {s.calendars.length > 1 && (
        <div>
          <label className="label" htmlFor="na-type">Type</label>
          <select id="na-type" className="select" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {s.calendars.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.durationMin} min</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="na-coach">Coach</label>
        <select id="na-coach" className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {s.staff.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="na-when">When</label>
        <input id="na-when" type="datetime-local" className="input" step={1800} value={at} onChange={(e) => setAt(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="na-notes">Notes</label>
        <input id="na-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {Date.parse(at) < now && (
        <div className="small" style={{ color: "var(--red)", fontWeight: 600 }}>This time has already passed.</div>
      )}
      {k?.bookTrial && (
        <div className="small muted" style={{ lineHeight: 1.5 }}>
          Booking a free trial moves them to Appointment booked and sends the confirmation on WhatsApp.
        </div>
      )}
      <button className="btn btn-red" type="submit" disabled={!contactId}>Book trial</button>
    </form>
  );
}

function ApptPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, now, act } = useStore();
  const a = s.appointments.find((x) => x.id === id);
  const [at, setAt] = useState(a ? toLocalInput(Date.parse(a.start)) : "");
  useEffect(() => { if (a) setAt(toLocalInput(Date.parse(a.start))); }, [a?.start]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return null;
  const c = s.contacts.find((x) => x.id === a.contactId);
  const k = s.calendars.find((x) => x.id === a.calendarId);
  const past = Date.parse(a.end) < now;

  return (
    <aside className="panel" aria-label="Appointment">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow"><span className={`sw sw-${k?.style}`} /> {k?.name}</span>
          {c
            ? <Link href={`/contacts/${c.id}`} className="h h2 contact-link" title="Open their contact page">{c.name} ›</Link>
            : <h2 className="h h2">Unknown contact</h2>}
        </div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="small" style={{ lineHeight: 1.6 }}>
        {new Date(a.start).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, {time(a.start)}–{time(a.end)}
      </div>
      {c && (
        <div className="contact-box">
          <div className="small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {c.phone ? <a className="muted" href={`tel:${c.phone.replace(/\s+/g, "")}`}>{c.phone}</a> : <span className="faint">No mobile</span>}
            {c.email ? <a className="muted" href={`mailto:${c.email}`} style={{ overflowWrap: "anywhere" }}>{c.email}</a> : <span className="faint">No email</span>}
            <span className="faint">{stageLabel(c.stage)}{c.ad ? ` · from ad “${c.ad}”` : ""}</span>
          </div>
          <Link href={`/contacts/${c.id}`} className="btn btn-red" style={{ width: "100%", justifyContent: "center" }}>Open contact</Link>
        </div>
      )}

      <div>
        <div className="label">Status</div>
        <div className="statusbtns">
          {APPT_STATUSES.map((st) => (
            <button
              key={st.id}
              className={`sbtn ${a.status === st.id ? "on" : ""}`}
              aria-pressed={a.status === st.id}
              onClick={() => act("setAppointmentStatus", a.id, st.id)}
              disabled={!past && (st.id === "attended" || st.id === "no_show") && Date.parse(a.start) > now}
              title={!past && Date.parse(a.start) > now && (st.id === "attended" || st.id === "no_show") ? "Available once it has started" : undefined}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="ap-coach">Coach</label>
        <select id="ap-coach" className="select" value={a.staffId} onChange={(e) => act("rescheduleAppointment", a.id, { staffId: e.target.value })}>
          {s.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ap-when">Move to</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="ap-when" type="datetime-local" className="input" style={{ minWidth: 0 }} step={1800} value={at} onChange={(e) => setAt(e.target.value)} />
          <button className="btn btn-red" style={{ padding: "0 14px" }} onClick={() => act("rescheduleAppointment", a.id, { start: new Date(at).toISOString() })}>Move</button>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ap-notes">Notes</label>
        <input id="ap-notes" className="input" value={a.notes ?? ""} onChange={(e) => act("rescheduleAppointment", a.id, { notes: e.target.value })} placeholder="Add a note" />
      </div>
    </aside>
  );
}
