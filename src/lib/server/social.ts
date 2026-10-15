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
  id?: string;
  participants?: { data?: { id: string; name?: string; username?: string }[] };
  messages?: { data?: GraphMessage[]; paging?: { next?: string } };
};

/**
 * Instagram won't hand over messages inside a conversation list (it times
 * out or asks for less), so: the conversation's last 20 message ids, then
 * each message on its own, as Meta's Instagram docs do it.
 */
async function instagramConversation(conversationId: string, token: string): Promise<GraphConversation> {
  const r = await graph(`${conversationId}?fields=participants,messages.limit(20)`, token);
  const ids = ((r.json.messages as { data?: { id: string }[] } | undefined)?.data ?? []).map((m) => m.id);
  const got = await Promise.all(ids.map((id) => graph(`${id}?fields=id,created_time,from,message,attachments`, token)));
  return {
    id: conversationId,
    participants: r.json.participants as GraphConversation["participants"],
    messages: { data: got.filter((x) => x.ok && x.json.created_time).map((x) => x.json as unknown as GraphMessage) },
  };
}

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
 * Reads up to 25 conversations (Instagram: 10) from the Page and,
 * unless `dryRun`, copies their messages into the CRM for reading
 * (importSocialHistory: never sent, never leads). `after` carries on from
 * the last call's `next`. Read only when `dryRun`.
 */
export async function socialHistory(channel: SocialChannel, opts: { dryRun: boolean; after?: string }, save: (items: HistoryItem[]) => Promise<number>) {
  // Meta times out listing Instagram conversations through the Page (14–15/10/2026), so Instagram reads through Instagram Login when that token is set.
  if (channel === "instagram" && process.env.INSTAGRAM_LOGIN_TOKEN) return instagramLoginHistory(opts, save);
  if (!socialConfigured()) return { error: "Needs META_SOCIAL_TOKEN and META_PAGE_ID in Vercel" };
  const token = await pageToken();
  const pageId = process.env.META_PAGE_ID ?? "";
  const ig = channel === "instagram" ? await graph(`${pageId}?fields=instagram_business_account`, token) : null;
  const ours = new Set([pageId, String((ig?.json.instagram_business_account as { id?: string } | undefined)?.id ?? "")]);
  // Facebook gives messages with the conversations; Instagram only the conversations (messages fetched one by one below).
  const fields = channel === "facebook" ? "participants,messages.limit(100){id,created_time,from,message,attachments}" : "id";
  let r: Awaited<ReturnType<typeof graph>> | undefined;
  for (const limit of channel === "instagram" ? [10, 3, 1] : [25, 10]) {
    r = await graph(
      `${pageId}/conversations?platform=${channel === "facebook" ? "messenger" : "instagram"}&limit=${limit}&fields=${fields}${opts.after ? `&after=${encodeURIComponent(opts.after)}` : ""}`,
      token,
    );
    // Too much at once: ask for fewer conversations.
    if (r.ok || !/reduce the amount of data|timeout/i.test(r.json.error?.message ?? "")) break;
  }
  if (!r?.ok) return { error: r?.json.error?.message || `Meta said ${r?.status}` };
  const prefix = channel === "facebook" ? "fb" : "ig";
  const items = [];
  for (const listed of (r.json.data ?? []) as GraphConversation[]) {
    const conv = channel === "instagram" && listed.id ? await instagramConversation(listed.id, token) : listed;
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
  return summarise(items, opts.dryRun, save, r.json.paging as Paging | undefined);
}

type HistoryItem = Parameters<typeof importSocialHistory>[1];
type Paging = { next?: string; cursors?: { after?: string } };

/** What a batch holds (and, unless a dry run, copies it in). */
async function summarise(items: HistoryItem[], dryRun: boolean, save: (items: HistoryItem[]) => Promise<number>, paging?: Paging, extra: Record<string, unknown> = {}) {
  const all = items.flatMap((i) => i.messages);
  const times = all.map((m) => Date.parse(m.at)).sort((a, b) => a - b);
  const recent = items.filter((i) => {
    const last = i.messages.reduce<{ dir: string; at: string } | null>((a, b) => (!a || Date.parse(b.at) > Date.parse(a.at) ? b : a), null);
    return last?.dir === "in" && Date.now() - Date.parse(last.at) <= 7 * 86400e3;
  }).length;
  return {
    conversations: items.length,
    messages: all.length,
    oldest: times.length ? new Date(times[0]).toISOString().slice(0, 10) : null,
    newest: times.length ? new Date(times[times.length - 1]).toISOString().slice(0, 10) : null,
    waitingLast7Days: recent,
    ...extra,
    added: dryRun ? 0 : await save(items),
    next: paging?.next ? paging.cursors?.after ?? null : null,
  };
}

// Instagram Login (Sammy chose this on 15/10/2026 after the Page route kept
// timing out): graph.instagram.com with a 60-day token Sammy made in the app
// dashboard for @roundonefitness (INSTAGRAM_LOGIN_TOKEN, read only here).
// Meta only gives the text of each conversation's latest 20 messages.
const IG_API = `https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION || "v25.0"}`;

async function igGraph(path: string): Promise<{ ok: boolean; status: number; json: Json }> {
  const res = await fetch(`${IG_API}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(process.env.INSTAGRAM_LOGIN_TOKEN ?? "")}`, { cache: "no-store" });
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Json };
}

