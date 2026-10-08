// Management reports: the weekly numbers and the monthly growth report, as
// a PDF in Supabase Storage, sent to the managers' WhatsApp numbers with
// the `management_report` template (a document header carries the PDF), or
// emailed to staff for a look. Nothing goes out on the schedule until the
// weekly or monthly switch is on in Reports → Settings and there are
// numbers to send to. Server-only.

import { db } from "@/lib/server/supabase";
import { sendTemplate } from "@/lib/server/whatsapp";
import { sendEmail } from "@/lib/server/email";
import { summariseCancellations } from "@/lib/server/ai";
import { Pdf } from "@/lib/server/pdf";
import { ukTime } from "@/lib/time";
import { GYM } from "@/lib/gym";
import { day, growthSettings, loadMemberships, monthly, monthlyForecast, saveGrowthSettings, weekly, type GrowthSettings, type MonthPoint, type MonthlyForecast, type Weekly } from "@/lib/server/growth";

export type ReportKind = "weekly" | "monthly";

export interface CancellationNote { name: string; noticeAt: string; membership: string; reply?: string }

export interface ReportData {
  kind: ReportKind;
  asOf: string;
  settings: GrowthSettings;
  weekly: Weekly;
  months: MonthPoint[]; // the longest monthly lookback, for the chart
  forecasts: MonthlyForecast[];
  cancellations: CancellationNote[];
  cancellationSummary: string; // Claude's summary of the replies, or a plain list
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Notices given in the last `days`, with any email reply those people sent to info@ since. */
async function cancellationNotes(days: number): Promise<CancellationNote[]> {
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data: events } = await db().from("events").select("contact_id, detail, at").eq("type", "stage.changed").like("detail", "% gave notice on %").gte("at", since).order("at", { ascending: false });
  const notes: CancellationNote[] = [];
  if (!events?.length) return notes;
  const ids = [...new Set(events.map((e) => e.contact_id as string).filter(Boolean))];
  const { data: contacts } = await db().from("contacts").select("id, name, email").in("id", ids);
  const byId = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const emails = (contacts ?? []).map((c) => String(c.email ?? "").toLowerCase()).filter(Boolean);
  const { data: replies } = emails.length
    ? await db().from("enquiries").select("from_email, text, received_at").in("from_email", emails).gte("received_at", since).order("received_at", { ascending: false })
    : { data: [] as { from_email: string; text: string; received_at: string }[] };
  const replyBy = new Map<string, string>();
  for (const r of replies ?? []) { const k = String(r.from_email).toLowerCase(); if (!replyBy.has(k)) replyBy.set(k, String(r.text ?? "").trim().slice(0, 1500)); }
  const seen = new Set<string>();
  for (const e of events) {
    const c = byId.get(e.contact_id as string);
    if (!c || seen.has(c.id as string)) continue;
    seen.add(c.id as string);
    const m = /gave notice on (.*) \(TeamUp\)/.exec(String(e.detail))?.[1] ?? "";
    notes.push({ name: String(c.name), noticeAt: String(e.at), membership: m, reply: replyBy.get(String(c.email ?? "").toLowerCase()) });
  }
  return notes;
}

export async function buildReport(kind: ReportKind): Promise<ReportData> {
  const [rows, settings] = await Promise.all([loadMemberships(), growthSettings()]);
  const today = day(Date.now());
  const w = weekly(rows, today, settings);
  const longest = Math.max(...settings.monthlyMonths, 1);
  const months = monthly(rows, today, longest);
  const forecasts = monthlyForecast(rows, today, settings);
  const cancellations = await cancellationNotes(kind === "weekly" ? Math.max(7, settings.pastDays) : 31).catch(() => []);
  let cancellationSummary = "";
  const withReplies = cancellations.filter((c) => c.reply);
  if (withReplies.length) {
    cancellationSummary = await summariseCancellations(withReplies.map((c) => ({ name: c.name, membership: c.membership, reply: c.reply! }))).catch(() => "");
  }
  if (!cancellationSummary) {
    cancellationSummary = cancellations.length
      ? `${cancellations.length} gave notice. ${withReplies.length ? `${withReplies.length} replied to the win-back email.` : "No replies to the win-back email yet."}`
      : "Nobody gave notice in this period.";
  }
  return { kind, asOf: today, settings, weekly: w, months, forecasts, cancellations, cancellationSummary };
}

