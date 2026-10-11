// Checks the email set-up after a key change (11/10/2026): sends one test
// email to STAFF_EMAIL through the CRM's Resend key, and checks the key can
// read received emails (Enquiries need that). Needs CRON_SECRET, like /api/cron.

import { sendEmail } from "@/lib/server/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  const to = process.env.STAFF_EMAIL || "info@round1boxfit.co.uk";
  const sent = await sendEmail(to, "CRM email check", "This is a test from the Round One CRM after changing its email key. If you can read this, CRM emails are working. Nothing to do.");
  let receiving = "not checked (no key)";
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const r = await fetch("https://api.resend.com/emails/receiving?limit=1", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    receiving = r.ok ? "ok" : `Resend said ${r.status}`;
  }
  return Response.json({ to, sent, receiving });
}
