export async function register() {
  // Only run in the Node.js server runtime (not edge, not build phase).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEmailPollScheduler } = await import("@/lib/email-poll-scheduler");
    startEmailPollScheduler();

    const { startPubCleanupScheduler } = await import("@/lib/pub-cleanup-scheduler");
    startPubCleanupScheduler();
  }
}
