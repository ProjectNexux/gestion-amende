import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession, requireSociete } from "@/lib/auth";
import { getVisibleSocieteFilter } from "@/lib/org-scope";

type RouteParams = Promise<{ id: string; side: string }>;

export async function GET(req: NextRequest, { params }: { params: RouteParams }) {
  const { id, side } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const conducteur = await prisma.conducteur.findFirst({
    where: { id, ...(await getVisibleSocieteFilter()) },
    select: {
      permisRectoData: true,
      permisRectoNom: true,
      permisRectoMime: true,
      permisVersoData: true,
      permisVersoNom: true,
      permisVersoMime: true,
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

  const data = isRecto ? conducteur.permisRectoData : conducteur.permisVersoData;
  const mime = isRecto ? conducteur.permisRectoMime : conducteur.permisVersoMime;
  const fileName = isRecto ? conducteur.permisRectoNom : conducteur.permisVersoNom;

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
