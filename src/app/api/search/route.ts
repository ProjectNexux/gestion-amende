import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import {
  courrierTypeLabel,
  getMiseEnDemeureData,
  getRetardPaiementData,
  getPubData,
  getImmatriculation,
} from "@/lib/courriers";
import { getFactureData, getImpotData } from "@/lib/comptabilite";

export const dynamic = "force-dynamic";

export type SearchResultItem = { id: string; label: string; sublabel: string; href: string };
export type SearchResultGroup = { category: string; items: SearchResultItem[] };

const COURRIER_DETAIL_PATH: Record<string, (id: string) => string> = {
  certificat_immatriculation: (id) => `/courriers/certificats-immatriculation/${id}`,
  mise_en_demeure: (id) => `/courriers/mise-en-demeure/${id}`,
  retard_paiement: (id) => `/courriers/retards-paiement/${id}`,
  pub: () => `/courriers/pub`,
  facture: (id) => `/comptabilite/factures/${id}`,
  impot: (id) => `/comptabilite/impots/${id}`,
};

// Best-effort "what actually matched" hint per Courrier type, reusing the same typed accessors as
// the rest of the app (never invents a value — falls back to the type label if nothing fits).
function courrierHint(type: string, data: unknown): string | null {
  if (type === "mise_en_demeure") {
    const d = getMiseEnDemeureData(data);
    return d.motif ?? d.expediteur ?? d.destinataire ?? null;
  }
  if (type === "retard_paiement") {
    const d = getRetardPaiementData(data);
    return d.debiteur ?? d.reference ?? null;
  }
  if (type === "facture") {
    const d = getFactureData(data);
    return d.emetteur ?? d.reference ?? null;
  }
  if (type === "impot") {
    const d = getImpotData(data);
    return d.organisme ?? d.typeDocument ?? null;
  }
  if (type === "pub") {
    return getPubData(data).expediteur ?? null;
  }
  if (type === "certificat_immatriculation") {
    return getImmatriculation(data) || null;
  }
  return null;
}

const LIMIT = 6;

type CourrierRow = { id: string; societe: string; type: string; fileName: string; data: unknown };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const tenant = isAdmin ? {} : { societe };
  const insensitive = { contains: q, mode: "insensitive" as const };
  const likeQ = `%${q}%`;

  const [contraventions, vehicules, conducteurs, sinistres, courriers] = await Promise.all([
    prisma.contravention.findMany({
      where: {
        ...tenant,
        OR: [
          { numDossier: insensitive },
          { numAvis: insensitive },
          { natureInfraction: insensitive },
          { lieuInfraction: insensitive },
          { immatriculationOcr: insensitive },
          { observations: insensitive },
          { societe: insensitive },
          { vehicule: { is: { OR: [{ immatriculation: insensitive }, { marque: insensitive }, { modele: insensitive }, { code: insensitive }] } } },
          { conducteur: { is: { OR: [{ nom: insensitive }, { prenom: insensitive }, { code: insensitive }] } } },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicule.findMany({
      where: {
        ...tenant,
        OR: [
          { code: insensitive },
          { immatriculation: insensitive },
          { marque: insensitive },
          { modele: insensitive },
          { typeVehicule: insensitive },
          { service: insensitive },
          { numCarteGrise: insensitive },
          { observations: insensitive },
          { societe: insensitive },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.conducteur.findMany({
      where: {
        ...tenant,
        OR: [
          { code: insensitive },
          { nom: insensitive },
          { prenom: insensitive },
          { email: insensitive },
          { telephone: insensitive },
          { adresse: insensitive },
          { ville: insensitive },
          { numPermis: insensitive },
          { numCarteIdentite: insensitive },
          { societe: insensitive },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.sinistre.findMany({
      where: {
        ...tenant,
        OR: [
          { reference: insensitive },
          { expediteur: insensitive },
          { destinataire: insensitive },
          { referenceAssureur: insensitive },
          { numeroContrat: insensitive },
          { assureur: insensitive },
          { description: insensitive },
          { circonstances: insensitive },
          { lieuSinistre: insensitive },
          { expert: insensitive },
          { garage: insensitive },
          { tiers: insensitive },
          { avocat: insensitive },
          { immatriculationOcr: insensitive },
          { societe: insensitive },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    // Courrier's type-specific fields live in a JSON `data` column (different shape per type), so a
    // plain Prisma `contains` can't scan across all of them at once — cast to text and ILIKE instead.
    // Still a safe, parameterized query (tagged template), and still tenant-scoped for non-admins.
    isAdmin
      ? prisma.$queryRaw<CourrierRow[]>`
          SELECT id, societe, type, "fileName", data
          FROM "Courrier"
          WHERE "fileName" ILIKE ${likeQ} OR societe ILIKE ${likeQ} OR data::text ILIKE ${likeQ}
          ORDER BY "receivedAt" DESC
          LIMIT ${LIMIT}
        `
      : prisma.$queryRaw<CourrierRow[]>`
          SELECT id, societe, type, "fileName", data
          FROM "Courrier"
          WHERE societe = ${societe} AND ("fileName" ILIKE ${likeQ} OR data::text ILIKE ${likeQ})
          ORDER BY "receivedAt" DESC
          LIMIT ${LIMIT}
        `,
  ]);

  const groups: SearchResultGroup[] = [];

  if (contraventions.length) {
    groups.push({
      category: "Contraventions",
      items: contraventions.map((c) => ({
        id: c.id,
        label: c.numDossier,
        sublabel: [c.natureInfraction, c.societe].filter(Boolean).join(" — "),
        href: `/contraventions/${c.id}`,
      })),
    });
  }

  if (vehicules.length) {
    groups.push({
      category: "Véhicules",
      items: vehicules.map((v) => ({
        id: v.id,
        label: `${v.immatriculation} — ${v.code}`,
        sublabel: [v.marque, v.modele, v.societe].filter(Boolean).join(" — "),
        href: `/vehicules/${v.id}`,
      })),
    });
  }

  if (conducteurs.length) {
    groups.push({
      category: "Conducteurs",
      items: conducteurs.map((c) => ({
        id: c.id,
        label: `${c.prenom} ${c.nom}`,
        sublabel: [c.code, c.societe].filter(Boolean).join(" — "),
        href: `/conducteurs/${c.id}`,
      })),
    });
  }

  if (sinistres.length) {
    groups.push({
      category: "Sinistres",
      items: sinistres.map((s) => ({
        id: s.id,
        label: s.reference,
        sublabel: [s.expediteur, s.societe].filter(Boolean).join(" — "),
        href: `/courriers/sinistres/${s.id}`,
      })),
    });
  }

  if (courriers.length) {
    groups.push({
      category: "Courriers",
      items: courriers.map((c) => ({
        id: c.id,
        label: c.fileName,
        sublabel: [courrierTypeLabel(c.type), courrierHint(c.type, c.data), c.societe].filter(Boolean).join(" — "),
        href: (COURRIER_DETAIL_PATH[c.type] ?? (() => "/courriers"))(c.id),
      })),
    });
  }

  return NextResponse.json({ groups });
}
