import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Espace client — mirrors /api/client/contraventions/[id]/document exactly. Reachable by the
 * CLIENT role only (see src/middleware.ts allow-list). Unlike Contravention (which relies on a
 * linked EmailScan), a Courrier stores its own file directly, so no join is needed. The filter
 * {id, societe, visibleClient:true} covers BOTH admin-shared courriers AND a client's own
 * submissions (source:"CLIENT" rows are always created with visibleClient:true).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const courrier = await prisma.courrier.findFirst({
    where: { id, societe, visibleClient: true },
    select: { fileName: true, fileMime: true, fileData: true },
  });
  if (!courrier) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const safeName = courrier.fileName.replace(/[\r\n"]/g, "_");

  return new NextResponse(new Uint8Array(courrier.fileData), {
    headers: {
      "Content-Type": courrier.fileMime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
