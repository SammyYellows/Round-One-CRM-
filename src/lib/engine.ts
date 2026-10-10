// Every change to the CRM goes through these functions. Each one mutates a
// draft copy of State (the store clones it first), writes an event, and lets
// matching automations react. When the backend exists, these become API
// routes and the automation part moves to a job runner (Inngest / Trigger.dev).

import {
  Accountability, Appointment, Automation, Checkin, Availability, Membership, Contact, CrmEvent, EventType, Form, Run, Source, Stage, State, Step, apptStatusLabel, stageLabel, PAYMENT_FAILED_AT, viaOf } from "./types";
import { GYM } from "./gym";
import { samePhone } from "./phone";
import { ukParts, ukTime, ukWeekStart } from "./time";

// Random ids. Contact ids also make the private link to someone's booking
// page (/book/<id>), so they come from a proper random source.
export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
};
export const nowMs = (s: State) => Date.now() + s.clockOffset;
export const nowIso = (s: State) => new Date(nowMs(s)).toISOString();
// TeamUp sometimes has no name, so the contact's name is their email address;
// never greet someone as "steph_tl17@hotmail.com".
export const firstName = (c: Contact) => c.firstName || (c.name.includes("@") ? "" : c.name.split(" ")[0]);

function log(s: State, type: EventType, contactId: string | undefined, detail: string, data?: Record<string, string>) {
  const ev: CrmEvent = { id: uid(), type, contactId, detail, at: nowIso(s), ...(data ? { data } : {}) };
  s.events.unshift(ev);
}

/**
 * What each {placeholder} in a message stands for, for this contact. Times
 * are UK times whatever machine this runs on. Never empty, because WhatsApp
 * refuses a template with an empty value.
 */
