import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

/**
 * Espace client — real, data-derived notifications only (never fabricated), strictly scoped to
 * the connected société. Three sources: newly shared contraventions/courriers (last 3 days) and
 * upcoming payment deadlines (next 5 days, unpaid).
 */
export async function GET() {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [nouvellesContraventions, nouveauxCourriers, contraventions] = await Promise.all([
    prisma.contravention.findMany({
      where: { societe, visibleClient: true, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: { id: true, numDossier: true, createdAt: true },
      take: 10,
    }),
    prisma.courrier.findMany({
      where: { societe, visibleClient: true, type: { not: "client_envoi" }, receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
      select: { id: true, fileName: true, type: true, receivedAt: true },
      take: 10,
    }),
    prisma.contravention.findMany({
      where: { societe, visibleClient: true, statutPaiement: { not: "Payé" } },
      select: { id: true, numDossier: true, dateLimitePaiement: true },
    }),
  ]);

  const echeancesProches = contraventions
    .map((c) => ({ c, date: parseFrDate(c.dateLimitePaiement) }))
    .filter((x): x is { c: (typeof contraventions)[number]; date: Date } => {
      if (!x.date) return false;
      const daysLeft = (x.date.getTime() - Date.now()) / 86400000;
      return daysLeft >= 0 && daysLeft <= 5;
    });

  const notifications = [
    ...nouvellesContraventions.map((c) => ({
      id: `contravention-${c.id}`,
      type: "contravention" as const,
      label: `Nouvelle contravention partagée : ${c.numDossier}`,
      date: c.createdAt,
      href: `/client/contraventions/${c.id}`,
    })),
    ...nouveauxCourriers.map((c) => ({
      id: `courrier-${c.id}`,
      type: "courrier" as const,
      label: `Nouveau courrier reçu : ${c.fileName}`,
      date: c.receivedAt,
      href: `/client/courriers`,
    })),
    ...echeancesProches.map(({ c, date }) => ({
      id: `echeance-${c.id}`,
      type: "echeance" as const,
      label: `Échéance proche : ${c.numDossier} (${date.toLocaleDateString("fr-FR")})`,
      date,
      href: `/client/contraventions/${c.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return NextResponse.json({ notifications });
}
