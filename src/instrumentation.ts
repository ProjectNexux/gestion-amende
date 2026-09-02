export async function register() {
  // Only run in the Node.js server runtime (not edge, not build phase). Skipped entirely on
  // Vercel (`process.env.VERCEL` is always set there) — a `setInterval` never fires reliably in a
  // serverless function that freezes/terminates right after each response, so Vercel Cron Jobs
  // (see vercel.json → /api/scan-email/poll and /api/cron/pub-cleanup) replace both schedulers
  // there instead. Local `next dev`/a traditional persistent Node server keep using these exactly
  // as before.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startEmailPollScheduler } = await import("@/lib/email-poll-scheduler");
    startEmailPollScheduler();

    const { startPubCleanupScheduler } = await import("@/lib/pub-cleanup-scheduler");
    startPubCleanupScheduler();
  }
}