export function placeholders(c: Contact): Record<string, string> {
  const trial = c.trialAt ? new Date(c.trialAt) : null;
  const uk = (o: Intl.DateTimeFormatOptions) => (trial ? trial.toLocaleString("en-GB", { timeZone: "Europe/London", ...o }) : "");
  return {
    first: firstName(c) || "there",
    name: c.name || "there",
    trial: trial ? uk({ weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }) : "your booked session",
    trialTime: trial ? uk({ hour: "numeric", minute: "2-digit", hour12: true }) : "the booked time",
    date: trial ? uk({ weekday: "long", day: "numeric", month: "long" }) : "your booked day",
    time: trial ? uk({ hour: "numeric", minute: "2-digit", hour12: true }) : "the booked time",
    address: GYM.address,
    gym: GYM.name,
    team: GYM.signOff,
    // Accountability programme (docs/accountability.md)
    floor: c.accountability ? times(c.accountability.floor) : "your floor",
    stretch: c.accountability ? times(c.accountability.stretch) : "your stretch",
    why: c.accountability?.why || "what you told us",
    slot: c.accountability?.slot || "your check-in time",
    goal: c.accountability?.goals.join(" and ") || "your goal",
    attended: c.accountability ? sessions(c.accountability.attendance?.thisWeek ?? 0) : "your sessions",
    paceLine: c.accountability ? paceLine(c.accountability) : "",
  };
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const sessions = (n: number) => (n === 1 ? "1 session" : `${n} sessions`);

/** One line on where they are against their floor this week, in the tone they picked. */
export function paceLine(a: Accountability) {
  const n = a.attendance?.thisWeek ?? 0;
  const gap = a.floor - n;
  if (n >= a.stretch) return a.style === "facts" ? `${sessions(n)} this week. Stretch target met.` : a.style === "straight" ? `${sessions(n)} this week. That’s your stretch. No notes.` : `${sessions(n)} this week. That’s your stretch target, which is a brilliant week.`;
  if (gap <= 0) return a.style === "facts" ? `${sessions(n)} this week. Floor met.` : a.style === "straight" ? `${sessions(n)} this week. Floor done. Push for the stretch.` : `${sessions(n)} this week. Floor done, nicely. The stretch is there if you want it.`;
  if (a.style === "facts") return `${sessions(n)} this week. Floor is ${times(a.floor)}. Short by ${gap}.`;
  if (a.style === "straight") return `${sessions(n)} this week against a floor of ${times(a.floor)}. You said: “${a.why}”. ${gap === 1 ? "One more" : `${gap} more`} gets it done.`;
  return `${sessions(n)} this week, and your floor is ${times(a.floor)}. You told us why this matters: “${a.why}”. There’s still room to get ${gap === 1 ? "one more" : `${gap} more`} in.`;
}

/** Fills in {first}, {date} etc. Unknown ones (like {bookLink}) are left for the server. */
export function fill(text: string, c: Contact) {
  const v = placeholders(c);
  return text.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
}

/** The placeholders in a template, in order: WhatsApp's {{1}}, {{2}}… */
export const templateParams = (body: string) => [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

// ---- Automations ----------------------------------------------------------

type Fired =
  | { type: "form.submitted"; contactId: string; formId: string }
  | { type: "stage.changed"; contactId: string; stage: Stage }
  | { type: "tag.added"; contactId: string; tag: string }
  | { type: "appointment.status"; contactId: string; status: Appointment["status"] }
  | { type: "appointment.moved"; contactId: string }
  | { type: "membership.started"; contactId: string; category: string }
  | { type: "membership.ending"; contactId: string; category: string; daysBefore: number }
  | { type: "membership.cancelling"; contactId: string; category: string }
  | { type: "payment.failed"; contactId: string; category: string }
  | { type: "membership.ended"; contactId: string; category: string }
  | { type: "accountability.joined"; contactId: string }
  | { type: "accountability.checkin"; contactId: string }
  | { type: "accountability.nudge"; contactId: string };

const sameCategory = (want: string | undefined, got: string) => !want || want.trim().toLowerCase() === got.trim().toLowerCase();

function matches(s: State, a: Automation, ev: Fired) {
  const t = a.trigger;
  if (t.type !== ev.type) return false;
  if ("via" in t && t.via) {
    const c = s.contacts.find((x) => x.id === ev.contactId);
    if (!c || viaOf(c) !== t.via) return false;
  }
  if (t.type === "form.submitted" && ev.type === "form.submitted") return t.formId === ev.formId;
  if (t.type === "stage.changed" && ev.type === "stage.changed") return t.to === ev.stage;
  if (t.type === "tag.added" && ev.type === "tag.added") return t.tag === ev.tag;
  if (t.type === "appointment.status" && ev.type === "appointment.status") return t.status === ev.status;
  if (t.type === "appointment.moved" && ev.type === "appointment.moved") return true;
  if (t.type === "membership.started" && ev.type === "membership.started") return sameCategory(t.category, ev.category);
  if (t.type === "membership.ended" && ev.type === "membership.ended") return sameCategory(t.category, ev.category);
  if (t.type === "membership.cancelling" && ev.type === "membership.cancelling") return sameCategory(t.category, ev.category);
  if (t.type === "payment.failed" && ev.type === "payment.failed") return sameCategory(t.category, ev.category);
  if (t.type === "membership.ending" && ev.type === "membership.ending") return t.daysBefore === ev.daysBefore && sameCategory(t.category, ev.category);
  if (t.type === "accountability.joined" && ev.type === "accountability.joined") return true;
  if (t.type === "accountability.checkin" && ev.type === "accountability.checkin") return true;
  if (t.type === "accountability.nudge" && ev.type === "accountability.nudge") return true;
  return false;
}

function fire(s: State, ev: Fired) {
  for (const a of s.automations) {
    if (!a.enabled || !matches(s, a, ev)) continue;
    a.runs += 1;
    const run: Run = { id: uid(), automationId: a.id, contactId: ev.contactId, stepIndex: 0, status: "running", startedAt: nowIso(s) };
    s.runs.unshift(run);
    advanceRun(s, run);
  }
}

function advanceRun(s: State, run: Run) {
  const a = s.automations.find((x) => x.id === run.automationId);
  const c = s.contacts.find((x) => x.id === run.contactId);
  if (!a || !c) {
    run.status = "stopped";
    return;
  }
  while (run.stepIndex < a.steps.length) {
    const step = a.steps[run.stepIndex];
    run.stepIndex += 1;
    switch (step.kind) {
      case "whatsapp":
        sendTemplate(s, c, step.template, a.name);
        break;
      case "email": {
        // Only recorded here. On the live server, src/lib/server/deliver.ts
        // sends it once the change is saved.
        const subject = fill(step.subject, c);
        const data: Record<string, string> = { to: step.to, subject, automation: a.id };
        if (step.body) data.body = fill(step.body, c);
        if (step.marketing) data.marketing = "yes";
        log(s, "email.sent", c.id, step.to === "staff" ? `${subject} to the front desk` : `${subject} to ${c.name}`, data);
        break;
      }
      case "wait":
        run.status = "waiting";
        run.resumeAt = new Date(nowMs(s) + step.hours * 3600e3).toISOString();
        return;
      case "wait_until_trial": {
        const at = c.trialAt ? Date.parse(c.trialAt) - step.hoursBefore * 3600e3 : nowMs(s);
        if (at > nowMs(s)) {
          run.status = "waiting";
          run.resumeAt = new Date(at).toISOString();
          return;
        }
        // Too late for this one (booked at short notice): skip what it was waiting to send.
        if (step.skipIfLate && c.trialAt) run.stepIndex += 1;
        break;
      }
      case "if_stage_in":
        if (!step.stages.includes(c.stage)) {
          run.status = "stopped";
          run.resumeAt = undefined;
          log(s, "automation.stopped", c.id, `${a.name} finished early: ${firstName(c)} is now ${stageLabel(c.stage)}`);
          return;
        }
        break;
      case "task": {
        const text = fill(step.text, c);
        s.tasks.unshift({ id: uid(), contactId: c.id, text, done: false, at: nowIso(s) });
        log(s, "task.created", c.id, text);
        break;
      }
    }
  }
  run.status = "done";
  run.resumeAt = undefined;
}

/** Resume any waiting runs whose time has come. Called after every change. */
export function tick(s: State) {
  for (const r of s.runs) {
    if (r.status === "waiting" && r.resumeAt && Date.parse(r.resumeAt) <= nowMs(s)) {
      r.status = "running";
      advanceRun(s, r);
    }
  }
}

export function stopRun(s: State, runId: string) {
  const r = s.runs.find((x) => x.id === runId);
  if (!r) return;
  r.status = "stopped";
  r.resumeAt = undefined;
  const a = s.automations.find((x) => x.id === r.automationId);
  log(s, "automation.stopped", r.contactId, `${a?.name ?? "Automation"} stopped by staff`);
}

/** Staff edit the wording of an email step (e.g. the win-back) from a screen. */
export function setEmailStep(s: State, automationId: string, stepIndex: number, subject: string, body: string) {
  const a = s.automations.find((x) => x.id === automationId);
  const step = a?.steps[stepIndex];
  if (!a || !step || step.kind !== "email") return;
  step.subject = subject.trim().slice(0, 200);
  step.body = body.trim().slice(0, 20000);
  log(s, "automation.changed", undefined, `${a.name}: live wording changed to “${step.subject}”`, { automation: a.id, subject: step.subject });
}

export function toggleAutomation(s: State, id: string) {
  const a = s.automations.find((x) => x.id === id);
  if (!a) return;
  a.enabled = !a.enabled;
  log(s, "automation.changed", undefined, `${a.name}: switched ${a.enabled ? "on" : "off"}`, { automation: a.id, enabled: a.enabled ? "yes" : "no" });
}

export function describeStep(step: Step, templates: Record<string, string>) {
  switch (step.kind) {
    case "whatsapp": return { kind: "Do", title: "Send WhatsApp template", detail: step.template, preview: templates[step.template] };
    case "email": return { kind: "Do", title: step.to === "staff" ? "Email the front desk" : "Email the contact", detail: step.subject };
    case "wait": return { kind: "Wait", title: step.hours % 24 === 0 ? `Wait ${step.hours / 24} day${step.hours === 24 ? "" : "s"}` : `Wait ${step.hours} hours`, detail: "" };
    case "wait_until_trial": return {
      kind: "Wait",
      title: `Wait until ${step.hoursBefore % 24 === 0 ? `${step.hoursBefore / 24} day${step.hoursBefore === 24 ? "" : "s"}` : `${step.hoursBefore} hours`} before the trial`,
      detail: step.skipIfLate ? "If they booked later than that, skip the next step" : "",
    };
    case "if_stage_in": return { kind: "If", title: `Still in ${step.stages.map(stageLabel).join(" or ")}`, detail: "Otherwise stop here" };
    case "task": return { kind: "Do", title: "Create a task for staff", detail: step.text };
  }
}

export function describeTrigger(a: Automation, forms: Form[]) {
  const t = a.trigger;
  if (t.type === "form.submitted") return `Form submitted: ${forms.find((f) => f.id === t.formId)?.name ?? t.formId}`;
  if (t.type === "stage.changed") return `Stage changes to ${stageLabel(t.to)}`;
  if (t.type === "appointment.status") return `Free trial marked ${apptStatusLabel(t.status).toLowerCase()}`;
  if (t.type === "appointment.moved") return "Free trial moved to a new time";
  const cat = (c?: string) => (c ? ` (${c})` : "");
  const via = "via" in t && t.via ? (t.via === "crm" ? " · came through the CRM" : " · signed up in TeamUp") : "";
  if (t.type === "membership.started") return `Membership starts${cat(t.category)}${via}`;
  if (t.type === "membership.ending") return `Membership ends in ${t.daysBefore} day${t.daysBefore === 1 ? "" : "s"}${cat(t.category)}${via}`;
  if (t.type === "membership.cancelling") return `Gives notice to cancel${cat(t.category)}${via}`;
  if (t.type === "payment.failed") return `Payment fails ${PAYMENT_FAILED_AT} times${cat(t.category)}${via}`;
  if (t.type === "membership.ended") return `Membership ends${cat(t.category)}${via}`;
  if (t.type === "accountability.joined") return "Joins the accountability programme";
  if (t.type === "accountability.checkin") return "Their weekly check-in time comes round";
  if (t.type === "accountability.nudge") return "Mid-week, and they want or need a nudge";
  return `Tagged “${t.tag}”`;
}

// ---- Contacts and messages ------------------------------------------------

export function sendTemplate(s: State, c: Contact, template: string, by: string) {
  const text = fill(s.templates[template] ?? template, c);
  s.messages.push({ id: uid(), contactId: c.id, dir: "out", text, template, by, at: nowIso(s) });
  log(s, "whatsapp.sent", c.id, `${template} to ${c.name}`);
}

/** Staff sending an approved template by hand (outside the 24-hour window). */
export function sendTemplateTo(s: State, contactId: string, template: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (c && s.templates[template]) sendTemplate(s, c, template, "You");
}

/** Prototype only: move the pretend clock forward. Never runs on the server. */
export function shiftClock(s: State, hours: number) {
  s.clockOffset += hours * 3600e3;
}

export function sendMessage(s: State, contactId: string, text: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || !text.trim()) return;
  s.messages.push({ id: uid(), contactId, dir: "out", text: text.trim(), by: "You", at: nowIso(s) });
  log(s, "whatsapp.sent", contactId, `Reply to ${c.name}`);
}

export function receiveMessage(s: State, contactId: string, text: string, id = uid()) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return;
  s.messages.push({ id, contactId, dir: "in", text, at: nowIso(s) });
  log(s, "whatsapp.received", contactId, `From ${c.name}`);
  // "STOP" (on its own, any case) opts them out of marketing messages.
  if (/^\s*(stop|unsubscribe|opt ?out)\s*[.!]?\s*$/i.test(text) && !c.marketingOptOut) setMarketingOptOut(s, contactId, true, "they replied STOP");
  // A reply ends any flow that is waiting for one (e.g. the booking push).
  for (const r of s.runs) {
    if (r.contactId !== contactId || (r.status !== "waiting" && r.status !== "running")) continue;
    const a = s.automations.find((x) => x.id === r.automationId);
    if (!a?.stopOnReply) continue;
    r.status = "stopped";
    r.resumeAt = undefined;
    log(s, "automation.stopped", contactId, `${a.name} stopped: ${firstName(c)} replied`);
  }
  if (c.stage === "new") setStage(s, contactId, "contacted");
}

