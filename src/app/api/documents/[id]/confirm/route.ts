import { NextRequest, NextResponse } from "next/server";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commitDocumentAnalysis, type DocumentFields, type DuplicateAction, type DuplicateMatch } from "@/lib/document-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const { id } = await params;

  let scan;
  try {
    scan = await prisma.emailScan.findFirst({ where: isAdmin ? { id } : { id, societe } });
  } catch {
    // Most likely a transient DB connectivity issue — surfaced as a clean JSON error instead of
    // letting Next's default error page (non-JSON) reach the client and break res.json().
    return NextResponse.json({ error: "Impossible de contacter la base de données. Réessayez dans quelques instants." }, { status: 503 });
  }
  if (!scan) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  if (scan.status === "created") return NextResponse.json({ error: "Ce document a déjà été enregistré." }, { status: 409 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.finalType !== "string") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const finalType = body.finalType as string;
  const fields = (body.fields ?? {}) as DocumentFields;
  const duplicate = (body.duplicate ?? null) as DuplicateMatch;
  const duplicateAction: DuplicateAction = body.duplicateAction === "rattacher" || body.duplicateAction === "ignorer" ? body.duplicateAction : "creer_quand_meme";

  // "Envoyer vers l'espace client" (2026-09-01): only an admin can redirect a document to a
  // DIFFERENT société than the one that uploaded it — never trust the requested société blindly,
  // always re-validate it exists (never auto-created from a client-supplied string).
  let targetSociete: string | undefined;
  if (isAdmin && typeof body.societe === "string" && body.societe.trim()) {
    const requested = await prisma.societe.findUnique({ where: { nom: body.societe.trim() } });
    if (!requested) return NextResponse.json({ error: "Société introuvable." }, { status: 400 });
    targetSociete = requested.nom;
  }
  const visibleClient = isAdmin ? body.visibleClient === true : false;

  try {
    const result = await commitDocumentAnalysis(scan.id, scan.societe, { finalType, fields, duplicate, duplicateAction, targetSociete, visibleClient });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
