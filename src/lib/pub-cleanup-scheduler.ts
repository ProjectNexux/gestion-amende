import { prisma } from "@/lib/prisma";

function log(msg: string) { console.log(`[PUB-CLEANUP] ${msg}`); }
function logError(msg: string) { console.error(`[PUB-CLEANUP] ${msg}`); }

declare global {
  // eslint-disable-next-line no-var
  var __pubCleanupTimer: ReturnType<typeof setInterval> | undefined;
}

/**
 * Deletes every "pub" Courrier whose `expiresAt` has passed — for real, in the database, not just
 * hidden in the UI. A minimal trace is kept in CourrierSuppressionLog since the row (and its file)
 * won't exist afterwards to inspect. Runs independently of the e-mail/IMAP scheduler so it still
 * works even when IMAP polling is not configured.
 */
export async function cleanupExpiredPubCourriers(): Promise<{ deleted: number }> {
  const expired = await prisma.courrier.findMany({
    where: { type: "pub", expiresAt: { lte: new Date() } },
  });

  for (const courrier of expired) {
    await prisma.courrierSuppressionLog.create({
      data: {
        courrierId: courrier.id,
        societe: courrier.societe,
        type: courrier.type,
        fileName: courrier.fileName,
        receivedAt: courrier.receivedAt,
        motif: "Expiration automatique Pub (15 min)",
      },
    });
    await prisma.courrier.delete({ where: { id: courrier.id } });
    log(`Supprimé automatiquement (Pub expirée): ${courrier.fileName} (${courrier.id})`);
  }

  return { deleted: expired.length };
}

async function runCleanupCycle() {
  try {
    const { deleted } = await cleanupExpiredPubCourriers();
    if (deleted > 0) log(`${deleted} document(s) Pub supprimé(s)`);
  } catch (e) {
    logError(e instanceof Error ? e.message : String(e));
  }
}

// Runs as a background interval in the Node.js server process — a real server-side mechanism,
// not a browser setTimeout, so it keeps working even if no tab is open.
export function startPubCleanupScheduler() {
  if (globalThis.__pubCleanupTimer) return;

  const intervalMs = parseInt(process.env.PUB_CLEANUP_INTERVAL_MS ?? "60000", 10);
  if (!intervalMs || intervalMs <= 0) {
    log("Nettoyage automatique des Pub désactivé (PUB_CLEANUP_INTERVAL_MS = 0)");
    return;
  }

  log(`Démarrage du nettoyage automatique des Pub expirées (toutes les ${Math.round(intervalMs / 1000)}s)`);
  globalThis.__pubCleanupTimer = setInterval(runCleanupCycle, intervalMs);
  setTimeout(runCleanupCycle, 5000);
}
