import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession, requireSociete } from "@/lib/auth";

type RouteParams = Promise<{ id: string; side: string }>;

export async function GET(req: NextRequest, { params }: { params: RouteParams }) {
  const { id, side } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const conducteur = await prisma.conducteur.findFirst({
    where: isAdmin ? { id } : { id, societe },
    select: {
      cniRectoData: true,
      cniRectoNom: true,
      cniRectoMime: true,
      cniVersoData: true,
      cniVersoNom: true,
      cniVersoMime: true,
    },
  });

  if (!conducteur) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isRecto = side === "recto";
  const isVerso = side === "verso";
  if (!isRecto && !isVerso) {
    return new NextResponse("Not found", { status: 404 });
  }

  const data = isRecto ? conducteur.cniRectoData : conducteur.cniVersoData;
  const mime = isRecto ? conducteur.cniRectoMime : conducteur.cniVersoMime;
  const fileName = isRecto ? conducteur.cniRectoNom : conducteur.cniVersoNom;

  if (!data || !mime || !fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const safeName = fileName.replace(/[\r\n"]/g, "_");
  const body = new Uint8Array(data);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
    },
  });
}
