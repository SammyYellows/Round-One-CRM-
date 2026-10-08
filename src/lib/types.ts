// The data shape for the whole CRM. The Supabase schema should mirror this,
// so the front end can swap the local mock store for real API calls.
//
// Scope: this CRM gets people from first enquiry to a booked, attended free
// trial and the sale. It ends at "Sold" (programme or recurring membership).
// Memberships, billing and member classes are managed elsewhere.

export type Stage =
  | "new"
  | "contacted"
  | "booked"
  | "no_show"
  | "attended"
  | "nurture"
  | "sold_programme"
  | "sold_membership"
  | "lost";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New lead" },
  { id: "contacted", label: "Contacted" },
  { id: "booked", label: "Appointment booked" },
  { id: "no_show", label: "No-show" },
  { id: "attended", label: "Appointment attended" },
  { id: "nurture", label: "Nurture" },
  { id: "sold_programme", label: "Sold – Programme" },
  { id: "sold_membership", label: "Sold – Recurring membership" },
  { id: "lost", label: "Lost" },
];

export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;

export const SOLD_STAGES: Stage[] = ["sold_programme", "sold_membership"];
export const isSold = (s: Stage) => SOLD_STAGES.includes(s);

/** Why someone was marked Lost. Staff pick one; it's kept on the contact. */
export const LOST_REASONS = ["Not interested", "No response", "Not qualified", "Joined elsewhere", "Price", "Other"] as const;

export type Source = "meta_ad" | "walk_in" | "referral" | "website" | "whatsapp" | "teamup" | "email";

export const SOURCES: { id: Source; label: string }[] = [
  { id: "meta_ad", label: "Meta ad" },
  { id: "walk_in", label: "Walk-in" },
  { id: "referral", label: "Referral" },
  { id: "website", label: "Website" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "teamup", label: "TeamUp member" },
  { id: "email", label: "Email enquiry" },
];

export const sourceLabel = (s: Source) => SOURCES.find((x) => x.id === s)?.label ?? s;

export interface Contact {
  id: string;
  name: string;
  firstName?: string; // from the form's first-name box; otherwise guessed from name
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
  lostReason?: string; // set when stage is "lost"
  tags: string[];
  answers: { question: string; answer: string }[];
  trialAt?: string;
  createdAt: string;
  // Their current TeamUp membership, kept up to date by the nightly sync.
  membership?: Membership;
  // Asked us to stop marketing messages (replied STOP, or staff set it).
  // Messages about their own booking or membership still go.
  marketingOptOut?: boolean;
  emailBounced?: boolean; // a mailout to them bounced; skipped by later mailouts
  // Their TeamUp customer record, for everyone synced from TeamUp (members
  // and the people who made an account but never bought).
  teamup?: TeamUpCustomer;
  // On the accountability programme (docs/accountability.md): their own
  // commitment, from the /f/accountability form. Staff can end it.
  accountability?: Accountability;
}

export interface Accountability {
  active: boolean;
  joinedAt: string;
  leftAt?: string;
  floor: number; // sessions a week they'll hit even on a bad week (1–3)
  stretch: number; // sessions a week on a good week (2–5)
  goals: string[];
  why: string; // their own words, quoted back
  derailers: string[];
  style: "straight" | "encourage" | "facts";
  frequency: "slipping" | "pulse" | "daily" | "weekly";
  slot: string; // check-in slot, e.g. "Sunday 6pm"
  coachNotes?: string;
  // This week's and last week's sessions, from TeamUp attendances (refreshed
  // nightly and just before their check-in). Weeks run Monday to Sunday, UK.
  attendance?: { weekStart: string; thisWeek: number; lastWeek: number; sessions: string[]; syncedAt: string };
  lastCheckinAt?: string; // when the last weekly check-in was sent
  checkins?: { week: string; at: string; feel: string; blocker?: string; play: string }[]; // their answers, newest first
}