/**
 * A WhatsApp message arriving from Meta's webhook. Finds the contact by
 * mobile number, or adds them if it's someone new. `id` is based on Meta's
 * message id, so the same message is never added twice.
 */
export function receiveWhatsApp(s: State, input: { id: string; phone: string; name?: string; text: string }) {
  if (s.messages.some((m) => m.id === input.id)) return;
  let c = s.contacts.find((x) => samePhone(x.phone, input.phone));
  if (!c) {
    c = { id: uid(), name: input.name?.trim() || input.phone, phone: input.phone, email: "", source: "whatsapp", stage: "new", tags: [], answers: [], createdAt: nowIso(s) };
    s.contacts.unshift(c);
    log(s, "contact.created", c.id, `${c.name} messaged on WhatsApp`);
  }
  receiveMessage(s, c.id, input.text, input.id);
}

export function setStage(s: State, contactId: string, stage: Stage, opts: { lostReason?: string } = {}) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || c.stage === stage) return;
  const from = c.stage;
  c.stage = stage;
  c.lostReason = stage === "lost" ? opts.lostReason || "Other" : undefined;
  // Moving someone to Appointment booked (e.g. dragging on the pipeline) puts
  // a trial in the calendar too, tomorrow at 18:00, so the two never disagree.
  if (stage === "booked" && !activeTrial(s, contactId)) {
    const d = ukTime(nowMs(s), 1, 18);
    const cal = s.calendars.find((x) => x.bookTrial);
    if (cal) createAppointment(s, { contactId, calendarId: cal.id, staffId: s.staff[0]?.id ?? "", start: d.toISOString() });
  }
  const why = c.lostReason ? ` (${c.lostReason})` : "";
  log(s, "stage.changed", contactId, `${c.name}: ${stageLabel(from)} to ${stageLabel(stage)}${why}`);
  fire(s, { type: "stage.changed", contactId, stage });
}

// ---- Calendar ------------------------------------------------------------

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The contact's upcoming, not-cancelled trial appointment, if any. */
export function activeTrial(s: State, contactId: string) {
  const trialCals = s.calendars.filter((x) => x.bookTrial).map((x) => x.id);
  return s.appointments
    .filter((a) => a.contactId === contactId && trialCals.includes(a.calendarId) && (a.status === "booked" || a.status === "confirmed"))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .at(-1);
}

/** After a trial moves, re-time any automation waiting for "X hours before the trial". */
function retimeTrialWaits(s: State, contactId: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  for (const r of s.runs) {
    if (r.contactId !== contactId || r.status !== "waiting") continue;
    const prev = s.automations.find((a) => a.id === r.automationId)?.steps[r.stepIndex - 1];
    if (prev?.kind !== "wait_until_trial") continue;
    if (!c?.trialAt) {
      r.status = "stopped";
      r.resumeAt = undefined;
    } else {
      r.resumeAt = new Date(Date.parse(c.trialAt) - prev.hoursBefore * 3600e3).toISOString();
    }
  }
}

export function createAppointment(
  s: State,
  input: { contactId: string; calendarId: string; staffId: string; start: string; durationMin?: number; notes?: string },
  id = uid(),
) {
  const c = s.contacts.find((x) => x.id === input.contactId);
  const cal = s.calendars.find((x) => x.id === input.calendarId);
  if (!c || !cal) return;
  const start = Date.parse(input.start);
  const appt = {
    id,
    contactId: c.id,
    calendarId: cal.id,
    staffId: input.staffId,
    start: new Date(start).toISOString(),
    end: new Date(start + (input.durationMin ?? cal.durationMin) * 60e3).toISOString(),
    status: "booked" as const,
    notes: input.notes,
    createdAt: nowIso(s),
  };
  s.appointments.push(appt);
  const coach = s.staff.find((x) => x.id === input.staffId)?.name;
  log(s, "appointment.booked", c.id, `${cal.name} for ${c.name}, ${when(appt.start)}${coach ? ` with ${coach}` : ""}`);
  if (cal.bookTrial) {
    c.trialAt = appt.start;
    if (c.stage === "booked") retimeTrialWaits(s, c.id);
    else setStage(s, c.id, "booked");
  }
}

