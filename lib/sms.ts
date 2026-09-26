// SMS via Twilio – used as the fallback when a WhatsApp message can't be delivered.
// Without credentials it runs in dry-run mode (logged, not sent).

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(to: string, body: string): Promise<{ ok: true; dryRun: boolean } | { ok: false; error: string }> {
  if (!smsConfigured()) return { ok: true, dryRun: true };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: json.message || `HTTP ${res.status}` };
  }
  return { ok: true, dryRun: false };
}