// ---- The PDF ----------------------------------------------------------------

const RED: [number, number, number] = [0.93, 0.13, 0.14];
const INK: [number, number, number] = [0.08, 0.08, 0.08];
const MUTED: [number, number, number] = [0.45, 0.45, 0.45];

function lineChart(pdf: Pdf, x: number, y: number, w: number, h: number, pts: MonthPoint[]) {
  const vals = pts.map((p) => p.membersAtEnd);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(5, Math.round((hi - lo) * 0.2));
  const min = Math.max(0, lo - pad), max = hi + pad;
  const px = (i: number) => x + 40 + (i / Math.max(1, pts.length - 1)) * (w - 50);
  const py = (v: number) => y + 10 + (1 - (v - min) / Math.max(1, max - min)) * (h - 40);
  for (let g = 0; g <= 4; g++) {
    const v = min + ((max - min) * g) / 4;
    pdf.line(x + 40, py(v), x + w - 10, py(v), 0.5, [0.88, 0.88, 0.88]);
    pdf.text(x + 34, py(v) - 4, String(Math.round(v)), 8, { color: MUTED, align: "right" });
  }
  pdf.polyline(pts.map((p, i) => [px(i), py(p.membersAtEnd)] as [number, number]), 2.2, RED);
  pts.forEach((p, i) => {
    pdf.rect(px(i) - 2.5, py(p.membersAtEnd) - 2.5, 5, 5, RED);
    pdf.text(px(i), y + h - 18, p.label, 8, { color: MUTED, align: "center" });
    pdf.text(px(i), py(p.membersAtEnd) - 12, String(p.membersAtEnd), 8, { color: INK, align: "center", bold: true });
  });
}