export function rescheduleAppointment(s: State, id: string, patch: { start?: string; staffId?: string; notes?: string }) {
  const a = s.appointments.find((x) => x.id === id);
  if (!a) return;
  const c = s.contacts.find((x) => x.id === a.contactId);
  const cal = s.calendars.find((x) => x.id === a.calendarId);
  if (patch.start && patch.start !== a.start) {
    const len = Date.parse(a.end) - Date.parse(a.start);
    a.start = new Date(patch.start).toISOString();
    a.end = new Date(Date.parse(a.start) + len).toISOString();
    log(s, "appointment.updated", a.contactId, `${cal?.name} for ${c?.name} moved to ${when(a.start)}`);
    if (cal?.bookTrial && c && (a.status === "booked" || a.status === "confirmed")) {
      c.trialAt = a.start;
      retimeTrialWaits(s, c.id);
      fire(s, { type: "appointment.moved", contactId: c.id });
    }
  }
  if (patch.staffId && patch.staffId !== a.staffId) {
    a.staffId = patch.staffId;
    log(s, "appointment.updated", a.contactId, `${cal?.name} for ${c?.name} now with ${s.staff.find((x) => x.id === a.staffId)?.name}`);
  }
  if (patch.notes !== undefined) a.notes = patch.notes;
}

export function setAppointmentStatus(s: State, id: string, status: Appointment["status"]) {
  const a = s.appointments.find((x) => x.id === id);
  if (!a || a.status === status) return;
  const c = s.contacts.find((x) => x.id === a.contactId);
  const cal = s.calendars.find((x) => x.id === a.calendarId);
  a.status = status;
  log(s, "appointment.updated", a.contactId, `${c?.name}’s ${cal?.name.toLowerCase()} marked ${apptStatusLabel(status).toLowerCase()}`);
  if (!c || !cal?.bookTrial) return;
  fire(s, { type: "appointment.status", contactId: c.id, status });

  if (status === "attended") {
    // The trial has happened, so stop anything still waiting to remind them.
    const other = activeTrial(s, c.id);
    c.trialAt = other?.start;
    retimeTrialWaits(s, c.id);
    if (c.stage === "booked" || c.stage === "no_show") setStage(s, c.id, "attended");
  }
  if (status === "no_show") {
    c.trialAt = undefined;
    retimeTrialWaits(s, c.id);
    if (c.stage === "booked") setStage(s, c.id, "no_show");
    addTag(s, c.id, "no-show");
  }
  if (status === "cancelled") {
    const other = activeTrial(s, c.id);
    c.trialAt = other?.start;
    retimeTrialWaits(s, c.id);
    if (!other && c.stage === "booked") setStage(s, c.id, "contacted");
  }
  if (status === "booked" || status === "confirmed") {
    c.trialAt = a.start;
    if (c.stage !== "booked") setStage(s, c.id, "booked");
    else retimeTrialWaits(s, c.id);
  }
}

/** Book or move this contact's free trial. */
export function bookTrial(s: State, contactId: string, at: string) {
  const existing = activeTrial(s, contactId);
  if (existing) return rescheduleAppointment(s, existing.id, { start: new Date(at).toISOString() });
  const cal = s.calendars.find((x) => x.bookTrial);
  if (cal) createAppointment(s, { contactId, calendarId: cal.id, staffId: s.staff[0]?.id ?? "", start: new Date(at).toISOString() });
}

export function addTag(s: State, contactId: string, tag: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || c.tags.includes(tag)) return;
  c.tags.push(tag);
  log(s, "tag.added", contactId, `${c.name} tagged “${tag}”`);
  fire(s, { type: "tag.added", contactId, tag });
}

export function markNoShow(s: State, contactId: string) {
  const trial = activeTrial(s, contactId);
  if (trial) return setAppointmentStatus(s, trial.id, "no_show");
  setStage(s, contactId, "no_show");
  addTag(s, contactId, "no-show");
}

export function addContact(s: State, input: { name: string; phone: string; email: string; source: Source }, id = uid()) {
  const c: Contact = { id, ...input, stage: "new", tags: [], answers: [], createdAt: nowIso(s) };
  s.contacts.unshift(c);
  log(s, "contact.created", c.id, `${c.name} added by staff`);
  return c.id;
}

export interface Attribution {
  source?: string; // utm_source
  campaign?: string; // utm_campaign
  adset?: string; // utm_term
  ad?: string; // utm_content
  adId?: string; // ad_id
  fbclid?: string;
}

/**
 * A link that behaves like a click on a real Meta ad. In Ads Manager the URL
 * parameters would be: utm_source=facebook&utm_campaign={{campaign.name}}
 * &utm_term={{adset.name}}&utm_content={{ad.name}}&ad_id={{ad.id}}
 */
export const demoAdLink = (slug: string) =>
  `/f/${slug}?` +
  new URLSearchParams({
    utm_source: "facebook",
    utm_campaign: "womens_boxing",
    utm_term: "Women 22–45",
    utm_content: "Women’s session reel",
    ad_id: "ad_301",
  }).toString();

/** Read attribution off a landing URL's query string. */
export function readAttribution(search: string): Attribution {
  const p = new URLSearchParams(search);
  const get = (k: string) => p.get(k) ?? undefined;
  return { source: get("utm_source"), campaign: get("utm_campaign"), adset: get("utm_term"), ad: get("utm_content"), adId: get("ad_id"), fbclid: get("fbclid") };
}

export function submitForm(s: State, formId: string, answers: Record<string, string>, utm: Attribution, newId = uid(), contactId?: string) {
  const form = s.forms.find((f) => f.id === formId);
  if (!form) return;
  const byField = (field: string) => {
    const q = form.questions.find((x) => x.field === field);
    return q ? (answers[q.id] ?? "").trim() : "";
  };
  const nameQ = form.questions.find((x) => x.field === "name");
  const first = nameQ?.type === "name" ? (answers[`${nameQ.id}.first`] ?? "").trim().replace(/\s+/g, " ") : "";
  const last = nameQ?.type === "name" ? (answers[`${nameQ.id}.last`] ?? "").trim().replace(/\s+/g, " ") : "";
  const name = [first, last].filter(Boolean).join(" ") || byField("name") || "Unknown";
  const phone = byField("phone");
  const email = byField("email").toLowerCase();
  const fromMeta = !!utm.fbclid || /facebook|instagram|meta/i.test(utm.source ?? "");
  const source: Source = fromMeta ? "meta_ad" : "website";
  const qa = form.questions.filter((q) => !q.field).map((q) => ({ question: q.text, answer: answers[q.id] ?? "" }));

  // A personalised link names the contact (the accountability form has no
  // contact questions); otherwise match on phone number before creating one.
  let c = (contactId ? s.contacts.find((x) => x.id === contactId) : undefined) ?? (phone ? s.contacts.find((x) => samePhone(x.phone, phone)) : undefined);
  if (contactId && !c) return;
  if (c) {
    // Same number, filled in again: take the newer details (a corrected
    // name or email), but keep their stage and any booking.
    c.answers = qa;
    if (name !== "Unknown") c.name = name;
    if (first) c.firstName = first;
    if (email) c.email = email;
  } else {
    // Match the ad by id first, then by name within the campaign.
    const ad = s.campaigns
      .flatMap((k) => k.ads.map((a) => ({ ...a, utm: k.utm })))
      .find((a) => (utm.adId && a.id === utm.adId) || (a.name === utm.ad && (!utm.campaign || a.utm === utm.campaign)));
    c = {
      id: newId, name, ...(first ? { firstName: first } : {}), phone, email, source,
      campaign: ad?.utm ?? utm.campaign,
      adset: ad?.adset ?? utm.adset,
      ad: ad?.name ?? utm.ad,
      adId: ad?.id ?? utm.adId,
      stage: "new", tags: [], answers: qa, createdAt: nowIso(s),
    };
    s.contacts.unshift(c);
    log(s, "contact.created", c.id, `${c.name} from ${c.ad ? `ad “${c.ad}”` : form.name}`);
  }
  form.responses += 1;
  log(s, "form.submitted", c.id, `${c.name} · ${form.name}`);
  fire(s, { type: "form.submitted", contactId: c.id, formId });
  if (form.slug === "accountability") joinAccountability(s, c, form, answers);
  if (form.slug === "check-in") recordCheckin(s, c, answers);
  return c.id;
}

