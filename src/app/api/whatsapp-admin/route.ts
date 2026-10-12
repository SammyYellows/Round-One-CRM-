// One-off WhatsApp number moves (Sammy, 12/10/2026: move the gym number,
// API-only, into the GBP account). Switches a number off or on for the
// Cloud API with the CRM's own key, so the key never leaves Vercel. Needs
// CRON_SECRET. Actions: {action:"deregister", phoneId} and
// {action:"register", phoneId, pin} (pin: the six-digit two-step PIN).

export const dynamic = "force-dynamic";

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; phoneId?: string; pin?: string };
  const phoneId = String(b.phoneId ?? "");
  if (!/^\d+$/.test(phoneId)) return Response.json({ error: "phoneId must be the number's id" }, { status: 400 });
  let body: Record<string, string>;
  if (b.action === "deregister") body = {};
  else if (b.action === "register" && /^\d{6}$/.test(String(b.pin ?? ""))) body = { messaging_product: "whatsapp", pin: String(b.pin) };
  else return Response.json({ error: "Unknown action, or the PIN isn't six digits" }, { status: 400 });
  const res = await fetch(`${API}/${phoneId}/${b.action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Response.json({ status: res.status, meta: await res.json().catch(() => ({})) });
}
