import { NextResponse } from "next/server";
import { processPendingEmailScans } from "@/lib/email-process";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };

  const result = await processPendingEmailScans(id);
  return NextResponse.json(result);
}
