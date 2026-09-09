import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { isValidSiret, normalizeSiret } from "@/lib/siret";
import { lookupCompanyBySiret } from "@/lib/company-lookup";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy so the Ajouter un client wizard doesn't have to hit the public API directly
 * (avoids browser CORS, keeps rate-limit under a single origin, and lets the whole endpoint be
 * gated by `isAdminSession()` — a client role can never scrape SIREN data through the app).
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.siret === "string" ? body.siret : "";
  if (!raw.trim()) return NextResponse.json({ error: "Merci de saisir un SIRET." }, { status: 400 });

  const siret = normalizeSiret(raw);
  if (!isValidSiret(siret)) {
    return NextResponse.json({ error: "Le SIRET doit contenir exactement 14 chiffres." }, { status: 400 });
  }

  try {
    const result = await lookupCompanyBySiret(siret);
    if (!result) {
      return NextResponse.json({ error: "Aucune entreprise trouvée avec ce SIRET. Vérifiez le numéro saisi." }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "La recherche automatique est temporairement indisponible.";
    return NextResponse.json({ error: message, retryable: true }, { status: 503 });
  }
}
