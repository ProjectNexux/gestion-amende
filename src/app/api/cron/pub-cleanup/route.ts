import { NextResponse } from "next/server";
import { cleanupExpiredPubCourriers } from "@/lib/pub-cleanup-scheduler";

// Same CRON_SECRET convention as /api/scan-email/poll — see that route's comment.
const CRON_SECRET = process.env.CRON_SECRET ?? process.env.SCAN_CRON_SECRET;

export async function GET(request: Request) {
  if (CRON_SECRET) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await cleanupExpiredPubCourriers();
  return NextResponse.json(result);
}