/** A customer's membership as TeamUp reports it. TeamUp stays the source of truth. */
/** Failed attempts before someone counts as a failed payment (Sammy, 07/10/2026). */
export const PAYMENT_FAILED_AT = 3;

export interface TeamUpCustomer {
  customerId: string;
  status?: string; // TeamUp's own label: prospect, at_risk, converted, churned, lost…
  createdAt?: string; // when they first appeared in TeamUp ("came in")
  syncedAt: string;
}

export interface Membership {
  customerId: string; // TeamUp customer id
  id: string; // TeamUp customer_membership id
  name: string; // e.g. Premium Middleweight, 28 Day Program
  category: string; // TeamUp membership category, e.g. Program Memberships
  status: "active" | "on_hold" | "ended";
  startedAt?: string;
  endsAt?: string; // expiry or next renewal, when TeamUp gives one
  cancelling?: boolean; // notice given in TeamUp; the membership runs out at endsAt
  paymentRetries?: number; // failed payment attempts TeamUp has logged on the subscription
  owed?: { count: number; total: number; since?: string }; // open invoices in TeamUp
  lastAttendedAt?: string;
  syncedAt: string;
  // Keys of "ending soon" notices already sent, e.g. "ending:7:2026-10-31".
  noticesSent?: string[];
}

export interface Message {
  id: string;
  contactId: string;
  dir: "in" | "out";
  text: string;
  template?: string; // set when sent as an approved WhatsApp template
  by?: string; // automation name, or "You"
  at: string;
  // WhatsApp delivery, updated from Meta's webhook. Missing on messages from
  // the prototype, where nothing is really sent.
  status?: MessageStatus;
  error?: string; // why it failed, when status is "failed"
}

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";

export type EventType =
  | "contact.created"
  | "form.submitted"
  | "stage.changed"
  | "tag.added"
  | "whatsapp.sent"
  | "whatsapp.received"
  | "whatsapp.failed"
  | "email.sent"
  | "email.failed"
  | "email.received" // an enquiry came in to info@ (docs/email-enquiries.md)
  | "email.replied" // staff sent the reply
  | "task.created"
  | "automation.stopped"
  | "automation.changed" // staff changed an automation's wording or switched it on or off
  | "accountability.joined" // they filled in the commitment form
  | "accountability.left" // staff ended it, or they asked to stop
  | "membership.held" // staff put a membership on hold in TeamUp from the CRM
  | "accountability.checkin" // the weekly check-in went out
  | "accountability.checkin_received" // they answered it
  | "appointment.booked"
  | "appointment.updated";

export interface CrmEvent {
  id: string;
  type: EventType;
  contactId?: string;
  detail: string;
  // Extra facts for the server, e.g. what an email.sent event should send.
  data?: Record<string, string>;
  at: string;
}

export type Trigger =
  | { type: "form.submitted"; formId: string }
  | { type: "stage.changed"; to: Stage }
  | { type: "tag.added"; tag: string }
  // A free-trial appointment marked with this status (e.g. cancelled).
  | { type: "appointment.status"; status: ApptStatus }
  // A booked free trial moved to a new time.
  | { type: "appointment.moved" }
  // TeamUp memberships (see docs/teamup-members.md). `category` limits the
  // trigger to one membership category; leave it out for all.
  | { type: "membership.started"; category?: string; via?: Via }
  | { type: "membership.ending"; daysBefore: number; category?: string; via?: Via }
  | { type: "membership.cancelling"; category?: string; via?: Via } // they've given notice; it still runs until endsAt
  | { type: "payment.failed"; category?: string; via?: Via } // TeamUp has logged 3 failed payment attempts (PAYMENT_FAILED_AT)
  | { type: "membership.ended"; category?: string; via?: Via }
  // Someone joined the accountability programme (docs/accountability.md).
  | { type: "accountability.joined" }
  // Their weekly check-in time has come (this week's attendance is in the placeholders).
  | { type: "accountability.checkin" };

