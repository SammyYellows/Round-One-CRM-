// The Reports screen: the numbers, the settings, and sending.
//   GET            numbers for both reports + settings
//   PUT            save settings
//   POST {action}  "send" (WhatsApp to the managers; needs confirm:true),
//                  "email" (the PDF to the signed-in staff member's email),
//                  "pdf" (store a fresh PDF and return its link)

import { requireStaff } from "@/lib/server/staff";
import { growthSettings, saveGrowthSettings, type GrowthSettings } from "@/lib/server/growth";
import { buildReport, emailReport, renderPdf, sendReport, storeReport, type ReportKind } from "@/lib/server/reports";
import { whatsappConfigured } from "@/lib/server/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS: ReportKind[] = ["weekly", "monthly"];

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [weekly, monthly] = await Promise.all([buildReport("weekly"), buildReport("monthly")]);
  return Response.json({ weekly, monthly, settings: weekly.settings, whatsapp: whatsappConfigured(), staffEmail: auth.staff.email || process.env.STAFF_EMAIL || null });
}

export async function PUT(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as Partial<GrowthSettings>;
  const int = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const list = (v: unknown, lo: number, hi: number) => (Array.isArray(v) ? v.map((x) => int(x, lo, hi, 0)).filter((n) => n > 0).slice(0, 6) : undefined);
  const patch: Partial<GrowthSettings> = {};
  if (b.pastDays !== undefined) patch.pastDays = int(b.pastDays, 7, 365, 30);
  if (b.forecastDays !== undefined) patch.forecastDays = int(b.forecastDays, 7, 365, 30);
  if (b.averageDays !== undefined) patch.averageDays = int(b.averageDays, 7, 365, 30);
  if (b.monthlyMonths !== undefined) { const l = list(b.monthlyMonths, 1, 24); if (l?.length) patch.monthlyMonths = [...new Set(l)].sort((x, y) => x - y); }
  if (b.forecastMonths !== undefined) { const l = list(b.forecastMonths, 1, 24); if (l?.length) patch.forecastMonths = [...new Set(l)].sort((x, y) => x - y); }
  if (b.managerNumbers !== undefined && Array.isArray(b.managerNumbers)) patch.managerNumbers = b.managerNumbers.map((n) => String(n).replace(/[^\d+]/g, "")).filter((n) => n.replace(/\D/g, "").length >= 10).slice(0, 5);
  if (typeof b.weeklyOn === "boolean") patch.weeklyOn = b.weeklyOn;
  if (typeof b.monthlyOn === "boolean") patch.monthlyOn = b.monthlyOn;
  const settings = await saveGrowthSettings(patch);
  return Response.json({ ok: true, settings });
}

export async function POST(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const b = (await req.json().catch(() => ({}))) as { action?: string; kind?: ReportKind; confirm?: boolean };
  const kind = KINDS.includes(b.kind as ReportKind) ? (b.kind as ReportKind) : "weekly";
  try {
    if (b.action === "pdf") {
      const r = await buildReport(kind);
      const stored = await storeReport(kind, renderPdf(r));
      return Response.json({ ok: true, url: stored.url });
    }
    if (b.action === "email") {
      const to = auth.staff.email || process.env.STAFF_EMAIL;
      if (!to) return Response.json({ error: "No email address to send it to" }, { status: 400 });
      const res = await emailReport(kind, to);
      return res.ok ? Response.json({ ok: true, to, dryRun: res.dryRun }) : Response.json({ error: res.error }, { status: 502 });
    }
    if (b.action === "send") {
      if (b.confirm !== true) return Response.json({ error: "Confirm first" }, { status: 400 });
      const s = await growthSettings();
      if (!s.managerNumbers.length) return Response.json({ error: "Add the managers' WhatsApp numbers in Settings first" }, { status: 400 });
      const out = await sendReport(kind, s.managerNumbers, auth.staff.name);
      return Response.json({ ok: true, ...out });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
