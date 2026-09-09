import { NextResponse } from "next/server";
import { drainPendingEmailScans, processPendingEmailScans } from "@/lib/email-process";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { id, drain } = body as { id?: string; drain?: boolean };

  const result = drain && !id ? await drainPendingEmailScans() : await processPendingEmailScans(id);
  return NextResponse.json(result);
}