/**
 * How someone reached us (Sammy, 07/10/2026). "crm": through the
 * questionnaire or any CRM route first, then set up in TeamUp when they
 * bought the Program (matched on email). "teamup": signed up straight in
 * TeamUp (website, walk-in, word of mouth). A trigger with `via` only fires
 * for that route.
 */
export type Via = "crm" | "teamup";
export const viaOf = (c: { source: Source }): Via => (c.source === "teamup" ? "teamup" : "crm");
export const viaLabel = (v: Via) => (v === "crm" ? "Came through the CRM" : "Signed up in TeamUp");

export type Step =
  | { kind: "whatsapp"; template: string }
  // Staff emails get a summary of the contact. Emails to the contact are only
  // sent when there's a body to send.
  | { kind: "email"; to: "staff" | "contact"; subject: string; body?: string; marketing?: boolean }
  | { kind: "wait"; hours: number }
  // Waits until this long before the trial. If that time has already gone
  // (e.g. they booked for later today), skipIfLate skips the next step.
  | { kind: "wait_until_trial"; hoursBefore: number; skipIfLate?: boolean }
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
  stopOnReply?: boolean; // a WhatsApp reply from the contact ends their run
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

// "name" asks for first and last name in two boxes on one screen; the
// answer is saved under "<id>.first" and "<id>.last". "multi" is tick boxes
// (up to `max`), with an "Other" box to type in when `other` is set; the
// answer is the ticked options joined with ", ".
export type QuestionType = "text" | "long" | "phone" | "email" | "choice" | "scale" | "name" | "multi";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  help?: string;
  options?: string[];
  // For "scale": 1 to 10, with words for each end.
  low?: string;
  high?: string;
  field?: "name" | "phone" | "email"; // maps the answer onto the contact
  // For "multi": how many can be ticked, and whether there's an "Other" box.
  max?: number;
  other?: boolean;
  optional?: boolean; // may be skipped
}

export interface Form {
  id: string;
  slug: string;
  name: string;
  questions: Question[];
  thanksTitle?: string; // headline on the end screen
  thanks: string;
  // Show a "Book a meeting" button on the end screen, to the booking page.
  bookButton?: string;
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
// ad. Trials and sales are counted from the CRM, matched on the ad.
export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  trials: number;
  sold: number;
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
      sold: t.sold + a.sold,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, trials: 0, sold: 0 },
  );

// ---- Calendar ----

export type ApptStatus = "booked" | "confirmed" | "attended" | "no_show" | "cancelled";

export const APPT_STATUSES: { id: ApptStatus; label: string }[] = [
  { id: "booked", label: "Booked" },
  { id: "confirmed", label: "Confirmed" },
  { id: "attended", label: "Attended" },
  { id: "no_show", label: "No-show" },
  { id: "cancelled", label: "Cancelled" },
];

export const apptStatusLabel = (s: ApptStatus) => APPT_STATUSES.find((x) => x.id === s)?.label ?? s;

export interface CalendarDef {
  id: string;
  name: string;
  durationMin: number;
  style: "trial" | "pt" | "consult"; // maps to a CSS class, see .appt in globals.css
  bookTrial?: boolean; // booking here moves the contact to Appointment booked
  availability?: Availability; // when people can book themselves, on /book
}

/** Self-booking hours for a calendar, in UK time. */
export interface Availability {
  slotMin: number; // length of each bookable slot
  capacity: number; // people per slot
  minNoticeHours: number; // earliest booking, from now
  daysAhead: number; // latest day people can book, counted from today (7 = same day next week)
  hours: Record<number, [from: string, to: string][]>; // 0 = Sunday; "08:00", "19:30"
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
  version: 7;
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
  // One-tap lines staff can drop into a WhatsApp reply. Edited on the contact page.
  quickReplies: string[];
}
