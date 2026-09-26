// Runs once when the server starts: sends due automation messages every minute.
// (Also reachable via GET /api/cron for external schedulers.)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_TICKER === "1") return;
  const g = globalThis as unknown as { __r1Ticker?: NodeJS.Timeout };
  if (g.__r1Ticker) return;
  const { processDueMessages } = await import("./lib/workflows");
  const tick = async () => {
    try {
      const r = await processDueMessages();
      if (r.sent || r.failed) console.log(`[automations] sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped}`);
    } catch (e) {
      console.error("[automations]", e);
    }
  };
  g.__r1Ticker = setInterval(tick, 60_000);
  setTimeout(tick, 2_000);
  console.log("[automations] ticker started");
}