// ---- Accountability programme (docs/accountability.md) ---------------------

const leadingNumber = (s: string) => {
  const w = s.trim().toLowerCase();
  if (w.startsWith("once")) return 1;
  if (w.startsWith("twice")) return 2;
  if (w.startsWith("three")) return 3;
  if (w.startsWith("four")) return 4;
  if (w.startsWith("five")) return 5;
  const n = parseInt(w, 10);
  return Number.isFinite(n) ? n : 0;
};
const pickStyle = (s: string): Accountability["style"] => (/straight/i.test(s) ? "straight" : /fact/i.test(s) ? "facts" : "encourage");
const pickFrequency = (s: string): Accountability["frequency"] => (/daily|posted/i.test(s) ? "daily" : /pulse|regular/i.test(s) ? "pulse" : /weekly|just the weekly/i.test(s) ? "weekly" : "slipping");
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Turns the commitment form's answers into the member's commitment. Answers are read by question id (a_floor, a_stretch…). */
export function joinAccountability(s: State, c: Contact, form: Form, answers: Record<string, string>) {
  const get = (id: string) => (answers[id] ?? "").trim();
  const floor = Math.min(3, Math.max(1, leadingNumber(get("a_floor")) || 1));
  const stretch = Math.max(floor, Math.min(5, leadingNumber(get("a_stretch")) || floor));
  const prev = c.accountability;
  c.accountability = {
    active: true,
    joinedAt: prev?.active ? prev.joinedAt : nowIso(s),
    floor, stretch,
    goals: splitList(get("a_goal")),
    why: get("a_why").slice(0, 1000),
    derailers: splitList(get("a_derail")),
    style: pickStyle(get("a_style")),
    frequency: pickFrequency(get("a_freq")),
    slot: get("a_slot") || form.questions.find((q) => q.id === "a_slot")?.options?.[0] || "",
    coachNotes: get("a_notes").slice(0, 2000) || undefined,
  };
  log(s, "accountability.joined", c.id, `${c.name} committed to ${times(floor)} a week (stretch ${times(stretch)}), check-in ${c.accountability.slot}`);
  if (!prev?.active) fire(s, { type: "accountability.joined", contactId: c.id });
}

/**
 * One member's sessions, counted into this week and last (Monday to Sunday,
 * UK). Attendance truth is TeamUp classes plus Kisi door entries (rule 7):
 * a class counts only when staff ticked them in (Sammy, 09/10/2026: the
 * front desk ticks people in, so a booking left un-ticked is a no-show); a
 * door entry counts as a session. One session per UK day at most, so a
 * class and the door swipe for it aren't counted twice. Quiet: no events.
 */
export function recordAttendance(s: State, contactId: string, attended: { at: string; status: string }[], doorEntries: { at: string }[] = []) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c?.accountability) return;
  const now = nowMs(s);
  const thisStart = ukWeekStart(now).getTime();
  const lastStart = ukTime(thisStart, -7, 0, 0).getTime();
  const classes = attended.filter((a) => a.status === "attended" && Date.parse(a.at) <= now).map((a) => a.at);
  const doors = doorEntries.map((d) => d.at).filter((at) => Date.parse(at) <= now);
  const byDay = new Map<string, string>(); // UK date → earliest time that day
  for (const at of [...classes, ...doors]) {
    const day = ukParts(Date.parse(at)).date;
    const cur = byDay.get(day);
    if (!cur || at < cur) byDay.set(day, at);
  }
  const all = [...byDay.values()].sort();
  const sessionsThisWeek = all.filter((at) => Date.parse(at) >= thisStart);
  const lastWeek = all.filter((at) => Date.parse(at) >= lastStart && Date.parse(at) < thisStart).length;
  c.accountability = { ...c.accountability, attendance: { weekStart: new Date(thisStart).toISOString(), thisWeek: sessionsThisWeek.length, lastWeek, sessions: sessionsThisWeek, syncedAt: nowIso(s), doorEntries: doors.filter((at) => Date.parse(at) >= lastStart).length || undefined } };
}

const SLOT = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** When this week's check-in falls for a slot like "Sunday 6pm", as a time; null if the slot can't be read. */
export function slotTimeThisWeek(slot: string, nowMsValue: number): number | null {
  const m = SLOT.exec(slot.trim());
  if (!m) return null;
  const day = DAYS.indexOf(m[1].toLowerCase());
  let hour = Number(m[2]) % 12;
  if ((m[4] ?? "").toLowerCase() === "pm") hour += 12;
  if (!m[4] && Number(m[2]) > 12) hour = Number(m[2]);
  const minute = Number(m[3] ?? 0);
  const monday = ukWeekStart(nowMsValue).getTime();
  const offset = (day + 6) % 7; // days after Monday
  return ukTime(monday, offset, hour, minute).getTime();
}

/** Members whose weekly check-in is due now and hasn't gone this week. */
export function dueCheckins(s: State): Contact[] {
  const now = nowMs(s);
  return s.contacts.filter((c) => {
    const a = c.accountability;
    if (!a?.active || c.membership?.status !== "active") return false; // lapsed means silence
    const at = slotTimeThisWeek(a.slot, now);
    if (at === null || now < at) return false;
    return !a.lastCheckinAt || Date.parse(a.lastCheckinAt) < at;
  });
}

/** Sends this week's check-in to everyone due: an event, and the check-in automation if it's on. */
export function sendCheckins(s: State) {
  let n = 0;
  for (const c of dueCheckins(s)) {
    const a = c.accountability!;
    c.accountability = { ...a, lastCheckinAt: nowIso(s) };
    log(s, "accountability.checkin", c.id, `Weekly check-in for ${c.name}: ${sessions(a.attendance?.thisWeek ?? 0)} against a floor of ${times(a.floor)}`, { week: ukParts(nowMs(s)).date });
    fire(s, { type: "accountability.checkin", contactId: c.id });
    n++;
  }
  return n;
}

