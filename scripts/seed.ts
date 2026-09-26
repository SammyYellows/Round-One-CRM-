// Fills the database with demo leads so the CRM can be explored. Run: npm run seed
import { QUESTIONS } from "../lib/config";
import { db } from "../lib/db";
import { insertLead, logActivity } from "../lib/leads";
import { bookAppointment, setAppointmentStatus, setStage, submitQuestionnaire } from "../lib/pipeline";
import { addDaysKey, dateKey, localToUtc, parseKey } from "../lib/time";

const d = db();
if ((d.prepare("SELECT COUNT(*) n FROM leads").get() as { n: number }).n > 0 && !process.argv.includes("--force")) {
  console.log("Database already has leads – pass --force to add demo data anyway.");
  process.exit(0);
}

const FIRST = ["Sam", "Olly", "Kai", "Petra", "Lyham", "David", "Sara", "Kane", "Jess", "Martina", "Tom", "Luke", "Morgan", "Alan", "Brett", "Ian", "Harry", "Douglas", "Rahul", "Victoria", "Jake", "Hussen", "Jon", "Alessio", "Andrew"];
const LAST = ["Nelson", "Baxter", "Caps", "Regitkova", "Douglas", "Thomas", "Bradley", "Spill", "Wrigley", "Murch", "Ward", "Shepherd", "Parsons", "McCabe", "Sherwood", "Rawlings", "Pyrgos", "Carr", "Prasad", "Hale", "Southwick", "Hassan", "Burke", "Kurti", "Croft"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function slot(dayOffset: number, hour: number, min = 0) {
  const { y, m, d } = parseKey(addDaysKey(dateKey(new Date()), dayOffset));
  return localToUtc(y, m, d, hour, min).toISOString();
}

// Silence automations for historic demo data: create, then clear the queue at the end.
FIRST.forEach((first, i) => {
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, q.options.filter((o) => !o.disqualify)[0].value]));
  answers.goal = pick(QUESTIONS[0].options).value;
  const { lead } = submitQuestionnaire({
    first_name: first,
    last_name: LAST[i],
    email: `${first.toLowerCase()}.${LAST[i].toLowerCase()}@example.com`,
    phone: `+4477009${String(10000 + i).padStart(5, "0")}`,
    answers,
    source: pick(["Instagram", "Instagram", "Meta Ads"]),
    whatsapp_opt_in: true,
  });
  const path = i % 8;
  if (path === 0) return; // stays a lead
  const past = path >= 3;
  const res = bookAppointment(lead.id, past ? slot(-(i % 6) - 1, 11 + (i % 8)) : slot((i % 6) + 1, 11 + (i % 8), i % 2 ? 30 : 0), {
    skipAvailabilityCheck: true,
    by: "lead via booking page",
  });
  if (!res.ok) return;
  if (path === 2) setAppointmentStatus(res.appointment.id, "confirmed");
  if (path === 3) setAppointmentStatus(res.appointment.id, "no_show");
  if (path === 4) setAppointmentStatus(res.appointment.id, "cancelled");
  if (path >= 5) setAppointmentStatus(res.appointment.id, "attended");
  if (path >= 6) {
    setStage(lead.id, "intro");
    d.prepare("UPDATE leads SET value_pence = 7900 WHERE id = ?").run(lead.id);
  }
  if (path === 7) setStage(lead.id, i % 2 ? "recurring" : "won");
});

const unq = insertLead({
  first_name: "Chris",
  last_name: "Out-of-town",
  email: "chris@example.com",
  phone: "+447700999999",
  source: "Instagram",
  stage: "unqualified",
  qualified: false,
  disqualify_reason: "Are you based in or near Bristol? → No – I'm not local",
});
logActivity(unq.id, "form", "Submitted questionnaire – not qualified");

// Demo data: mark historic automation messages as already handled.
d.prepare("UPDATE scheduled_messages SET status = 'skipped', error = 'demo seed' WHERE status = 'pending' AND send_at <= ?").run(
  new Date().toISOString(),
);
console.log(`Seeded ${(d.prepare("SELECT COUNT(*) n FROM leads").get() as { n: number }).n} leads.`);
