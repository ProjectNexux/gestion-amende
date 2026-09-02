import { requireSociete } from "@/lib/auth";
import { buildImportTemplate } from "@/lib/vehicule-import";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireSociete();
  const buf = await buildImportTemplate();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modele_import_vehicules.xlsx"`,
    },
  });
}
