// WhatsApp Business (Meta Cloud API) client.
//
// Business-initiated messages must use templates approved in Meta Business Manager.
// Each automation step names a template and its {{placeholders}} are sent, in order,
// as the template's body parameters ({{1}}, {{2}}, ...).
//
// With no credentials configured the client runs in dry-run mode: messages are
// rendered and logged against the lead but not sent.

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type SendResult = { ok: true; id?: string; dryRun: boolean } | { ok: false; error: string };

async function post(payload: unknown): Promise<SendResult> {
  if (!whatsappConfigured()) return { ok: true, dryRun: true };
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) return { ok: false, error: json.error?.message || `HTTP ${res.status}` };
  return { ok: true, id: json.messages?.[0]?.id, dryRun: false };
}

const toWaId = (phone: string) => phone.replace(/^\+/, "");

export function sendTemplate(to: string, template: string, params: string[]): Promise<SendResult> {
  return post({
    messaging_product: "whatsapp",
    to: toWaId(to),
    type: "template",
    template: {
      name: template,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_GB" },
      components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [],
    },
  });
}

/** Free-form text. Only delivered if the lead messaged us in the last 24 hours. */
export function sendText(to: string, body: string): Promise<SendResult> {
  return post({ messaging_product: "whatsapp", to: toWaId(to), type: "text", text: { body } });
}
