// Photos, stickers, videos, voice notes and documents people send us (Sammy,
// 16/10/2026: "I want to see them"). Meta only holds them for a while, so
// each is copied into the private message-media bucket as soon as the
// message arrives, and listed on the message. Staff open them through
// /api/media/<message id>/<n>, which hands out a short-lived link. Nothing
// is ever sent anywhere.

import type { MessageMedia } from "@/lib/types";
import { db } from "./supabase";

const BUCKET = "message-media";
const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;
const MAX_BYTES = 25 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "application/pdf": "pdf",
};
const ext = (mime: string) => EXT[mime.split(";")[0].trim()] ?? "bin";

async function store(path: string, bytes: ArrayBuffer, mime: string) {
  const { error } = await db().storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: mime, upsert: true });
  if (error) throw new Error(`Storing ${path}: ${error.message}`);
}

async function attach(messageId: string, media: MessageMedia[]) {
  if (!media.length) return;
  const { error } = await db().from("messages").update({ media }).eq("id", messageId);
  if (error) throw new Error(`Saving media on ${messageId}: ${error.message}`);
}

export type WhatsAppMediaRef = { id: string; kind: MessageMedia["kind"]; mime?: string; name?: string };

/** WhatsApp gives a media id: ask Meta where it is, then fetch it with our key. */
export async function saveWhatsAppMedia(messageId: string, refs: WhatsAppMediaRef[]) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !refs.length) return;
  const auth = { Authorization: `Bearer ${token}` };
  const media: MessageMedia[] = [];
  for (const [i, ref] of refs.entries()) {
    try {
      const info = (await (await fetch(`${API}/${ref.id}`, { headers: auth })).json()) as { url?: string; mime_type?: string; file_size?: number };
      if (!info.url || (info.file_size ?? 0) > MAX_BYTES) continue;
      const res = await fetch(info.url, { headers: auth });
      if (!res.ok) continue;
      const mime = info.mime_type || ref.mime || res.headers.get("content-type") || "application/octet-stream";
      const path = `whatsapp/${messageId}-${i}.${ext(mime)}`;
      await store(path, await res.arrayBuffer(), mime);
      media.push({ kind: ref.kind, path, mime, ...(ref.name ? { name: ref.name } : {}) });
    } catch (e) {
      console.error("[media] whatsapp", messageId, e instanceof Error ? e.message : e);
    }
  }
  await attach(messageId, media);
}

export type SocialMediaRef = { url: string; kind: MessageMedia["kind"] };

/** Facebook and Instagram give a temporary link to each attachment. */
export async function saveSocialMedia(messageId: string, refs: SocialMediaRef[]) {
  const media: MessageMedia[] = [];
  for (const [i, ref] of refs.entries()) {
    try {
      const res = await fetch(ref.url);
      const size = Number(res.headers.get("content-length") ?? 0);
      if (!res.ok || size > MAX_BYTES) continue;
      const mime = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
      const path = `social/${messageId}-${i}.${ext(mime)}`;
      await store(path, await res.arrayBuffer(), mime);
      media.push({ kind: ref.kind, path, mime });
    } catch (e) {
      console.error("[media] social", messageId, e instanceof Error ? e.message : e);
    }
  }
  await attach(messageId, media);
}

/** A link to one saved file, good for ten minutes. */
export async function mediaLink(path: string) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) throw new Error(error?.message ?? "No link");
  return data.signedUrl;
}
