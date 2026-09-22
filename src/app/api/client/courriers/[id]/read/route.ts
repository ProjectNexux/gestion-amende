import { NextRequest, NextResponse } from "next/server";
import { requireSociete } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const societe = await requireSociete();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const isRead = body.isRead === true;

  try {
    // Verify ownership and visibility
    const courrier = await prisma.courrier.findFirst({
      where: {
        id,
        societe,
        visibleClient: true,
      },
    });

    if (!courrier) {
      return NextResponse.json(
        { error: "Document non trouvé" },
        { status: 404 }
      );
    }

    // For now, store read state in data JSON
    const updatedData = {
      ...(courrier.data as Record<string, unknown>),
      isRead,
      lastReadAt: isRead ? new Date().toISOString() : null,
    };

    const updated = await prisma.courrier.update({
      where: { id },
      data: {
        data: updatedData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        data: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[courrier-read]", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
