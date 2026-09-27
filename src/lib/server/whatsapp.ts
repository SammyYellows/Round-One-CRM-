// WhatsApp through Meta's Cloud API, over plain fetch. Server-only.
// Without WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID (e.g. locally) nothing
// is sent: the message is logged instead.

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

export type SendResult = { ok: true; id?: string; dryRun: boolean } | { ok: false; error: string };

export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  if (!whatsappConfigured()) {
    console.log("[whatsapp dry run]", JSON.stringify(payload));
    return { ok: true, dryRun: true };
  }
  try {
    const res = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; error_data?: { details?: string } } };
    if (!res.ok) return { ok: false, error: json.error?.error_data?.details || json.error?.message || `Meta said ${res.status}` };
    return { ok: true, id: json.messages?.[0]?.id, dryRun: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export interface TemplateSend {
  name: string;
  language: string;
  params: string[]; // body {{1}}, {{2}}…
  videoUrl?: string; // header video
  buttonParam?: string; // the end of a "Book meeting" link
}

export function sendTemplate(to: string, t: TemplateSend) {
  const components: Record<string, unknown>[] = [];
  if (t.videoUrl) components.push({ type: "header", parameters: [{ type: "video", video: { link: t.videoUrl } }] });
  if (t.params.length) components.push({ type: "body", parameters: t.params.map((text) => ({ type: "text", text })) });
  if (t.buttonParam) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: t.buttonParam }] });
  return post({ to, type: "template", template: { name: t.name, language: { code: t.language }, components } });
}

/** Free text. WhatsApp only delivers it within 24 hours of their last message. */
export const sendText = (to: string, body: string) => post({ to, type: "text", text: { body } });
