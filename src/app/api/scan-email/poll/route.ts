import { NextResponse } from "next/server";
import { fetchEmailsViaImap } from "@/lib/email-scan";
import { processPendingEmailScans } from "@/lib/email-process";

// Accepts either name: SCAN_CRON_SECRET (this project's original convention) or CRON_SECRET
// (Vercel's own convention — Vercel Cron Jobs automatically send `Authorization: Bearer
// $CRON_SECRET` when an env var of that exact name exists, no manual header wiring needed).
const CRON_SECRET = process.env.CRON_SECRET ?? process.env.SCAN_CRON_SECRET;

export async function GET(request: Request) {
  if (CRON_SECRET) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
    if (token !== CRON_SECRET) {
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
