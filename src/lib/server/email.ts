// Email through Resend (https://resend.com), over plain fetch. Server-only.
// Without RESEND_API_KEY (e.g. locally) nothing is sent: the email is logged.

export type SendResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Round One <bookings@round1boxfit.co.uk>";
  if (!key) {
    console.log(`[email dry run] to ${to}: ${subject}\n${text}`);
    return { ok: true, dryRun: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: json.message || `Resend said ${res.status}` };
    }
    return { ok: true, dryRun: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
