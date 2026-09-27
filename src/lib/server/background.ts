// Lets a request reply straight away and finish slower work (sending emails
// and WhatsApps) afterwards. On Vercel this uses the platform's waitUntil,
// which keeps the function running until the work is done; that's the same
// hook the @vercel/functions package uses, without adding it. Anywhere else
// (e.g. locally) the work is simply awaited.

type RequestContext = { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined };

export async function afterResponse(work: Promise<unknown>) {
  const ctx = (globalThis as Record<symbol, RequestContext | undefined>)[Symbol.for("@vercel/request-context")]?.get?.();
  const safe = work.catch((e) => console.error("[background]", e));
  if (ctx?.waitUntil) ctx.waitUntil(safe);
  else await safe;
}
