// The data shape for the whole CRM. The Supabase schema should mirror this,
// so the front end can swap the local mock store for real API calls.
//
// Scope: this CRM gets people from first enquiry to a booked, attended free
// trial. "Joined" is where it ends. Memberships, billing and member classes
// are managed elsewhere.

export type Stage = "new" | "contacted" | "trial_booked" | "trial_done" | "member" | "lost";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New lead" },
  { id: "contacted", label: "Contacted" },
  { id: "trial_booked", label: "Trial booked" },
  { id: "trial_done", label: "Trial done" },
  { id: "member", label: "Joined" },
  { id: "lost", label: "Lost" },
];

export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;

export type Source = "meta_ad" | "walk_in" | "referral" | "website";

export const SOURCES: { id: Source; label: string }[] = [
  { id: "meta_ad", label: "Meta ad" },
  { id: "walk_in", label: "Walk-in" },
  { id: "referral", label: "Referral" },
  { id: "website", label: "Website" },
];

export const sourceLabel = (s: Source) => SOURCES.find((x) => x.id === s)?.label ?? s;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: Source;
  // Ad attribution, from the ad link (utm_campaign / utm_term / utm_content)
  // or, for Meta lead forms, from the lead webhook's ad_id.
  campaign?: string; // campaign utm, e.g. autumn_beginners
  adset?: string; // ad set name
  ad?: string; // ad (creative) name
  adId?: string; // Meta ad id, when known
  stage: Stage;
  tags: string[];
  answers: { question: string; answer: string }[];
  trialAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  contactId: string;
  dir: "in" | "out";
  text: string;
  template?: string; // set when sent as an approved WhatsApp template
  by?: string; // automation name, or "You"
  at: string;
}

export type EventType =
  | "contact.created"
  | "form.submitted"
  | "stage.changed"
  | "tag.added"
  | "whatsapp.sent"
  | "whatsapp.received"
  | "email.sent"
  | "task.created"
  | "automation.stopped"
  | "appointment.booked"
  | "appointment.updated";

export interface CrmEvent {
  id: string;
  type: EventType;
  contactId?: string;
  detail: string;
  at: string;
}

export type Trigger =
  | { type: "form.submitted"; formId: string }
  | { type: "stage.changed"; to: Stage }
  | { type: "tag.added"; tag: string };

export type Step =
  | { kind: "whatsapp"; template: string }
  | { kind: "email"; to: "staff" | "contact"; subject: string }
  | { kind: "wait"; hours: number }
  | { kind: "wait_until_trial"; hoursBefore: number }
  | { kind: "if_stage_in"; stages: Stage[] }
  | { kind: "task"; text: string };

export interface Automation {
  id: string;
  name: string;
  summary: string;
  enabled: boolean;
  trigger: Trigger;
  steps: Step[];
  runs: number;
}

export interface Run {
  id: string;
  automationId: string;
  contactId: string;
  stepIndex: number; // the next step to execute
  status: "running" | "waiting" | "done" | "stopped";
  resumeAt?: string;
  startedAt: string;
}

export type QuestionType = "text" | "phone" | "email" | "choice";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  help?: string;
  options?: string[];
  field?: "name" | "phone" | "email"; // maps the answer onto the contact
}

export interface Form {
  id: string;
  slug: string;
  name: string;
  questions: Question[];
  thanks: string;
  responses: number;
}

export interface Task {
  id: string;
  contactId?: string;
  text: string;
  done: boolean;
  at: string;
}

// Spend, impressions, clicks and leads come from the Meta Marketing API, per
// ad. Trials and joined are counted from the CRM, matched on the ad.
export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  trials: number;
  joined: number;
}

export interface Ad extends AdMetrics {
  id: string;
  name: string;
  adset: string;
  format: "video" | "image" | "carousel";
}

export interface Campaign {
  name: string;
  utm: string;
  ads: Ad[];
}

export const sumMetrics = (items: AdMetrics[]): AdMetrics =>
  items.reduce(
    (t, a) => ({
      spend: t.spend + a.spend,
      impressions: t.impressions + a.impressions,
      clicks: t.clicks + a.clicks,
      leads: t.leads + a.leads,
      trials: t.trials + a.trials,
      joined: t.joined + a.joined,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, trials: 0, joined: 0 },
  );

// ---- Calendar ----

export type ApptStatus = "booked" | "confirmed" | "showed" | "no_show" | "cancelled";

export const APPT_STATUSES: { id: ApptStatus; label: string }[] = [
  { id: "booked", label: "Booked" },
  { id: "confirmed", label: "Confirmed" },
  { id: "showed", label: "Showed" },
  { id: "no_show", label: "No-show" },
  { id: "cancelled", label: "Cancelled" },
];

export const apptStatusLabel = (s: ApptStatus) => APPT_STATUSES.find((x) => x.id === s)?.label ?? s;

export interface CalendarDef {
  id: string;
  name: string;
  durationMin: number;
  style: "trial" | "pt" | "consult"; // maps to a CSS class, see .appt in globals.css
  bookTrial?: boolean; // booking here moves the contact to Trial booked
}

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export interface Appointment {
  id: string;
  contactId: string;
  calendarId: string;
  staffId: string;
  start: string;
  end: string;
  status: ApptStatus;
  notes?: string;
  createdAt: string;
}

/** One day of sample history, for charts covering days before the prototype data starts. */
export interface DayStat {
  day: string; // YYYY-MM-DD, local
  leads: number;
  trials: number;
  spend: number;
}

export interface State {
  version: 3;
  seededAt: string;
  history: DayStat[];
  clockOffset: number; // ms added to real time by the prototype clock
  contacts: Contact[];
  messages: Message[];
  events: CrmEvent[];
  automations: Automation[];
  runs: Run[];
  forms: Form[];
  tasks: Task[];
  templates: Record<string, string>;
  campaigns: Campaign[];
  calendars: CalendarDef[];
  staff: Staff[];
  appointments: Appointment[];
}
