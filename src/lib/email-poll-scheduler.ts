import { fetchEmailsViaImap } from "@/lib/email-scan";

function log(msg: string) { console.log(`[EMAIL-POLL] ${msg}`); }
function logError(msg: string) { console.error(`[EMAIL-POLL] ${msg}`); }

declare global {
  // eslint-disable-next-line no-var
  var __emailPollTimer: ReturnType<typeof setInterval> | undefined;
}

// Processing (OCR + parsing) is triggered via the existing internal API route
// instead of importing it directly, so this module's bundle never pulls in
// the OCR/sharp dependency chain (that stays scoped to the route handler).
async function triggerProcessing() {
  const port = process.env.PORT ?? "3000";
  const res = await fetch(`http://127.0.0.1:${port}/api/scan-email/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Échec du déclenchement de l'analyse (HTTP ${res.status})`);
}

async function runPollCycle() {
  try {
    const fetchResult = await fetchEmailsViaImap();
    if (fetchResult.errors.length > 0) {
      fetchResult.errors.forEach((e) => logError(e));
    }
    await triggerProcessing();
  } catch (e) {
    logError(e instanceof Error ? e.message : String(e));
  }
}

let cycleInProgress = false;

// Skips this tick instead of starting a new IMAP connection on top of a
// still-running one — overlapping cycles can exhaust Gmail's concurrent
// connection limit and make every connection time out.
async function runPollCycleGuarded() {
  if (cycleInProgress) {
    log("Cycle précédent encore en cours, ce tick est ignoré");
    return;
  }
  cycleInProgress = true;
  try {
    await runPollCycle();
  } finally {
    cycleInProgress = false;
  }
}

// Starts a single background interval that periodically checks the IMAP inbox
// and processes received scans. Guarded by a global flag so Next.js dev
// reloads (HMR) never spawn more than one polling loop per server process.
export function startEmailPollScheduler() {
  if (globalThis.__emailPollTimer) return;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const intervalMs = parseInt(process.env.SCAN_POLL_INTERVAL_MS ?? "60000", 10);

  if (!host || !user || !pass) {
    log("Polling automatique désactivé (EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD manquants)");
    return;
  }
  if (!intervalMs || intervalMs <= 0) {
    log("Polling automatique désactivé (SCAN_POLL_INTERVAL_MS = 0)");
    return;
  }

  log(`Démarrage du polling automatique (toutes les ${Math.round(intervalMs / 1000)}s)`);
  globalThis.__emailPollTimer = setInterval(runPollCycleGuarded, intervalMs);
  // Run an initial cycle shortly after boot instead of waiting a full interval.
  setTimeout(runPollCycleGuarded, 3000);
}