/** Their answers to the weekly check-in form (/f/check-in). "I want a word with a coach" makes a task. */
export function recordCheckin(s: State, c: Contact, answers: Record<string, string>) {
  if (!c.accountability) return;
  const get = (id: string) => (answers[id] ?? "").trim();
  const entry: Checkin = { week: ukParts(nowMs(s)).date, at: nowIso(s), feel: get("ci_feel"), blocker: get("ci_blocker") || undefined, play: get("ci_play") };
  c.accountability = { ...c.accountability, checkins: [entry, ...(c.accountability.checkins ?? [])].slice(0, 52) };
  log(s, "accountability.checkin_received", c.id, `${c.name} checked in: ${entry.feel || "no answer"}${entry.play ? ` · ${entry.play}` : ""}${entry.blocker ? ` · “${entry.blocker.slice(0, 80)}”` : ""}`);
  if (/coach/i.test(entry.play) || /write-off|struggled/i.test(entry.feel)) {
    const text = /coach/i.test(entry.play) ? `${firstName(c) || c.name} wants a word with a coach (weekly check-in)` : `${firstName(c) || c.name} had a ${entry.feel.toLowerCase()} week${entry.blocker ? `: “${entry.blocker.slice(0, 120)}”` : ""}`;
    s.tasks.unshift({ id: uid(), contactId: c.id, text, done: false, at: nowIso(s) });
    log(s, "task.created", c.id, text);
  }
}

/** The server's Claude read of a check-in, stored against it. Quiet: no event. */
export function setCheckinAi(s: State, contactId: string, at: string, ai: NonNullable<Checkin["ai"]>) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c?.accountability?.checkins) return;
  c.accountability = { ...c.accountability, checkins: c.accountability.checkins.map((k) => (k.at === at ? { ...k, ai } : k)) };
}

/** Staff approved a reply to a check-in: it goes as an email from bookings@ (deliver.ts sends email.sent events). */
export function replyToCheckin(s: State, contactId: string, at: string, text: string, by: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  const k = c?.accountability?.checkins?.find((x) => x.at === at);
  if (!c || !k || !text.trim()) return;
  c.accountability = { ...c.accountability!, checkins: c.accountability!.checkins!.map((x) => (x.at === at ? { ...x, repliedAt: nowIso(s) } : x)) };
  const subject = `Re: your week, ${firstName(c) || "there"}`;
  log(s, "accountability.replied", c.id, `${by} replied to ${c.name}’s check-in`);
  log(s, "email.sent", c.id, `${subject} to ${c.name}`, { to: "contact", subject, body: text.trim(), automation: "accountability_reply" });
}

/** Staff chose not to reply to a check-in. */
export function dismissCheckin(s: State, contactId: string, at: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c?.accountability?.checkins) return;
  c.accountability = { ...c.accountability, checkins: c.accountability.checkins.map((k) => (k.at === at ? { ...k, dismissedAt: nowIso(s) } : k)) };
}

/** The mid-week nudge hour, UK. Thursday for the weekly pulse; every day for "keep me posted". */
export const NUDGE_HOUR = 17;

/**
 * Who gets a nudge now (docs/accountability.md rule 6: silence when on
 * pace). "slipping": Thursday, only if under the floor. "pulse": every
 * Thursday. "daily": every day from Tuesday, once a day. "weekly": never.
 */
export function dueNudges(s: State): Contact[] {
  const now = nowMs(s);
  const { weekday, hour, date } = ukParts(now);
  if (hour < NUDGE_HOUR) return [];
  const thursday = weekday === 4;
  return s.contacts.filter((c) => {
    const a = c.accountability;
    if (!a?.active || c.membership?.status !== "active") return false;
    if (a.lastNudgeAt && ukParts(Date.parse(a.lastNudgeAt)).date === date) return false; // once a day at most
    const sentThisWeek = a.lastNudgeAt ? Date.parse(a.lastNudgeAt) >= ukWeekStart(now).getTime() : false;
    const under = (a.attendance?.thisWeek ?? 0) < a.floor;
    if (a.frequency === "weekly") return false;
    if (a.frequency === "daily") return weekday >= 2 || weekday === 0; // Tuesday to Sunday
    if (!thursday || sentThisWeek) return false;
    return a.frequency === "pulse" || under;
  });
}

export function sendNudges(s: State) {
  let n = 0;
  for (const c of dueNudges(s)) {
    c.accountability = { ...c.accountability!, lastNudgeAt: nowIso(s) };
    log(s, "accountability.nudge", c.id, `Mid-week nudge for ${c.name}: ${sessions(c.accountability!.attendance?.thisWeek ?? 0)} against a floor of ${times(c.accountability!.floor)}`);
    fire(s, { type: "accountability.nudge", contactId: c.id });
    n++;
  }
  return n;
}

/**
 * The silence signal: on the programme, no sessions this week or last, and
 * no check-in answered in two weeks. One task for the coaches, at most once
 * a fortnight per member.
 */
export function flagSilence(s: State) {
  const now = nowMs(s);
  let n = 0;
  for (const c of s.contacts) {
    const a = c.accountability;
    if (!a?.active || c.membership?.status !== "active" || !a.attendance) continue;
    if (now - Date.parse(a.joinedAt) < 14 * 86400e3) continue; // give them a fortnight
    if (a.attendance.thisWeek > 0 || a.attendance.lastWeek > 0) continue;
    const lastAnswer = a.checkins?.[0]?.at;
    if (lastAnswer && now - Date.parse(lastAnswer) < 14 * 86400e3) continue;
    if (a.lastSilenceTaskAt && now - Date.parse(a.lastSilenceTaskAt) < 14 * 86400e3) continue;
    c.accountability = { ...a, lastSilenceTaskAt: nowIso(s) };
    const text = `${firstName(c) || c.name} has gone quiet: no sessions for two weeks and no check-in answered. Worth a call. They said: “${a.why}”`;
    s.tasks.unshift({ id: uid(), contactId: c.id, text, done: false, at: nowIso(s) });
    log(s, "accountability.silent", c.id, text);
    log(s, "task.created", c.id, text);
    n++;
  }
  return n;
}

// ---- Member activity and the inactivity alert (improvement item 18) --------

/** Staff set (or clear) a member's coach. */
export function setCoach(s: State, contactId: string, staffId: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return;
  const coach = s.staff.find((x) => x.id === staffId);
  c.coachId = coach ? coach.id : undefined;
  log(s, "stage.changed", c.id, coach ? `${c.name}’s coach is now ${coach.name}` : `${c.name} has no coach assigned`);
}

/**
 * Last night's sessions for every active member, from the bulk reads (TeamUp
 * ticked-in attendances plus Kisi door entries), already reduced to one
 * session per UK day. Quiet: no events. Someone who comes back after an
 * alert has their lapse cleared so the next one can fire.
 */
export function recordActivity(s: State, byContact: Map<string, string[]>) {
  const now = nowMs(s);
  const cutoff30 = now - 30 * 86400e3, cutoff60 = now - 60 * 86400e3;
  for (const c of s.contacts) {
    if (c.membership?.status !== "active") continue;
    const days = [...new Set(byContact.get(c.id) ?? [])].filter((d) => Date.parse(d) >= cutoff60).sort().reverse();
    const last30 = days.filter((d) => Date.parse(d) >= cutoff30).length;
    const prev30 = days.length - last30;
    const lastSeenAt = days[0];
    const prevAlert = c.activity?.alertedAt;
    const cameBack = prevAlert && lastSeenAt && Date.parse(lastSeenAt) > Date.parse(prevAlert);
    c.activity = { days, lastSeenAt, last30, prev30, syncedAt: nowIso(s), alertedAt: cameBack ? undefined : prevAlert };
  }
}

