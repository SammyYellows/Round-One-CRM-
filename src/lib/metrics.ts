// Numbers for the Today dashboard. Days before the sample data started come
// from State.history (made up); from then on they're counted live from the
// CRM, so submitting a form or booking a trial moves the charts.

import { dayKey } from "./seed";
import { SOLD_STAGES, SOURCES, STAGES, Stage, State } from "./types";

export interface DayPoint {
  key: string;
  date: number;
  leads: number;
  trials: number;
  spend: number;
  isToday: boolean;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function daily(s: State, now: number, days: number): DayPoint[] {
  const seedKey = dayKey(Date.parse(s.seededAt));
  const avgSpend = s.history.length ? s.history.reduce((n, h) => n + h.spend, 0) / s.history.length : 0;
  const trialCals = s.calendars.filter((c) => c.bookTrial).map((c) => c.id);
  const today = startOfDay(now);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.getTime();
    const key = dayKey(date);
    const hist = key < seedKey ? s.history.find((h) => h.day === key) : undefined;
    if (hist) {
      out.push({ key, date, leads: hist.leads, trials: hist.trials, spend: hist.spend, isToday: false });
      continue;
    }
    out.push({
      key,
      date,
      leads: s.contacts.filter((c) => dayKey(Date.parse(c.createdAt)) === key).length,
      trials: s.appointments.filter((a) => trialCals.includes(a.calendarId) && a.status !== "cancelled" && dayKey(Date.parse(a.start)) === key).length,
      spend: Math.round(avgSpend),
      isToday: date === today,
    });
  }
  return out;
}

export function stageCounts(s: State) {
  return STAGES.filter((st) => st.id !== "lost").map((st) => ({
    id: st.id,
    label: st.label,
    value: s.contacts.filter((c) => c.stage === st.id).length,
  }));
}

export function sourceCounts(s: State) {
  return SOURCES.map((src) => ({ id: src.id, label: src.label, value: s.contacts.filter((c) => c.source === src.id).length }))
    .sort((a, b) => b.value - a.value);
}

/**
 * How far people have got, for the funnel. The stages branch after a trial
 * (no-show, nurture, sold), so each step counts everyone who reached it or
 * anything beyond it. Lost contacts are left out.
 */
export function funnelCounts(s: State) {
  const live = s.contacts.filter((c) => c.stage !== "lost");
  const count = (stages: Stage[]) => live.filter((c) => stages.includes(c.stage)).length;
  const sold = count(SOLD_STAGES);
  const attended = sold + count(["attended", "nurture"]);
  const booked = attended + count(["booked", "no_show"]);
  const replied = booked + count(["contacted"]);
  return { enquired: live.length, replied, booked, attended, sold };
}

/** Of trials that have happened, how many turned up. */
export function showRate(s: State) {
  const trialCals = s.calendars.filter((c) => c.bookTrial).map((c) => c.id);
  const done = s.appointments.filter((a) => trialCals.includes(a.calendarId) && (a.status === "attended" || a.status === "no_show"));
  const attended = done.filter((a) => a.status === "attended").length;
  return { attended, total: done.length, rate: done.length ? attended / done.length : 0 };
}

/** Bookings per day, Monday to Sunday of the current week. */
export function weekLoad(s: State, now: number) {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    const key = dayKey(day.getTime());
    const appts = s.appointments.filter((a) => a.status !== "cancelled" && dayKey(Date.parse(a.start)) === key);
    return {
      key,
      date: day.getTime(),
      value: appts.length,
      isToday: day.getTime() === today,
      isPast: day.getTime() < today,
    };
  });
}
