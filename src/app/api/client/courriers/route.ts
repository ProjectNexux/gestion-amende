import { NextResponse } from "next/server";
import { requireSociete } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const societe = await requireSociete();

  try {
    // Same double filter as everywhere in the client portal: société AND visibleClient
    // Excludes the client's own "client_envoi" submissions
    const items = await prisma.courrier.findMany({
      where: {
        societe,
        visibleClient: true,
        type: { not: "client_envoi" },
      },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        receivedAt: true,
        data: true,
      },
      orderBy: { receivedAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("[client-courriers]", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