/**
 * Members who haven't been in for `days` days (or never, since a membership
 * that started that long ago): one task and one email to their coach (the
 * front desk if none), once per lapse.
 */
export function flagInactivity(s: State, days: number, opts: { baseline?: boolean } = {}) {
  const now = nowMs(s);
  let n = 0;
  for (const c of s.contacts) {
    const a = c.activity;
    const m = c.membership;
    if (!a || !m || m.status !== "active" || a.alertedAt) continue;
    const since = a.lastSeenAt ?? m.startedAt;
    if (!since || now - Date.parse(since) < days * 86400e3) continue;
    const gap = Math.floor((now - Date.parse(since)) / 86400e3);
    const coach = c.coachId ? s.staff.find((x) => x.id === c.coachId) : undefined;
    const text = a.lastSeenAt ? `${c.name} hasn’t been in for ${gap} days (${m.name}). Worth a message.` : `${c.name} started ${m.name} ${gap} days ago and hasn’t been in yet. Worth a message.`;
    c.activity = { ...a, alertedAt: nowIso(s) };
    // The very first run would alert about everyone already lapsed at once:
    // they're marked and shown in red on Members, but nobody is emailed.
    if (opts.baseline) { n++; continue; }
    s.tasks.unshift({ id: uid(), contactId: c.id, text, done: false, at: nowIso(s) });
    log(s, "task.created", c.id, text);
    log(s, "member.inactive", c.id, `${text}${coach ? ` Told ${coach.name}.` : " Told the front desk."}`);
    log(s, "email.sent", c.id, `Not been in: ${c.name}${coach ? ` to ${coach.name}` : " to the front desk"}`, {
      to: "staff", subject: `${c.name} hasn’t been in for ${gap} days`, body: `${text}

Last in: ${a.lastSeenAt ? a.lastSeenAt : "never"}. Sessions in the last 30 days: ${a.last30}; the 30 before: ${a.prev30}.`,
      ...(coach?.email ? { address: coach.email } : {}),
    });
    n++;
  }
  return n;
}

/** The server's Claude read of a contact's WhatsApp replies. Quiet: no event. */
export function setInsight(s: State, contactId: string, insight: { summary: string; suggestedReply?: string; fromMessages: number }) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return;
  c.insight = { ...insight, updatedAt: nowIso(s) };
}

/** Staff decided about the suggested reply: sent it (through sendMessage) or dropped it. */
export function settleInsightReply(s: State, contactId: string, used: boolean) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c?.insight) return;
  c.insight = { ...c.insight, ...(used ? { replyUsedAt: nowIso(s) } : { replyDismissedAt: nowIso(s) }) };
}

/** Staff end someone's place on the programme (or they asked to stop). */
export function leaveAccountability(s: State, contactId: string, reason = "") {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c?.accountability?.active) return;
  c.accountability = { ...c.accountability, active: false, leftAt: nowIso(s) };
  log(s, "accountability.left", c.id, `${c.name} left the accountability programme${reason ? `: ${reason}` : ""}`);
}

export function completeTask(s: State, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (t) t.done = true;
}

/** Stop (or allow again) marketing messages to someone. Messages about their own booking or membership still go. */
export function setMarketingOptOut(s: State, contactId: string, optOut: boolean, why = "set by staff") {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || !!c.marketingOptOut === optOut) return;
  c.marketingOptOut = optOut || undefined;
  log(s, "tag.added", contactId, optOut ? `${c.name} opted out of marketing: ${why}` : `${c.name} opted back in to marketing (${why})`);
  if (optOut) {
    // End any marketing flow that was waiting to message them.
    for (const r of s.runs) {
      if (r.contactId !== contactId || r.status !== "waiting") continue;
      const a = s.automations.find((x) => x.id === r.automationId);
      if (!a || !a.trigger.type.startsWith("membership.")) continue;
      r.status = "stopped";
      r.resumeAt = undefined;
      log(s, "automation.stopped", contactId, `${a.name} stopped: ${firstName(c)} opted out`);
    }
  }
}

// ---- TeamUp members ------------------------------------------------------

/** One TeamUp customer membership, as read by src/lib/server/teamup.ts. */
export interface MemberInput {
  customerId: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipName: string;
  category: string;
  status: Membership["status"];
  startedAt?: string;
  endsAt?: string;
  cancelling?: boolean; // TeamUp's is_set_for_cancellation
  paymentSubscriptionId?: string; // TeamUp payment subscription, for the failed-attempt count
  paymentRetries?: number; // failed attempts on the payment subscription
  owed?: Membership["owed"]; // unpaid invoices for the customer
  createdAt?: string; // when the customer first appeared in TeamUp
}

/** One TeamUp customer, with or without a membership (src/lib/server/teamup.ts). */
export interface CustomerInput {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
}

/** The TeamUp "came in" date is the truth for when someone first appeared. */
function backdate(c: Contact, createdAt?: string) {
  if (createdAt && Date.parse(createdAt) < Date.parse(c.createdAt)) c.createdAt = createdAt;
}

/**
 * Every TeamUp customer becomes a contact (source "teamup"), including the
 * people who made an account and never bought: they stay off the Pipeline
 * but can be picked for mailouts by when they came in. No automations fire;
 * this is bookkeeping, not an event in anyone's journey.
 */
export function importCustomers(s: State, inputs: CustomerInput[]) {
  let added = 0, updated = 0;
  for (const m of inputs) {
    let c =
      s.contacts.find((x) => x.teamup?.customerId === m.customerId) ??
      s.contacts.find((x) => x.membership?.customerId === m.customerId) ??
      (m.email ? s.contacts.find((x) => x.email && x.email.toLowerCase() === m.email) : undefined);
    if (!c) {
      c = { id: uid(), name: m.name || m.email || "TeamUp customer", phone: m.phone, email: m.email, source: "teamup", stage: "new", tags: [], answers: [], createdAt: m.createdAt ?? nowIso(s) };
      s.contacts.unshift(c);
      log(s, "contact.created", c.id, `${c.name} from TeamUp (no membership)`);
      added++;
    } else {
      if (!c.email && m.email) c.email = m.email;
      if (!c.phone && m.phone) c.phone = m.phone;
      if (c.source === "teamup") backdate(c, m.createdAt);
      updated++;
    }
    c.teamup = { customerId: m.customerId, status: m.status, createdAt: m.createdAt, syncedAt: nowIso(s) };
  }
  return { added, updated };
}

const isProgramme = (m: { category: string; membershipName: string }) => /program/i.test(m.category) || /program/i.test(m.membershipName);

/**
 * Applies what TeamUp says about everyone's memberships. Members are
 * contacts: new people are added (source "teamup"), existing ones matched on
 * TeamUp id, email or mobile. Fires membership.started when a membership is
 * new to the CRM and recent, membership.ended when one that was active has
 * ended, and moves the stage to the matching Sold stage.
 *
 * `baseline` is true for the very first sync, so hundreds of existing members
 * don't each get a welcome message.
 */
