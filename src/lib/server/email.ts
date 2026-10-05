// Email through Resend (https://resend.com), over plain fetch. Server-only.
// Without RESEND_API_KEY (e.g. locally) nothing is sent: the email is logged.

export type SendResult = { ok: true; dryRun: boolean; id?: string } | { ok: false; error: string };

export interface SendOptions {
  from?: string; // defaults to EMAIL_FROM (bookings@)
  headers?: Record<string, string>; // e.g. In-Reply-To, to keep a reply in its thread
}

export async function sendEmail(to: string, subject: string, text: string, opts: SendOptions = {}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = opts.from || process.env.EMAIL_FROM || "Round One <bookings@round1boxfit.co.uk>";
  if (!key) {
    console.log(`[email dry run] from ${from} to ${to}: ${subject}\n${text}`);
    return { ok: true, dryRun: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(opts.headers ? { headers: opts.headers } : {}) }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message || `Resend said ${res.status}` };
    return { ok: true, dryRun: false, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** A received email, fetched from Resend by the id its webhook gave us. */
export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  messageId: string;
  createdAt: string;
}

export async function fetchReceivedEmail(id: string): Promise<ReceivedEmail> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY isn’t set");
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resend said ${res.status} fetching received email ${id}`);
  const j = (await res.json()) as Record<string, unknown>;
  return {
    id: String(j.id ?? id),
    from: String(j.from ?? ""),
    to: Array.isArray(j.to) ? j.to.map(String) : typeof j.to === "string" ? [j.to] : [],
    subject: String(j.subject ?? ""),
    text: typeof j.text === "string" ? j.text : "",
    html: typeof j.html === "string" ? j.html : null,
    messageId: String(j.message_id ?? ""),
    createdAt: typeof j.created_at === "string" ? j.created_at : new Date().toISOString(),
  };
}
