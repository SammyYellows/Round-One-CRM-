import { NextResponse } from "next/server";
import { processDueMessages } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = new URL(req.url).searchParams.get("key") || req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (secret && given !== secret) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json(await processDueMessages());
}
