// Every change to the CRM goes through these functions. Each one mutates a
// draft copy of State (the store clones it first), writes an event, and lets
// matching automations react. When the backend exists, these become API
// routes and the automation part moves to a job runner (Inngest / Trigger.dev).

import {
  Appointment, Automation, Contact, CrmEvent, EventType, Form, Run, Source, Stage, State, Step, apptStatusLabel, stageLabel,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const nowMs = (s: State) => Date.now() + s.clockOffset;
export const nowIso = (s: State) => new Date(nowMs(s)).toISOString();
export const firstName = (c: Contact) => c.name.split(" ")[0];

function log(s: State, type: EventType, contactId: string | undefined, detail: string) {
  const ev: CrmEvent = { id: uid(), type, contactId, detail, at: nowIso(s) };
  s.events.unshift(ev);
}

function fill(text: string, c: Contact) {
  const trial = c.trialAt ? new Date(c.trialAt) : null;
  return text
    .replaceAll("{first}", firstName(c))
    .replaceAll("{name}", c.name)
    .replaceAll("{trial}", trial ? trial.toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" }) : "your booked session")
    .replaceAll("{trialTime}", trial ? trial.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "the booked time");
}

// ---- Automations ----------------------------------------------------------

type Fired =
  | { type: "form.submitted"; contactId: string; formId: string }
  | { type: "stage.changed"; contactId: string; stage: Stage }
  | { type: "tag.added"; contactId: string; tag: string };

function matches(a: Automation, ev: Fired) {
  const t = a.trigger;
  if (t.type !== ev.type) return false;
  if (t.type === "form.submitted" && ev.type === "form.submitted") return t.formId === ev.formId;
  if (t.type === "stage.changed" && ev.type === "stage.changed") return t.to === ev.stage;
  if (t.type === "tag.added" && ev.type === "tag.added") return t.tag === ev.tag;
  return false;
}

function fire(s: State, ev: Fired) {
  for (const a of s.automations) {
    if (!a.enabled || !matches(a, ev)) continue;
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
      case "email":
        log(s, "email.sent", c.id, step.to === "staff" ? `${fill(step.subject, c)} to the front desk` : `${fill(step.subject, c)} to ${c.name}`);
        break;
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

export function toggleAutomation(s: State, id: string) {
  const a = s.automations.find((x) => x.id === id);
  if (a) a.enabled = !a.enabled;
}

export function describeStep(step: Step, templates: Record<string, string>) {
  switch (step.kind) {
    case "whatsapp": return { kind: "Do", title: "Send WhatsApp template", detail: step.template, preview: templates[step.template] };
    case "email": return { kind: "Do", title: step.to === "staff" ? "Email the front desk" : "Email the contact", detail: step.subject };
    case "wait": return { kind: "Wait", title: step.hours % 24 === 0 ? `Wait ${step.hours / 24} day${step.hours === 24 ? "" : "s"}` : `Wait ${step.hours} hours`, detail: "" };
    case "wait_until_trial": return { kind: "Wait", title: `Wait until ${step.hoursBefore} hours before the trial`, detail: "" };
    case "if_stage_in": return { kind: "If", title: `Still in ${step.stages.map(stageLabel).join(" or ")}`, detail: "Otherwise stop here" };
    case "task": return { kind: "Do", title: "Create a task for staff", detail: step.text };
  }
}

export function describeTrigger(a: Automation, forms: Form[]) {
  const t = a.trigger;
  if (t.type === "form.submitted") return `Form submitted: ${forms.find((f) => f.id === t.formId)?.name ?? t.formId}`;
  if (t.type === "stage.changed") return `Stage changes to ${stageLabel(t.to)}`;
  return `Tagged “${t.tag}”`;
}

// ---- Contacts and messages ------------------------------------------------

export function sendTemplate(s: State, c: Contact, template: string, by: string) {
  const text = fill(s.templates[template] ?? template, c);
  s.messages.push({ id: uid(), contactId: c.id, dir: "out", text, template, by, at: nowIso(s) });
  log(s, "whatsapp.sent", c.id, `${template} to ${c.name}`);
}

export function sendMessage(s: State, contactId: string, text: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || !text.trim()) return;
  s.messages.push({ id: uid(), contactId, dir: "out", text: text.trim(), by: "You", at: nowIso(s) });
  log(s, "whatsapp.sent", contactId, `Reply to ${c.name}`);
}

export function receiveMessage(s: State, contactId: string, text: string) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c) return;
  s.messages.push({ id: uid(), contactId, dir: "in", text, at: nowIso(s) });
  log(s, "whatsapp.received", contactId, `From ${c.name}`);
  if (c.stage === "new") setStage(s, contactId, "contacted");
}

export function setStage(s: State, contactId: string, stage: Stage) {
  const c = s.contacts.find((x) => x.id === contactId);
  if (!c || c.stage === stage) return;
  const from = c.stage;
  c.stage = stage;
  // Moving someone to Trial booked (e.g. dragging on the pipeline) puts a
  // trial in the calendar too, tomorrow at 18:00, so the two never disagree.
  if (stage === "trial_booked" && !activeTrial(s, contactId)) {
    const d = new Date(nowMs(s) + 86400e3);
    d.setHours(18, 0, 0, 0);
    const cal = s.calendars.find((x) => x.bookTrial);
    if (cal && s.staff[0]) createAppointment(s, { contactId, calendarId: cal.id, staffId: s.staff[0].id, start: d.toISOString() });
  }
  log(s, "stage.changed", contactId, `${c.name}: ${stageLabel(from)} to ${stageLabel(stage)}`);
  fire(s, { type: "stage.changed", contactId, stage });
}

// ---- Calendar ------------------------------------------------------------

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
  const coach = s.staff.find((x) => x.id === input.staffId)?.name ?? "";
  log(s, "appointment.booked", c.id, `${cal.name} for ${c.name}, ${when(appt.start)} with ${coach}`);
  if (cal.bookTrial) {
    c.trialAt = appt.start;
    if (c.stage === "trial_booked") retimeTrialWaits(s, c.id);
    else setStage(s, c.id, "trial_booked");
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

  if (status === "showed" && c.stage === "trial_booked") setStage(s, c.id, "trial_done");
  if (status === "no_show") {
    c.trialAt = undefined;
    retimeTrialWaits(s, c.id);
    if (c.stage === "trial_booked") setStage(s, c.id, "trial_done");
    addTag(s, c.id, "no-show");
  }
  if (status === "cancelled") {
    const other = activeTrial(s, c.id);
    c.trialAt = other?.start;
    retimeTrialWaits(s, c.id);
    if (!other && c.stage === "trial_booked") setStage(s, c.id, "contacted");
  }
  if (status === "booked" || status === "confirmed") {
    c.trialAt = a.start;
    if (c.stage !== "trial_booked") setStage(s, c.id, "trial_booked");
    else retimeTrialWaits(s, c.id);
  }
}

/** Book or move this contact's free trial. */
export function bookTrial(s: State, contactId: string, at: string) {
  const existing = activeTrial(s, contactId);
  if (existing) return rescheduleAppointment(s, existing.id, { start: new Date(at).toISOString() });
  const cal = s.calendars.find((x) => x.bookTrial);
  if (cal && s.staff[0]) createAppointment(s, { contactId, calendarId: cal.id, staffId: s.staff[0].id, start: new Date(at).toISOString() });
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
  setStage(s, contactId, "trial_done");
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

export function submitForm(s: State, formId: string, answers: Record<string, string>, utm: Attribution) {
  const form = s.forms.find((f) => f.id === formId);
  if (!form) return;
  const byField = (field: string) => {
    const q = form.questions.find((x) => x.field === field);
    return q ? (answers[q.id] ?? "").trim() : "";
  };
  const name = byField("name") || "Unknown";
  const phone = byField("phone");
  const email = byField("email");
  const fromMeta = !!utm.fbclid || /facebook|instagram|meta/i.test(utm.source ?? "");
  const source: Source = fromMeta ? "meta_ad" : "website";
  const qa = form.questions.filter((q) => !q.field).map((q) => ({ question: q.text, answer: answers[q.id] ?? "" }));

  // Match an existing contact on phone number before creating a new one.
  let c = phone ? s.contacts.find((x) => x.phone.replace(/\s/g, "") === phone.replace(/\s/g, "")) : undefined;
  if (c) {
    c.answers = qa;
  } else {
    // Match the ad by id first, then by name within the campaign.
    const ad = s.campaigns
      .flatMap((k) => k.ads.map((a) => ({ ...a, utm: k.utm })))
      .find((a) => (utm.adId && a.id === utm.adId) || (a.name === utm.ad && (!utm.campaign || a.utm === utm.campaign)));
    c = {
      id: uid(), name, phone, email, source,
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
}

export function completeTask(s: State, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (t) t.done = true;
}

export function updateForm(s: State, form: Form) {
  const i = s.forms.findIndex((f) => f.id === form.id);
  if (i >= 0) s.forms[i] = form;
}