export function importMembers(s: State, inputs: MemberInput[], opts: { baseline?: boolean } = {}) {
  const now = nowMs(s);
  // One membership per customer: the active one, else the most recent.
  const best = new Map<string, MemberInput>();
  for (const m of inputs) {
    const cur = best.get(m.customerId);
    const rank = (x: MemberInput) => (x.status === "active" ? 2 : x.status === "on_hold" ? 1 : 0) * 1e13 + (x.startedAt ? Date.parse(x.startedAt) : 0);
    if (!cur || rank(m) > rank(cur)) best.set(m.customerId, m);
  }
  // Failed payments can be on any of a customer's current memberships, not
  // just the one we keep (Romel, 08/10/2026: three at once, the oldest one
  // failing). Carry the worst count, and the name of the membership it's on.
  const worst = new Map<string, { retries: number; name: string }>();
  for (const m of inputs) {
    if (m.status === "ended") continue;
    const cur = worst.get(m.customerId);
    if (!cur || (m.paymentRetries ?? 0) > cur.retries) worst.set(m.customerId, { retries: m.paymentRetries ?? 0, name: m.membershipName });
  }
  let added = 0, updated = 0, started = 0, ended = 0;
  for (const m of best.values()) {
    const failing = worst.get(m.customerId);
    if (failing && failing.retries > (m.paymentRetries ?? 0)) m.paymentRetries = failing.retries;
    let c =
      s.contacts.find((x) => x.membership?.customerId === m.customerId) ??
      s.contacts.find((x) => x.teamup?.customerId === m.customerId) ??
      (m.email ? s.contacts.find((x) => x.email && x.email.toLowerCase() === m.email) : undefined) ??
      (m.phone ? s.contacts.find((x) => samePhone(x.phone, m.phone)) : undefined);
    if (!c) {
      c = { id: uid(), name: m.name || m.email || "TeamUp member", phone: m.phone, email: m.email, source: "teamup", stage: "new", tags: [], answers: [], createdAt: m.createdAt ?? nowIso(s) };
      s.contacts.unshift(c);
      log(s, "contact.created", c.id, `${c.name} from TeamUp (${m.membershipName})`);
      added++;
    } else {
      if (!c.email && m.email) c.email = m.email;
      if (!c.phone && m.phone) c.phone = m.phone;
      if (c.source === "teamup") backdate(c, m.createdAt);
      updated++;
    }
    const prev = c.membership;
    c.membership = {
      customerId: m.customerId, id: m.id, name: m.membershipName, category: m.category, status: m.status,
      startedAt: m.startedAt, endsAt: m.endsAt, cancelling: !!m.cancelling, paymentRetries: m.paymentRetries ?? 0, owed: m.owed,
      lastAttendedAt: prev?.lastAttendedAt, syncedAt: nowIso(s),
      noticesSent: prev?.id === m.id ? prev.noticesSent : undefined,
    };
    // Failed payments: the attempt count reached the threshold since the last
    // sync (on a membership we had already recorded below it).
    const retries = m.paymentRetries ?? 0;
    if (m.status !== "ended" && retries >= PAYMENT_FAILED_AT && prev?.id === m.id && prev.paymentRetries !== undefined && prev.paymentRetries < PAYMENT_FAILED_AT && !opts.baseline) {
      log(s, "stage.changed", c.id, `${c.name}: ${retries} failed payment attempts on ${failing?.name ?? m.membershipName} (TeamUp)`);
      fire(s, { type: "payment.failed", contactId: c.id, category: m.category });
    }
    // Notice given since the last sync (on a membership we already knew and
    // had recorded as not cancelling): the win-back moment.
    if (m.status !== "ended" && m.cancelling && prev?.id === m.id && prev.cancelling === false && !opts.baseline) {
      log(s, "stage.changed", c.id, `${c.name} gave notice on ${m.membershipName} (TeamUp)`);
      fire(s, { type: "membership.cancelling", contactId: c.id, category: m.category });
    }
    const soldStage: Stage = isProgramme(m) ? "sold_programme" : "sold_membership";
    if (m.status !== "ended") {
      const isNew = !prev || prev.id !== m.id || prev.status === "ended";
      const recent = !m.startedAt || now - Date.parse(m.startedAt) < 14 * 86400e3;
      if (opts.baseline) {
        if (c.stage !== soldStage) c.stage = soldStage; // no events, no automations: it's history
      } else if (isNew) {
        // A sale TeamUp tells us about moves the stage quietly: the pipeline's
        // "Sold" automations (the GymGrow welcomes) are for sales staff mark
        // here. TeamUp-driven messages hang off membership.started instead,
        // each approved on the Program members screen (Sammy, 07/10/2026).
        log(s, "stage.changed", c.id, `${c.name} started ${m.membershipName} (TeamUp)`);
        if (c.stage !== soldStage) c.stage = soldStage;
        if (recent) {
          fire(s, { type: "membership.started", contactId: c.id, category: m.category });
          started++;
        }
      }
    } else if (prev && prev.status !== "ended" && !opts.baseline) {
      log(s, "stage.changed", c.id, `${c.name}’s ${prev.name} ended (TeamUp)`);
      fire(s, { type: "membership.ended", contactId: c.id, category: prev.category });
      ended++;
    }
  }
  return { added, updated, started, ended };
}

/**
 * Fires membership.ending for anyone whose membership ends within one of the
 * day counts that an enabled automation asks for, once per membership and
 * day count. Run daily by the sync.
 */
export function checkMembershipsEnding(s: State) {
  const now = nowMs(s);
  const wanted = new Set<number>();
  for (const a of s.automations) if (a.enabled && a.trigger.type === "membership.ending") wanted.add(a.trigger.daysBefore);
  let fired = 0;
  for (const c of s.contacts) {
    const m = c.membership;
    if (!m || m.status !== "active" || !m.endsAt) continue;
    const daysLeft = (Date.parse(m.endsAt) - now) / 86400e3;
    for (const d of wanted) {
      const key = `ending:${d}:${m.endsAt.slice(0, 10)}`;
      if (daysLeft > d || daysLeft < 0 || m.noticesSent?.includes(key)) continue;
      m.noticesSent = [...(m.noticesSent ?? []), key];
      fire(s, { type: "membership.ending", contactId: c.id, category: m.category, daysBefore: d });
      fired++;
    }
  }
  return fired;
}

/** Staff editing the one-tap WhatsApp reply lines. Blank lines are dropped. */
export function setQuickReplies(s: State, lines: string[]) {
  s.quickReplies = lines.map((l) => l.trim().slice(0, 500)).filter(Boolean).slice(0, 20);
}

/** Staff changing when people can book a calendar themselves. */
export function setAvailability(s: State, calendarId: string, availability: Availability) {
  const cal = s.calendars.find((x) => x.id === calendarId);
  if (cal) cal.availability = availability;
}

export function updateForm(s: State, form: Form) {
  const i = s.forms.findIndex((f) => f.id === form.id);
  if (i >= 0) s.forms[i] = form;
}
