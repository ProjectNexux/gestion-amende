import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSociete, getUserId, isAdminSession } from "@/lib/auth";
import { serverOcr } from "@/lib/server-ocr";
import { analyzeDocumentText, findPotentialDuplicate, fileHash, RECLASS_OPTIONS } from "@/lib/document-import";

export const dynamic = "force-dynamic";

const ACCEPTED_MIMES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 200);
}

export async function POST(req: NextRequest) {
  const societe = await requireSociete();
  const userId = await getUserId();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  let mime = file.type;
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!ACCEPTED_MIMES.has(mime)) {
    return NextResponse.json({ error: "Format non pris en charge. Utilisez PDF, JPG ou PNG." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `Le fichier dépasse ${MAX_FILE_SIZE / (1024 * 1024)} Mo.` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = fileHash(buffer);

  let scan;
  try {
    // Duplicate signal #1 (cheapest, checked first — see spec §13): identical file already imported.
    const existingByHash = await prisma.emailScan.findFirst({ where: { fileHash: hash } });
    if (existingByHash) {
      return NextResponse.json({
        duplicateFile: true,
        existingScan: {
          id: existingByHash.id,
          fileName: existingByHash.fileName,
          status: existingByHash.status,
          contraventionId: existingByHash.contraventionId,
          courrierId: existingByHash.courrierId,
          receivedAt: existingByHash.receivedAt,
        },
      });
    }

    scan = await prisma.emailScan.create({
      data: {
        societe,
        messageId: `manual-${hash.slice(0, 16)}-${Date.now()}`,
        fileName: sanitizeFilename(file.name || "document"),
        fileHash: hash,
        fileMime: mime,
        fileSize: file.size,
        fileData: buffer,
        status: "processing",
        origine: "manuel",
        importedByUserId: userId,
      },
    });
  } catch {
    // Most likely a transient DB connectivity issue — surfaced as a clean JSON error instead of
    // letting Next's default error page (non-JSON) reach the client and break res.json().
    return NextResponse.json({ error: "Impossible de contacter la base de données. Réessayez dans quelques instants." }, { status: 503 });
  }

  try {
    const ocrText = await serverOcr(buffer, mime);

    if (!ocrText || ocrText.replace(/\s/g, "").length < 10) {
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: "error", errorMessage: "Texte extrait insuffisant malgré OCR. Document illisible ou vide.", ocrText: ocrText || null, processedAt: new Date() },
      });
      return NextResponse.json({ id: scan.id, status: "error", error: "Document illisible ou vide malgré l'OCR." }, { status: 200 });
    }

    const knownPlates = await prisma.vehicule.findMany({ where: { societe }, select: { immatriculation: true } }).then((vs) => vs.map((v) => v.immatriculation));
    const analysis = analyzeDocumentText(ocrText, societe, knownPlates);
    const duplicate = await findPotentialDuplicate(analysis, societe);

    await prisma.emailScan.update({
      where: { id: scan.id },
      data: { status: "analyzed", ocrText, parsedData: JSON.stringify({ analysis, duplicate }), processedAt: new Date() },
    });

    // Sociétés list only needed by admins (2026-09-01, "envoyer vers l'espace client" feature) —
    // lets the review step offer a target-société picker so the record can be filed directly
    // under the concerned client's société instead of always staying under the admin's own.
    const isAdmin = await isAdminSession();
    const societes = isAdmin ? (await prisma.societe.findMany({ select: { nom: true }, orderBy: { nom: "asc" } })).map((s) => s.nom) : [];

    return NextResponse.json({
      id: scan.id,
      status: "analyzed",
      fileName: scan.fileName,
      fileMime: scan.fileMime,
      fileSize: scan.fileSize,
      analysis,
      duplicate,
      reclassOptions: RECLASS_OPTIONS,
      societes,
      defaultSociete: societe,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur d'analyse inconnue.";
    await prisma.emailScan.update({ where: { id: scan.id }, data: { status: "error", errorMessage: message, processedAt: new Date() } });
    // The document is never lost: the EmailScan row (with its original file) stays in DB as
    // "error" even though analysis failed — see spec §15.
    return NextResponse.json({ id: scan.id, status: "error", error: message }, { status: 200 });
  }
}
