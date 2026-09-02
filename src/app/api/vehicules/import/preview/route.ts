import { NextRequest, NextResponse } from "next/server";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { buildPreview, VehiculeImportField } from "@/lib/vehicule-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.headers) || !Array.isArray(body.rows) || !body.mapping) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const mapping = body.mapping as Record<string, VehiculeImportField | null>;
  const mappingByIndex: Record<number, VehiculeImportField | null> = {};
  Object.entries(mapping).forEach(([k, v]) => { mappingByIndex[Number(k)] = v; });

  const preview = await buildPreview({
    headers: body.headers,
    rows: body.rows,
    mapping: mappingByIndex,
    sessionSociete: societe,
    isAdmin,
  });

  return NextResponse.json({
    previewRows: preview.rows,
    summary: preview.summary,
    availableSocietes: preview.availableSocietes,
    conducteursBySociete: preview.conducteursBySociete,
  });
}
