// Facebook Messenger and Instagram messages through Meta's Graph API, over
// plain fetch (Sammy, 14/10/2026). Server-only. Messages go as the Round One
// Page, using the Page's own token, which the CRM gets from
// META_SOCIAL_TOKEN: the RoundOnecrm system user's token, with the Page and
// the Instagram account assigned to it. Without that and META_PAGE_ID
// nothing is sent: the message is logged instead.

import type { importSocialHistory } from "@/lib/engine";
import { SOCIAL_MAX_CHARS, type SocialChannel } from "@/lib/types";
import type { SendResult } from "./whatsapp";

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

export const socialConfigured = () => Boolean(process.env.META_SOCIAL_TOKEN && process.env.META_PAGE_ID);

type Json = Record<string, unknown> & { error?: { message?: string } };

async function graph(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; status: number; json: Json }> {
  const res = await fetch(`${API}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Json };
}

let cached: { token: string; at: number } | null = null;

/** The Page's token, from the system user's (kept an hour; it doesn't expire). */
export async function pageToken() {
  if (cached && Date.now() - cached.at < 3600e3) return cached.token;
  const r = await graph(`${process.env.META_PAGE_ID}?fields=access_token`, process.env.META_SOCIAL_TOKEN ?? "");
  const token = r.json.access_token;
  if (!r.ok || typeof token !== "string") throw new Error(r.json.error?.message || `Meta said ${r.status}`);
  cached = { token, at: Date.now() };
  return token;
}

/**
 * A reply in their Facebook or Instagram conversation. Meta only takes one
 * within 24 hours of their last message; `late` (24 hours to 7 days) sends
 * it with Meta's human agent tag, which is for a person replying, never an
 * automation.
 */
export async function sendSocial(channel: SocialChannel, userId: string, text: string, late: boolean): Promise<SendResult> {
  if (text.length > SOCIAL_MAX_CHARS[channel]) return { ok: false, error: `Too long for ${channel === "facebook" ? "Facebook" : "Instagram"} (${SOCIAL_MAX_CHARS[channel]} characters at most)` };
  const payload = { recipient: { id: userId }, message: { text }, ...(late ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : { messaging_type: "RESPONSE" }) };
  if (!socialConfigured()) {
    console.log(`[${channel} dry run]`, JSON.stringify(payload));
    return { ok: true, dryRun: true };
  }
  try {
    const r = await graph(`${process.env.META_PAGE_ID}/messages`, await pageToken(), { method: "POST", body: payload });
    if (!r.ok) return { ok: false, error: r.json.error?.message || `Meta said ${r.status}` };
    return { ok: true, id: typeof r.json.message_id === "string" ? r.json.message_id : undefined, dryRun: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Their name (Facebook) or name and username (Instagram), for a new contact. Empty if Meta won't say. */
export async function socialProfile(channel: SocialChannel, userId: string): Promise<{ name?: string; username?: string }> {
  if (!socialConfigured()) return {};
  try {
    const r = await graph(`${userId}?fields=${channel === "facebook" ? "first_name,last_name" : "name,username"}`, await pageToken());
    if (!r.ok) return {};
    const j = r.json as { first_name?: string; last_name?: string; name?: string; username?: string };
    const name = channel === "facebook" ? [j.first_name, j.last_name].filter(Boolean).join(" ") : j.name;
    return { ...(name ? { name } : {}), ...(j.username ? { username: j.username } : {}) };
  } catch {
    return {};
  }
}

const appToken = () => `${process.env.META_APP_ID}|${process.env.WHATSAPP_APP_SECRET}`;
const PAGE_FIELDS = "messages,message_echoes,message_deliveries,message_reads,messaging_postbacks";
const INSTAGRAM_FIELDS = "messages,messaging_seen,messaging_postbacks";

/** What the token can do and which Page and Instagram account it reaches (read only). For setting up. */
export async function socialCheck() {
  const token = process.env.META_SOCIAL_TOKEN;
  if (!token) return { error: "META_SOCIAL_TOKEN isn’t set in Vercel" };
  const [debug, pages, subs] = await Promise.all([
    graph(`debug_token?input_token=${encodeURIComponent(token)}`, appToken()),
    graph("me/accounts?fields=id,name,instagram_business_account{id,username}", token),
    graph(`${process.env.META_APP_ID}/subscriptions`, appToken()),
  ]);
  const page = process.env.META_PAGE_ID ? await pageToken().then((t) => graph(`${process.env.META_PAGE_ID}/subscribed_apps`, t)).catch((e): { json: Json } => ({ json: { error: { message: String(e) } } })) : null;
  const d = (debug.json.data ?? {}) as { is_valid?: boolean; scopes?: string[]; type?: string };
  return {
    token: { valid: d.is_valid, type: d.type, scopes: d.scopes },
    pages: pages.json.data ?? pages.json.error,
    pageId: process.env.META_PAGE_ID ?? null,
    pageSubscribedApps: page?.json.data ?? page?.json.error ?? null,
    appWebhooks: subs.json.data ?? subs.json.error,
  };
}

/** Sends the Page's and Instagram's messages to `callback` (the CRM's webhook): the app's webhooks, then the Page itself. */
export async function socialSubscribe(callback: string) {
  if (!socialConfigured()) return { error: "Needs META_SOCIAL_TOKEN and META_PAGE_ID in Vercel" };
  const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const sub = (object: string, fields: string) =>
    graph(`${process.env.META_APP_ID}/subscriptions?object=${object}&callback_url=${encodeURIComponent(callback)}&fields=${fields}&verify_token=${encodeURIComponent(verify)}`, appToken(), { method: "POST" });
  const page = await sub("page", PAGE_FIELDS);
  const instagram = await sub("instagram", INSTAGRAM_FIELDS);
  const pageApps = await graph(`${process.env.META_PAGE_ID}/subscribed_apps?subscribed_fields=${PAGE_FIELDS}`, await pageToken(), { method: "POST" });
  return { page: page.json, instagram: instagram.json, pageSubscribedApps: pageApps.json };
}

// ---- Earlier messages (Sammy, 14/10/2026: "i just want to see the old messages") ----

type GraphMessage = { id: string; created_time: string; from?: { id?: string }; message?: string; attachments?: { data?: { mime_type?: string }[] } };
type GraphConversation = {
  participants?: { data?: { id: string; name?: string; username?: string }[] };
  messages?: { data?: GraphMessage[]; paging?: { next?: string } };
};

function historyText(m: GraphMessage) {
  if (m.message?.trim()) return m.message.slice(0, 4000);
  const kinds = (m.attachments?.data ?? []).map((a) => {
    const t = a.mime_type ?? "";
    return t.startsWith("image/") ? "Photo" : t.startsWith("video/") ? "Video" : t.startsWith("audio/") ? "Voice note" : "Attachment";
  });
  return kinds.length ? kinds.map((k) => `[${k}]`).join(" ") : "[Message]";
}

/** Facebook keeps a whole conversation; Instagram lets us read its last 20 messages. Long Facebook ones stop at this many. */
const HISTORY_CAP = 300;

/**
 * Reads up to 25 conversations (Instagram: 10 or fewer) from the Page and,
 * unless `dryRun`, copies their messages into the CRM for reading
 * (importSocialHistory: never sent, never leads). `after` carries on from
 * the last call's `next`. Read only when `dryRun`.
 */
export async function socialHistory(channel: SocialChannel, opts: { dryRun: boolean; after?: string }, save: (items: Parameters<typeof importSocialHistory>[1][]) => Promise<number>) {
  if (!socialConfigured()) return { error: "Needs META_SOCIAL_TOKEN and META_PAGE_ID in Vercel" };
  const token = await pageToken();
  const pageId = process.env.META_PAGE_ID ?? "";
  const ig = channel === "instagram" ? await graph(`${pageId}?fields=instagram_business_account`, token) : null;
  const ours = new Set([pageId, String((ig?.json.instagram_business_account as { id?: string } | undefined)?.id ?? "")]);
  const per = channel === "instagram" ? 20 : 100;
  // Meta refuses big Instagram reads ("reduce the amount of data"), so ask for fewer conversations until it answers.
  let r: Awaited<ReturnType<typeof graph>> | undefined;
  for (const limit of channel === "instagram" ? [10, 4, 1] : [25, 10]) {
    r = await graph(
      `${pageId}/conversations?platform=${channel === "facebook" ? "messenger" : "instagram"}&limit=${limit}` +
      `&fields=participants,messages.limit(${per}){id,created_time,from,message,attachments}${opts.after ? `&after=${encodeURIComponent(opts.after)}` : ""}`,
      token,
    );
    if (r.ok || !/reduce the amount of data/i.test(r.json.error?.message ?? "")) break;
  }
  if (!r?.ok) return { error: r?.json.error?.message || `Meta said ${r?.status}` };
  const prefix = channel === "facebook" ? "fb" : "ig";
  const items = [];
  for (const conv of (r.json.data ?? []) as GraphConversation[]) {
    const them = conv.participants?.data?.find((p) => !ours.has(p.id));
    if (!them) continue;
    const msgs = [...(conv.messages?.data ?? [])];
    let next = conv.messages?.paging?.next;
    while (channel === "facebook" && next && msgs.length < HISTORY_CAP) {
      const page = await fetch(next, { cache: "no-store" }).then((x) => x.json()).catch(() => ({})) as { data?: GraphMessage[]; paging?: { next?: string } };
      msgs.push(...(page.data ?? []));
      next = page.paging?.next;
    }
    items.push({
      channel, userId: them.id,
      ...(them.name ? { name: them.name } : {}), ...(them.username ? { username: them.username } : {}),
      messages: msgs.map((m) => ({ id: `${prefix}_${m.id}`, dir: (ours.has(m.from?.id ?? "") ? "out" : "in") as "in" | "out", text: historyText(m), at: new Date(m.created_time).toISOString() })),
    });
  }
  const all = items.flatMap((i) => i.messages);
  const times = all.map((m) => Date.parse(m.at)).sort((a, b) => a - b);
  const recent = items.filter((i) => {
    const last = i.messages.reduce<{ dir: string; at: string } | null>((a, b) => (!a || Date.parse(b.at) > Date.parse(a.at) ? b : a), null);
    return last?.dir === "in" && Date.now() - Date.parse(last.at) <= 7 * 86400e3;
  }).length;
  const paging = r.json.paging as { next?: string; cursors?: { after?: string } } | undefined;
  return {
    conversations: items.length,
    messages: all.length,
    oldest: times.length ? new Date(times[0]).toISOString().slice(0, 10) : null,
    newest: times.length ? new Date(times[times.length - 1]).toISOString().slice(0, 10) : null,
    waitingLast7Days: recent,
    added: opts.dryRun ? 0 : await save(items),
    next: paging?.next ? paging.cursors?.after ?? null : null,
  };
}
