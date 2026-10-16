// One photo, sticker, video, voice note or document someone sent us, for the
// message thread (Sammy, 16/10/2026). Any signed-in staff member; redirects
// to a ten-minute link to the private message-media bucket.

import { mediaLink } from "@/lib/server/media";
import { requireStaff } from "@/lib/server/staff";
import { db } from "@/lib/server/supabase";
import type { MessageMedia } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string; n: string } }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { data } = await db().from("messages").select("media").eq("id", params.id).maybeSingle();
  const item = ((data?.media as MessageMedia[] | null) ?? [])[Number(params.n)];
  if (!item) return new Response("Not found", { status: 404 });
  try {
    return Response.redirect(await mediaLink(item.path), 302);
  } catch {
    return new Response("Not available", { status: 404 });
  }
}
