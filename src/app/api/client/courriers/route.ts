import { NextResponse } from "next/server";
import { requireSociete } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const societe = await requireSociete();

  try {
    // Same double filter as everywhere in the client portal: société AND visibleClient
    // Excludes the client's own "client_envoi" submissions
    const [items, favoris, envois] = await Promise.all([
      prisma.courrier.findMany({
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
      }),
      prisma.favori.findMany({ where: { societe, itemType: "courrier" }, select: { itemId: true } }),
      // Pièces jointes/réponses envoyées par le client et liées à un document reçu — alimente
      // l'historique du dossier (voir DocumentsList.tsx).
      prisma.courrier.findMany({
        where: { societe, type: "client_envoi" },
        select: { receivedAt: true, data: true },
      }),
    ]);

    const favoriIds = new Set(favoris.map((f) => f.itemId));
    const attachmentsByCourrier = new Map<string, { date: string }[]>();
    for (const e of envois) {
      const relatedId = (e.data as { relatedCourrierId?: string } | null)?.relatedCourrierId;
      if (!relatedId) continue;
      const list = attachmentsByCourrier.get(relatedId) ?? [];
      list.push({ date: e.receivedAt.toISOString() });
      attachmentsByCourrier.set(relatedId, list);
    }

    const enriched = items.map((item) => ({
      ...item,
      isFavori: favoriIds.has(item.id),
      pieceJointesAjoutees: attachmentsByCourrier.get(item.id) ?? [],
    }));

    return NextResponse.json(enriched, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[client-courriers]", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
