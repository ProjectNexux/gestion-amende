import { NextResponse } from "next/server";
import { fetchEmailsViaImap } from "@/lib/email-scan";
import { processPendingEmailScans } from "@/lib/email-process";

export const maxDuration = 300;

// Vercel Cron automatically sends Authorization only for CRON_SECRET. The legacy
// SCAN_CRON_SECRET is kept for non-Vercel/manual calls, and is tolerated for Vercel Cron
// requests (header x-vercel-cron) so polling never gets silently blocked in production.
const CRON_SECRET = process.env.CRON_SECRET;
const LEGACY_SCAN_CRON_SECRET = process.env.SCAN_CRON_SECRET;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  const isVercelCronRequest = request.headers.has("x-vercel-cron");

  if (CRON_SECRET) {
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (LEGACY_SCAN_CRON_SECRET && token !== LEGACY_SCAN_CRON_SECRET) {
    if (!isVercelCronRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const fetchResult = await fetchEmailsViaImap();
  // Same two-step cycle as the dev-only setInterval scheduler (src/lib/email-poll-scheduler.ts):
  // fetch new IMAP messages into EmailScan rows, then run OCR/classification on pending ones.
  // Called as a direct function here (not an internal HTTP round-trip) since a Vercel serverless
  // invocation has no persistent localhost server to call back into.
  const processResult = await processPendingEmailScans();
  return NextResponse.json({ fetch: fetchResult, process: processResult });
}