export function renderPdf(r: ReportData): Uint8Array {
  const pdf = new Pdf();
  const L = 48, R = pdf.pageWidth - 48, CW = R - L;
  pdf.rect(0, 0, pdf.pageWidth, 6, RED);
  pdf.text(L, pdf.y, GYM.name.toUpperCase(), 10, { bold: true, color: MUTED });
  pdf.y += 18;
  pdf.text(L, pdf.y, r.kind === "weekly" ? "Weekly members report" : "Monthly growth report", 24, { bold: true, color: INK });
  pdf.y += 30;
  pdf.text(L, pdf.y, `As of ${fmtDate(r.asOf)}. Members are people with a membership running in TeamUp; someone with two memberships counts once.`, 9, { color: MUTED });
  pdf.y += 28;

  // Tiles
  const w = r.weekly;
  const tiles: [string, string, string][] = r.kind === "weekly"
    ? [["Members now", String(w.members), ""], [`Growth, last ${w.pastDays} days`, signed(w.net), `${w.joined} joined, ${w.left} left`], ["Dropping off in 30 days", String(w.droppingOff.length), "notice given or membership ending"], [`Forecast, next ${w.forecastDays} days`, signed(w.forecastNet), `about ${w.forecastMembers} members, from the last ${w.averageDays} days`]]
    : [["Members now", String(w.members), ""], ...r.months.slice(-2, -1).map((m): [string, string, string] => [`${m.label}: growth`, signed(m.net), `${m.joined} joined, ${m.left} left`]), ...r.forecasts.slice(0, 2).map((f): [string, string, string] => [`Forecast, ${f.months} months`, signed(f.net), `about ${f.members} members`])];
  const tw = (CW - 12 * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, big, note], i) => {
    const x = L + i * (tw + 12);
    pdf.rect(x, pdf.y, tw, 78, [0.96, 0.96, 0.96]);
    pdf.text(x + 10, pdf.y + 10, label.toUpperCase(), 7.5, { bold: true, color: MUTED });
    pdf.text(x + 10, pdf.y + 26, big, 26, { bold: true, color: INK });
    if (note) pdf.para(x + 10, pdf.y + 58, note, 7.5, tw - 20, { color: MUTED, lead: 9 });
  });
  pdf.y += 96;

  // Chart
  const span = r.kind === "weekly" ? Math.min(3, r.months.length - 1) : r.months.length - 1;
  const pts = r.months.slice(-(span + 1));
  pdf.text(L, pdf.y, r.kind === "weekly" ? "Members at month end, last 3 months" : `Members at month end, last ${span} months`, 12, { bold: true, color: INK });
  pdf.y += 18;
  lineChart(pdf, L, pdf.y, CW, 170, pts);
  pdf.y += 180;

  // Month table
  pdf.text(L, pdf.y, "By calendar month", 12, { bold: true, color: INK }); pdf.y += 18;
  const cols = [L, L + 150, L + 230, L + 310, L + 400];
  ["Month", "Joined", "Left", "Growth", "Members at end"].forEach((h, i) => pdf.text(cols[i], pdf.y, h.toUpperCase(), 7.5, { bold: true, color: MUTED }));
  pdf.y += 14;
  for (const m of r.months.slice(-(r.kind === "weekly" ? 4 : r.months.length))) {
    pdf.line(L, pdf.y - 3, R, pdf.y - 3, 0.5, [0.9, 0.9, 0.9]);
    [m.label, String(m.joined), String(m.left), signed(m.net), String(m.membersAtEnd)].forEach((v, i) => pdf.text(cols[i], pdf.y, v, 10, { color: INK, bold: i === 3 }));
    pdf.y += 16;
  }
  if (r.kind === "monthly") {
    pdf.y += 8;
    for (const n of r.settings.monthlyMonths) {
      const slice = r.months.slice(-(n + 1), -1);
      const net = slice.reduce((a, m) => a + m.net, 0);
      pdf.text(L, pdf.y, `Last ${n} whole months: ${signed(net)} (${slice.reduce((a, m) => a + m.joined, 0)} joined, ${slice.reduce((a, m) => a + m.left, 0)} left)`, 10, { color: INK });
      pdf.y += 15;
    }
    pdf.y += 4;
    for (const f of r.forecasts) {
      pdf.text(L, pdf.y, `Forecast over ${f.months} months: ${signed(f.net)}, about ${f.members} members (average ${signed(Math.round(f.perMonth * 10) / 10)} a month over the last ${r.settings.averageDays} days)`, 10, { color: INK });
      pdf.y += 15;
    }
  }

  // Page 2: dropping off and cancellations
  pdf.newPage();
  pdf.rect(0, 0, pdf.pageWidth, 6, RED);
  pdf.text(L, pdf.y, "Dropping off in the next 30 days", 14, { bold: true, color: INK }); pdf.y += 20;
  if (!w.droppingOff.length) { pdf.text(L, pdf.y, "Nobody.", 10, { color: MUTED }); pdf.y += 16; }
  for (const d of w.droppingOff.slice(0, 40)) {
    pdf.text(L, pdf.y, d.name.slice(0, 34), 10, { color: INK });
    pdf.text(L + 190, pdf.y, d.membership.length > 36 ? `${d.membership.slice(0, 35)}…` : d.membership, 9, { color: MUTED });
    pdf.text(R, pdf.y, d.ends ? `ends ${fmtDate(d.ends)}` : "", 10, { color: MUTED, align: "right" });
    pdf.y += 15;
    if (pdf.y > 760) { pdf.newPage(); pdf.rect(0, 0, pdf.pageWidth, 6, RED); }
  }
  if (w.droppingOff.length > 40) { pdf.text(L, pdf.y, `and ${w.droppingOff.length - 40} more`, 10, { color: MUTED }); pdf.y += 15; }
  pdf.y += 14;
  pdf.text(L, pdf.y, "Cancellations and what people said", 14, { bold: true, color: INK }); pdf.y += 20;
  pdf.y = pdf.para(L, pdf.y, r.cancellationSummary, 10, CW, { color: INK });
  pdf.y += 8;
  for (const c of r.cancellations.slice(0, 30)) {
    if (pdf.y > 740) { pdf.newPage(); pdf.rect(0, 0, pdf.pageWidth, 6, RED); }
    pdf.text(L, pdf.y, `${c.name} · ${c.membership} · notice ${fmtDate(c.noticeAt)}`, 10, { bold: true, color: INK }); pdf.y += 14;
    pdf.y = pdf.para(L, pdf.y, c.reply ? `"${c.reply.replace(/\s+/g, " ").slice(0, 400)}"` : "No reply to the win-back email.", 9, CW, { color: c.reply ? INK : MUTED }); pdf.y += 6;
  }
  return pdf.bytes();
}

