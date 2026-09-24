// Migration additive et réversible (2026-09-24) : crée l'organisation "NetEco" et y rattache
// TOUTES les sociétés existantes (aucune n'est supprimée/vidée/recréée) + le(s) User admin
// existant(s). Idempotent : peut être relancé sans effet si NetEco existe déjà.
import { prisma } from "../src/lib/prisma";

const ADMIN_SOCIETE = process.env.ADMIN_SOCIETE ?? "Mon espace";

async function main() {
  const before = {
    societes: await prisma.societe.count(),
    users: await prisma.user.count(),
    contraventions: await prisma.contravention.count(),
    courriers: await prisma.courrier.count(),
    vehicules: await prisma.vehicule.count(),
    conducteurs: await prisma.conducteur.count(),
    scans: await prisma.emailScan.count(),
    favoris: await prisma.favori.count(),
    sinistres: await prisma.sinistre.count(),
  };
  console.log("AVANT:", JSON.stringify(before, null, 2));

  const org = await prisma.organization.upsert({
    where: { slug: "neteco" },
    update: {},
    create: { name: "NetEco", slug: "neteco" },
  });
  console.log(`Organization NetEco: ${org.id}`);

  // Rattache TOUTES les sociétés existantes à NetEco (aujourd'hui il n'existe qu'une seule
  // organisation, donc tout ce qui existe déjà lui appartient) — met à jour, ne supprime rien.
  const societes = await prisma.societe.findMany({ where: { organizationId: null } });
  for (const s of societes) {
    await prisma.societe.update({
      where: { id: s.id },
      data: { organizationId: org.id, isOrganizationHome: s.nom === ADMIN_SOCIETE },
    });
  }
  console.log(`Sociétés rattachées à NetEco: ${societes.length}`);

  const homeCount = await prisma.societe.count({ where: { organizationId: org.id, isOrganizationHome: true } });
  if (homeCount !== 1) {
    console.warn(`ATTENTION: ${homeCount} société(s) "maison" trouvée(s) pour NetEco (attendu: 1, ADMIN_SOCIETE="${ADMIN_SOCIETE}")`);
  }

  // Rattache les User admin existants comme membres de l'organisation — le plus ancien devient
  // "owner", les suivants (s'il y en a) "admin".
  const adminUsers = await prisma.user.findMany({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  for (let i = 0; i < adminUsers.length; i++) {
    const u = adminUsers[i];
    await prisma.organizationMember.upsert({
      where: { userId: u.id },
      update: {},
      create: { organizationId: org.id, userId: u.id, orgRole: i === 0 ? "owner" : "admin" },
    });
  }
  console.log(`Membres gestionnaires rattachés: ${adminUsers.length}`);

  const after = {
    societes: await prisma.societe.count(),
    users: await prisma.user.count(),
    contraventions: await prisma.contravention.count(),
    courriers: await prisma.courrier.count(),
    vehicules: await prisma.vehicule.count(),
    conducteurs: await prisma.conducteur.count(),
    scans: await prisma.emailScan.count(),
    favoris: await prisma.favori.count(),
    sinistres: await prisma.sinistre.count(),
  };
  console.log("APRÈS:", JSON.stringify(after, null, 2));

  const identical = Object.keys(before).every((k) => (before as Record<string, number>)[k] === (after as Record<string, number>)[k]);
  console.log(identical ? "✓ Volumes identiques avant/après (aucune donnée perdue)." : "✗ ATTENTION: volumes différents !");
}

main().finally(() => prisma.$disconnect());
