import { NextRequest, NextResponse } from "next/server";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { autoMapHeaders, buildPreview, parseUploadedFile } from "@/lib/vehicule-import";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Le fichier dépasse 10 Mo." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseUploadedFile(buffer, file.name);
    if (rows.length > 5000) {
      return NextResponse.json({ error: "Le fichier contient trop de lignes (max 5000)." }, { status: 400 });
    }
    const mapping = autoMapHeaders(headers);
    const preview = await buildPreview({ headers, rows, mapping, sessionSociete: societe, isAdmin });

    return NextResponse.json({
      headers,
      rows,
      mapping,
      previewRows: preview.rows,
      summary: preview.summary,
      availableSocietes: preview.availableSocietes,
      conducteursBySociete: preview.conducteursBySociete,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fichier illisible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
