// Facebook Messenger and Instagram messages through Meta's Graph API, over
// plain fetch (Sammy, 14/10/2026). Server-only. Messages go as the Round One
// Page, using the Page's own token, which the CRM gets from
// META_SOCIAL_TOKEN: the RoundOnecrm system user's token, with the Page and
// the Instagram account assigned to it. Without that and META_PAGE_ID
// nothing is sent: the message is logged instead.

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
