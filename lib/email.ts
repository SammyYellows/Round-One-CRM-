// Email via Resend (https://resend.com). Without an API key it runs in dry-run mode.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: true; dryRun: boolean } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: true, dryRun: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: json.message || `HTTP ${res.status}` };
  }
  return { ok: true, dryRun: false };
}
