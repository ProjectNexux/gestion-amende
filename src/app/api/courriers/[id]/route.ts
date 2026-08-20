import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete, isAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const isAdmin = await isAdminSession();

  const courrier = await prisma.courrier.findUnique({
    where: { id },
    select: { societe: true, fileName: true, fileMime: true, fileData: true },
  });
  if (!courrier || (!isAdmin && courrier.societe !== societe)) {
    return NextResponse.json({ error: "Courrier introuvable" }, { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
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