// ---- Storing and sending ----------------------------------------------------

export async function storeReport(kind: ReportKind, bytes: Uint8Array): Promise<{ path: string; url: string }> {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const path = `${kind}/${stamp}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error } = await db().storage.from("reports").upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Storing the report: ${error.message}`);
  const { data } = db().storage.from("reports").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export const reportName = (kind: ReportKind) => (kind === "weekly" ? "Weekly members report" : "Monthly growth report");
const fileName = (kind: ReportKind, asOf: string) => `round-one-${kind}-report-${asOf}.pdf`;

function headline(r: ReportData) {
  const w = r.weekly;
  return r.kind === "weekly"
    ? `${w.members} members, ${signed(w.net)} in the last ${w.pastDays} days, ${w.droppingOff.length} dropping off within 30 days, forecast ${signed(w.forecastNet)} over the next ${w.forecastDays} days.`
    : `${w.members} members. ${r.months.slice(-2, -1).map((m) => `${m.label}: ${signed(m.net)}.`).join(" ")} ${r.forecasts.map((f) => `${f.months} months: ${signed(f.net)}`).join(", ")}.`;
}

/** Builds, stores and sends to the managers on WhatsApp. Records the outcome in settings. */
export async function sendReport(kind: ReportKind, to: string[], by: string) {
  const r = await buildReport(kind);
  const stored = await storeReport(kind, renderPdf(r));
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const num of to) {
    const res = await sendTemplate(num.replace(/\D/g, ""), {
      name: "management_report", language: "en_GB",
      params: [reportName(kind), fmtDate(r.asOf), headline(r)],
      documentUrl: stored.url, documentName: fileName(kind, r.asOf),
    });
    results.push({ to: num, ok: res.ok, error: res.ok ? undefined : res.error });
  }
  await db().from("events").insert({ id: Math.random().toString(36).slice(2, 14), type: "automation.changed", contact_id: null, detail: `${reportName(kind)} sent by ${by} to ${to.length} number${to.length === 1 ? "" : "s"}${results.some((x) => !x.ok) ? " (some failed)" : ""}`, at: new Date().toISOString(), data: { report: kind, url: stored.url } });
  return { url: stored.url, results };
}

/** Emails the PDF to one address (for checking it before anyone switches the schedule on). */
export async function emailReport(kind: ReportKind, to: string) {
  const r = await buildReport(kind);
  const bytes = renderPdf(r);
  const res = await sendEmail(to, `${reportName(kind)}, ${fmtDate(r.asOf)}`, `${headline(r)}\n\nThe report is attached.\n\n${GYM.signOff}`, { attachments: [{ filename: fileName(kind, r.asOf), content: bytes }] });
  return res;
}

/** Called from /api/cron every 5 minutes: sends what's due (Monday 08:00 UK weekly, 1st 08:00 UK monthly). */
export async function runDueReports(now = Date.now()) {
  const s = await growthSettings();
  if (!s.managerNumbers.length) return { sent: [] as ReportKind[] };
  const sent: ReportKind[] = [];
  const uk = new Date(now + 0);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(uk).map((p) => [p.type, p.value]));
  const dueAt = ukTime(now, 0, 8).getTime();
  const todayKey = day(now);
  if (s.weeklyOn && parts.weekday === "Mon" && now >= dueAt && (s.lastWeeklyAt ?? "") < todayKey) {
    await sendReport("weekly", s.managerNumbers, "the scheduler");
    await saveGrowthSettings({ lastWeeklyAt: todayKey });
    sent.push("weekly");
  }
  if (s.monthlyOn && parts.day === "01" && now >= dueAt && (s.lastMonthlyAt ?? "") < todayKey) {
    await sendReport("monthly", s.managerNumbers, "the scheduler");
    await saveGrowthSettings({ lastMonthlyAt: todayKey });
    sent.push("monthly");
  }
  return { sent };
}