/** Runs `fn` over `list`, a few at a time, so a batch of conversations finishes well inside Vercel's limit. */
async function pool<T, R>(list: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (i < list.length) { const n = i++; out[n] = await fn(list[n]); }
  }));
  return out;
}

type IgUser = { id?: string; username?: string };
type IgMessage = { id: string; created_time: string; from?: IgUser; to?: { data?: IgUser[] }; message?: string; attachments?: { data?: { mime_type?: string }[] } };

async function instagramLoginHistory(opts: { dryRun: boolean; after?: string }, save: (items: HistoryItem[]) => Promise<number>) {
  const me = await igGraph("me?fields=user_id,username");
  if (!me.ok) return { error: `Instagram Login: ${me.json.error?.message || `Meta said ${me.status}`}` };
  const ourId = String(me.json.user_id ?? "");
  const ourName = String(me.json.username ?? "").toLowerCase();
  const isUs = (u?: IgUser) => !!u && ((!!ourId && u.id === ourId) || (!!ourName && u.username?.toLowerCase() === ourName));
  const list = await igGraph(`me/conversations?platform=instagram&limit=10&fields=id,updated_time${opts.after ? `&after=${encodeURIComponent(opts.after)}` : ""}`);
  if (!list.ok) return { error: `Instagram Login: ${list.json.error?.message || `Meta said ${list.status}`}` };
  const BASE = "id,created_time,from,to,message";
  let withAttachments = true;
  const conversations = (list.json.data ?? []) as { id: string }[];
  const read = await pool(conversations, 4, async (conv) => {
    const r = await igGraph(`${conv.id}?fields=messages`);
    const ids = ((r.json.messages as { data?: { id: string }[] } | undefined)?.data ?? []).map((m) => m.id);
    const latest = ids.slice(0, 20); // newest first; older ones come back as "deleted"
    const got = await pool(latest, 5, async (id) => {
      const tried = withAttachments;
      let m = await igGraph(`${id}?fields=${BASE}${tried ? ",attachments" : ""}`);
      // If Meta won't give attachments, ask again without them (and from then on).
      if (!m.ok && tried && /attachments|field/i.test(m.json.error?.message ?? "")) { withAttachments = false; m = await igGraph(`${id}?fields=${BASE}`); }
      return m.ok && m.json.created_time ? (m.json as unknown as IgMessage) : null;
    });
    const msgs = got.filter((m): m is IgMessage => !!m);
    const them = msgs.map((m) => (isUs(m.from) ? m.to?.data?.find((u) => !isUs(u)) : m.from)).find((u) => u?.id);
    return { them, msgs, older: Math.max(0, ids.length - latest.length) };
  });
  const items: HistoryItem[] = read.filter((c) => c.them?.id && c.msgs.length).map((c) => ({
    channel: "instagram" as const, userId: c.them!.id!, ...(c.them!.username ? { username: c.them!.username } : {}),
    messages: c.msgs.map((m) => ({ id: `ig_${m.id}`, dir: (isUs(m.from) ? "out" : "in") as "in" | "out", text: historyText(m), at: new Date(m.created_time).toISOString() })),
  }));
  return summarise(items, opts.dryRun, save, list.json.paging as Paging | undefined, { route: "instagram-login", olderNotReadable: read.reduce((n, c) => n + c.older, 0) });
}
