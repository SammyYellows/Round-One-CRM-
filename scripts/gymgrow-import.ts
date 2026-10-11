// One-off: import GymGrow's Opportunities export quietly (Sammy, 11/10/2026).
// No automations fire except the email-reminder one for the 7 meetings this week.
// Usage: tsx gymgrow-import.ts <list.csv> <cal.csv> [--write]
import fs from "node:fs";
import { loadState, saveChanges } from "@/lib/server/state";
import { uid, addTag } from "@/lib/engine";
import type { Contact, Stage, Automation } from "@/lib/types";

const [listPath, calPath] = process.argv.slice(2);
const WRITE = process.argv.includes("--write");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift()!.map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
const digits = (p: string) => { let d = (p || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "44" + d.slice(1); return d.slice(-10); };
const RANK: Record<string, number> = { new: 0, contacted: 1, booked: 2, no_show: 3, attended: 3, nurture: 4, sold_programme: 5, sold_membership: 6, lost: -1 };
const NOW = Date.parse("2026-10-11T20:00:00Z");

// UK local "2026-10-12" + "10:00 AM" (BST in October) to ISO.
function ukIso(date: string, time: string) {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)!; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12;
  return new Date(`${date}T${String(h).padStart(2, "0")}:${m[2]}:00+01:00`).toISOString();
}

async function main() {
  const list = parseCsv(fs.readFileSync(listPath, "utf8"));
  const cal = parseCsv(fs.readFileSync(calPath, "utf8"));
  const meetings = new Map<string, string>();
  for (const c of cal) { const k = c["Title"].toLowerCase(); if (!meetings.has(k)) meetings.set(k, ukIso(c["Start Date"], c["Start Time"])); }

  const before = await loadState();
  const s = structuredClone(before);
  const at = new Date().toISOString();
  const byEmail = new Map(s.contacts.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const byPhone = new Map(s.contacts.filter((c) => digits(c.phone).length === 10).map((c) => [digits(c.phone), c]));
  const owner = s.staff.find((x) => /owner/i.test(x.role))?.id ?? s.staff[0].id;
  const tally: Record<string, number> = {};
  const add = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
  const withMeeting: string[] = [];

  for (const r of list) {
    const name = r["Contact Name"];
    if (/^test ?\d|^test2/i.test(name)) { add("skipped test"); continue; }
    const ageDays = (NOW - Date.parse(r["Created on"])) / 86400e3;
    const meetingAt = meetings.get(name.toLowerCase());
    const st = r["stage"];
    let target: Stage; let task: string | undefined;
    if (st === "Lead") target = ageDays <= 30 ? "contacted" : "nurture";
    else if (st === "Missed") target = "no_show";
    else if (st === "Booked" || st === "Confirmed") {
      if (meetingAt) target = "booked";
      else if (ageDays <= 30) { target = "contacted"; task = `${name} was booked in GymGrow (before the switch). Check what happened: did they come in, and do they need rebooking?`; }
      else target = "nurture";
    } else if (st === "Attended") target = ageDays <= 30 ? "attended" : "nurture";
    else if (st === "Intro Programme") target = "sold_programme";
    else if (st === "Recurring") target = "sold_membership";
    else { add("unknown stage " + st); continue; }

    const gymgrow = { contactId: r["Contact ID"], opportunityId: r["Opportunity ID"], stage: st, importedAt: at };
    const existing = byEmail.get(r["email"].toLowerCase()) ?? byPhone.get(digits(r["phone"]));
    if (existing) {
      if (!existing.tags.includes("gymgrow-import")) existing.tags.push("gymgrow-import");
      existing.gymgrow = gymgrow;
      if (!existing.email && r["email"]) existing.email = r["email"];
      if (!existing.phone && r["phone"]) existing.phone = r["phone"];
      if (existing.stage === "new" && RANK[target] > 0 && target !== "booked") {
        s.events.unshift({ id: uid(), type: "stage.changed", contactId: existing.id, detail: `${existing.name} moved to ${target} from the GymGrow import (GymGrow stage: ${st})`, at });
        existing.stage = target; add("existing moved forward");
      } else add("existing tag only");
      continue;
    }
    const c: Contact = {
      id: uid(), name, phone: r["phone"], email: r["email"],
      source: r["source"] === "Meta Ads" ? "meta_ad" : "website",
      stage: target, tags: ["gymgrow-import"], answers: [], createdAt: new Date(r["Created on"]).toISOString(), gymgrow,
    };
    s.contacts.push(c);
    s.events.unshift({ id: uid(), type: "contact.created", contactId: c.id, detail: `${name} imported from GymGrow (GymGrow stage: ${st})`, at });
    add("new " + target);
    if (task) { s.tasks.unshift({ id: uid(), contactId: c.id, text: task, done: false, at }); add("task"); }
    if (meetingAt && target === "booked") {
      const start = meetingAt;
      s.appointments.push({ id: uid(), contactId: c.id, calendarId: "trial", staffId: owner, start, end: new Date(Date.parse(start) + 30 * 60e3).toISOString(), status: "booked", notes: "Booked in GymGrow before the switch", createdAt: at });
      c.trialAt = start;
      s.events.unshift({ id: uid(), type: "appointment.booked", contactId: c.id, detail: `Free trial for ${name}, ${start} (booked in GymGrow, imported)`, at });
      withMeeting.push(c.id); add("meeting added");
    }
  }

  // Email reminders for the imported meetings only (Sammy chose email; WhatsApp waits on billing).
  const reminders: Automation = {
    id: "gymgrow_meeting_reminders", name: "Imported meetings – email reminders",
    summary: "Day-before and two-hours-before reminder emails for meetings booked in GymGrow before the switch.",
    enabled: true, runs: 0,
    trigger: { type: "tag.added", tag: "gymgrow-meeting" },
    steps: [
      { kind: "wait_until_trial", hoursBefore: 24, skipIfLate: true },
      { kind: "email", to: "contact", subject: "See you tomorrow, {first}", body: "Hi {first},\n\nJust a quick reminder of your in-person meeting with us tomorrow, {date} at {time}, at {address}.\n\nPlease reply to this email to confirm you can still make it. If you need a different time, reply and we'll sort it.\n\nThe Round One team" },
      { kind: "wait_until_trial", hoursBefore: 2, skipIfLate: true },
      { kind: "email", to: "contact", subject: "See you in a couple of hours, {first}", body: "Hi {first},\n\nLooking forward to meeting you in a couple of hours, at {time} today, at {address}.\n\nIf anything's changed, just reply to this email.\n\nThe Round One team" },
    ],
  } as Automation;
  if (!s.automations.some((a) => a.id === reminders.id)) s.automations.push(reminders);
  for (const id of withMeeting) addTag(s, id, "gymgrow-meeting");

  const newEmails = s.events.filter((e) => e.type === "email.sent" && !before.events.some((b) => b.id === e.id)).length;
  console.log(JSON.stringify({ tally, runs: s.runs.filter((r) => r.automationId === reminders.id).map((r) => ({ c: s.contacts.find((c) => c.id === r.contactId)?.name, status: r.status, step: r.stepIndex, resumeAt: r.resumeAt })), newEmailsNow: newEmails, contactsBefore: before.contacts.length, contactsAfter: s.contacts.length }, null, 1));
  if (newEmails) throw new Error("Refusing: an email would send now");
  if (WRITE) { await saveChanges(before, s); console.log("WRITTEN"); } else console.log("DRY RUN (add --write to save)");
}
main().catch((e) => { console.error(e); process.exit(1); });
