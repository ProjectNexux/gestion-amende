import { NextRequest, NextResponse } from "next/server";
import { getUserId, isAdminSession, requireSociete } from "@/lib/auth";
import { getVisibleSocieteFilter } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";
import { commitDocumentAnalysis, type DocumentFields } from "@/lib/document-import";
import { groupScansByBundle, mergePdfBuffers, sortScansByPart } from "@/lib/scan-bundles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ownerSociete = await requireSociete();
  const isAdmin = await isAdminSession();
  const userId = await getUserId();

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.scanIds) || body.scanIds.length === 0 || typeof body.finalType !== "string") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const scanIds = [...new Set((body.scanIds as unknown[]).filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))];
  const orderedIds = Array.isArray(body.orderedIds)
    ? (body.orderedIds as unknown[]).filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : scanIds;
  const finalType = body.finalType as string;
  const fields = (body.fields ?? {}) as DocumentFields;
  const visibleClient = body.visibleClient === true;
  const manualClassificationNote = typeof body.manualClassificationNote === "string" ? body.manualClassificationNote : null;

  const scans = await prisma.emailScan.findMany({
    where: { id: { in: scanIds }, ...(await getVisibleSocieteFilter()) },
    orderBy: { createdAt: "asc" },
  });
  if (scans.length === 0) {
    return NextResponse.json({ error: "Aucun scan sélectionné." }, { status: 404 });
  }

  const bundles = groupScansByBundle(scans);
  const selected = bundles.flatMap((bundle) => bundle.scans);
  const selectedById = new Map(selected.map((scan) => [scan.id, scan]));
  const sortedScans = orderedIds
    .map((id) => selectedById.get(id))
    .filter((scan): scan is NonNullable<typeof scan> => !!scan)
    .concat(selected.filter((scan) => !orderedIds.includes(scan.id)));

  const sourceScans = sortScansByPart(sortedScans.length > 0 ? sortedScans : selected);
  const sourceScan = sourceScans[0];
  if (!sourceScan) {
    return NextResponse.json({ error: "Aucun scan sélectionné." }, { status: 404 });
  }

  const mergedPdf = sourceScans.every((scan) => scan.fileMime === "application/pdf") && sourceScans.length > 1
    ? await mergePdfBuffers(sourceScans.map((scan) => Buffer.from(scan.fileData)))
    : Buffer.from(sourceScan.fileData);

  const targetSociete = isAdmin && typeof body.societe === "string" && body.societe.trim()
    ? body.societe.trim()
    : ownerSociete;
  if (isAdmin && targetSociete !== ownerSociete) {
    const exists = await prisma.societe.findUnique({ where: { nom: targetSociete } });
    if (!exists) return NextResponse.json({ error: "Société introuvable." }, { status: 400 });
  }

  try {
    const result = await commitDocumentAnalysis(sourceScan.id, ownerSociete, {
      scanIds,
      finalType,
      fields,
      duplicate: null,
      duplicateAction: "creer_quand_meme",
      targetSociete,
      visibleClient,
      source: {
        fileName: sourceScans.length > 1 ? sourceScans[0].fileName.replace(/_part-\d+-sur-\d+(_p\d+(?:-\d+)?)?(?=\.[^.]+$|$)/i, "") : sourceScan.fileName,
        fileMime: sourceScan.fileMime,
        fileSize: mergedPdf.length,
        fileData: mergedPdf,
        receivedAt: sourceScan.receivedAt,
        ocrText: sourceScan.ocrText,
      },
      manualClassifiedByUserId: userId,
      manualClassificationNote,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du classement manuel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
