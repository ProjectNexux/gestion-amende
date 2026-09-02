import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Espace client (2026-08-24) — the only file-serving route reachable by the CLIENT role
 * (enforced by src/middleware.ts, which blocks every other /api/* path for that role). Applies
 * the exact same double filter as the client pages: société match AND visibleClient === true,
 * regardless of who's asking (including admin) — this URL's whole purpose is "what a client is
 * allowed to see", so the rule is never relaxed here.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const contravention = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
    select: { id: true },
  });
  if (!contravention) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const scan = await prisma.emailScan.findFirst({
    where: { contraventionId: contravention.id },
    select: { fileName: true, fileMime: true, fileData: true },
  });
  if (!scan) {
    return NextResponse.json({ error: "Aucun document pour ce dossier" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const safeName = scan.fileName.replace(/[\r\n"]/g, "_");

  return new NextResponse(new Uint8Array(scan.fileData), {
    headers: {
      "Content-Type": scan.fileMime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
