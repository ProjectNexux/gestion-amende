import { NextRequest, NextResponse } from "next/server";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { buildPreview, VehiculeImportField } from "@/lib/vehicule-import";

export const dynamic = "force-dynamic";

type Override = { societe?: string | null; conducteurId?: string | null; skip?: boolean };

async function nextCodeGenerator(societe: string) {
  const last = await prisma.vehicule.findFirst({ where: { societe }, orderBy: { code: "desc" } });
  let n = 1;
  if (last) {
    const m = last.code.match(/(\d+)/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return () => `VEH${String(n++).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.headers) || !Array.isArray(body.rows) || !body.mapping) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const duplicateStrategy: "ignore" | "update" = body.duplicateStrategy === "update" ? "update" : "ignore";
  const overrides = (body.overrides ?? {}) as Record<string, Override>;

  const mapping = body.mapping as Record<string, VehiculeImportField | null>;
  const mappingByIndex: Record<number, VehiculeImportField | null> = {};
  Object.entries(mapping).forEach(([k, v]) => { mappingByIndex[Number(k)] = v; });

  // Recompute the authoritative preview server-side — never trust client-side row statuses.
  const { rows: preview } = await buildPreview({
    headers: body.headers,
    rows: body.rows,
    mapping: mappingByIndex,
    sessionSociete: societe,
    isAdmin,
  });

  let created = 0;
  let updated = 0;
  let skippedDuplicates = 0;
  const rejected: { index: number; reason: string }[] = [];

  const codeGenerators = new Map<string, () => string>();
  async function nextCodeFor(s: string) {
    let gen = codeGenerators.get(s);
    if (!gen) {
      gen = await nextCodeGenerator(s);
      codeGenerators.set(s, gen);
    }
    return gen();
  }

  // Each row is written with its own independent prisma call so one bad row can never roll back
  // the others — only a real transaction (all-or-nothing) would need $transaction here.
  for (const row of preview) {
    const override = overrides[String(row.index)] ?? {};
    if (override.skip) {
      rejected.push({ index: row.index, reason: "Ignorée manuellement" });
      continue;
    }

    let targetSociete = row.societeResolved;
    if (isAdmin && override.societe) targetSociete = override.societe;
    if (!targetSociete) {
      rejected.push({ index: row.index, reason: row.societeStatus === "unverified" ? `Société non résolue ("${row.societeInput}")` : "Société manquante" });
      continue;
    }
    if (!row.data.immatriculation) {
      rejected.push({ index: row.index, reason: "Immatriculation manquante" });
      continue;
    }

    const conducteurAttitre = override.conducteurId !== undefined ? override.conducteurId : row.conducteurResolvedId;

    // Re-check duplicate against the (possibly overridden) société, since an admin can reassign it.
    const existing = await prisma.vehicule.findFirst({ where: { societe: targetSociete, immatriculation: row.data.immatriculation } });

    try {
      if (existing) {
        if (duplicateStrategy === "ignore") {
          skippedDuplicates++;
          continue;
        }
        await prisma.vehicule.update({
          where: { id: existing.id },
          data: {
            marque: row.data.marque ?? existing.marque,
            modele: row.data.modele ?? existing.modele,
            typeVehicule: row.data.typeVehicule ?? existing.typeVehicule,
            datePremiereImmat: row.data.datePremiereImmat ?? existing.datePremiereImmat,
            dateAcquisition: row.data.dateAcquisition ?? existing.dateAcquisition,
            numCarteGrise: row.data.numCarteGrise ?? existing.numCarteGrise,
            ptac: row.data.ptac ? parseInt(row.data.ptac, 10) : existing.ptac,
            service: row.data.service ?? existing.service,
            statut: row.data.statut ?? existing.statut,
            dateControleTech: row.data.dateControleTech ?? existing.dateControleTech,
            assuranceNum: row.data.assuranceNum ?? existing.assuranceNum,
            observations: row.data.observations ?? existing.observations,
            conducteurAttitre: conducteurAttitre ?? existing.conducteurAttitre,
          },
        });
        updated++;
      } else {
        const code = row.data.code ?? (await nextCodeFor(targetSociete));
        await prisma.vehicule.create({
          data: {
            societe: targetSociete,
            code,
            immatriculation: row.data.immatriculation,
            marque: row.data.marque ?? null,
            modele: row.data.modele ?? null,
            typeVehicule: row.data.typeVehicule ?? null,
            datePremiereImmat: row.data.datePremiereImmat ?? null,
            dateAcquisition: row.data.dateAcquisition ?? null,
            numCarteGrise: row.data.numCarteGrise ?? null,
            ptac: row.data.ptac ? parseInt(row.data.ptac, 10) : null,
            service: row.data.service ?? null,
            statut: row.data.statut ?? "En service",
            dateControleTech: row.data.dateControleTech ?? null,
            assuranceNum: row.data.assuranceNum ?? null,
            observations: row.data.observations ?? null,
            conducteurAttitre: conducteurAttitre ?? null,
          },
        });
        created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      rejected.push({ index: row.index, reason: message });
    }
  }

  revalidatePath("/vehicules");

  return NextResponse.json({
    created,
    updated,
    skippedDuplicates,
    rejected,
    total: preview.length,
  });
}
