import { NextResponse } from "next/server";
import { fetchEmailsViaImap } from "@/lib/email-scan";

const CRON_SECRET = process.env.SCAN_CRON_SECRET;

export async function GET(request: Request) {
  if (CRON_SECRET) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await fetchEmailsViaImap();
  return NextResponse.json(result);
}
