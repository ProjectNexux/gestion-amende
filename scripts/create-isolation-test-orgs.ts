// Isolation test fixtures (2026-09-24) — creates ORGANISATION TEST A / B, each with an admin
// user, 2 client companies, 1 document (Courrier), 1 contravention. Idempotent: safe to re-run.
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { generatePlaceholderCodeAcces, generateSetupToken, setupTokenExpiryDate } from "../src/lib/societe-setup";

async function ensureOrg(name: string, slug: string) {
  return prisma.organization.upsert({ where: { slug }, update: {}, create: { name, slug, contactEmail: `${slug}@test.local` } });
}

async function ensureHomeSociete(orgId: string, nom: string) {
  const existing = await prisma.societe.findUnique({ where: { nom } });
  if (existing) {
    if (existing.organizationId !== orgId || !existing.isOrganizationHome) {
      await prisma.societe.update({ where: { id: existing.id }, data: { organizationId: orgId, isOrganizationHome: true } });
    }
    return existing;
  }
  return prisma.societe.create({
    data: { nom, organizationId: orgId, isOrganizationHome: true, codeAcces: generatePlaceholderCodeAcces(), codeAccesSetupToken: generateSetupToken(), codeAccesSetupExpiresAt: setupTokenExpiryDate() },
  });
}

async function ensureClientSociete(orgId: string, nom: string, codeAcces: string) {
  const existing = await prisma.societe.findUnique({ where: { nom } });
  if (existing) {
    if (existing.organizationId !== orgId) await prisma.societe.update({ where: { id: existing.id }, data: { organizationId: orgId } });
    return existing;
  }
  return prisma.societe.create({ data: { nom, organizationId: orgId, codeAcces } });
}

async function ensureAdminUser(homeSocieteId: string, email: string, prenom: string, nom: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { societeId: homeSocieteId, prenom, nom, email, role: "admin", isActive: true, passwordHash: hashPassword(password) },
  });
}

async function setup(label: string, slug: string, ownerEmail: string, password: string, clientNames: [string, string], docNumDossier: string) {
  const org = await ensureOrg(label, slug);
  const home = await ensureHomeSociete(org.id, `${label} — Espace`);
  const user = await ensureAdminUser(home.id, ownerEmail, "Test", "Admin", password);
  await prisma.organizationMember.upsert({ where: { userId: user.id }, update: { organizationId: org.id }, create: { organizationId: org.id, userId: user.id, orgRole: "owner" } });

  const clientA = await ensureClientSociete(org.id, clientNames[0], `${slug}-client1-2026`);
  const clientB = await ensureClientSociete(org.id, clientNames[1], `${slug}-client2-2026`);

  const existingCourrier = await prisma.courrier.findFirst({ where: { societe: clientA.nom, type: "pub", fileName: `${slug}-doc.pdf` } });
  if (!existingCourrier) {
    await prisma.courrier.create({
      data: {
        societe: clientA.nom,
        type: "pub",
        data: { expediteur: `Document isolation ${label}` },
        fileName: `${slug}-doc.pdf`,
        fileMime: "application/pdf",
        fileSize: 10,
        fileData: Buffer.from(`fake-pdf-${slug}`),
      },
    });
  }

  const existingContravention = await prisma.contravention.findFirst({ where: { societe: clientA.nom, numDossier: docNumDossier } });
  if (!existingContravention) {
    await prisma.contravention.create({
      data: {
        societe: clientA.nom,
        numDossier: docNumDossier,
        natureInfraction: `Test isolation ${label}`,
        montantAmende: 45,
        dateInfraction: "01/01/2026",
        dateLimitePaiement: "01/03/2026",
      },
    });
  }

  return { org, home, user, clientA, clientB };
}

async function main() {
  const before = {
    organizations: await prisma.organization.count(),
    societes: await prisma.societe.count(),
    users: await prisma.user.count(),
    contraventions: await prisma.contravention.count(),
    courriers: await prisma.courrier.count(),
  };
  console.log("AVANT:", JSON.stringify(before, null, 2));

  const a = await setup("ORGANISATION TEST A", "org-test-a", "scanappamendes+orgtesta@gmail.com", "OrgTestA2026!", ["ORG A CLIENT UN", "ORG A CLIENT DEUX"], "PV-ORGTESTA-001");
  const b = await setup("ORGANISATION TEST B", "org-test-b", "scanappamendes+orgtestb@gmail.com", "OrgTestB2026!", ["ORG B CLIENT UN", "ORG B CLIENT DEUX"], "PV-ORGTESTB-001");

  const after = {
    organizations: await prisma.organization.count(),
    societes: await prisma.societe.count(),
    users: await prisma.user.count(),
    contraventions: await prisma.contravention.count(),
    courriers: await prisma.courrier.count(),
  };
  console.log("APRÈS:", JSON.stringify(after, null, 2));

  console.log("ORG A:", JSON.stringify({ orgId: a.org.id, home: a.home.nom, admin: a.user.email, clientA: a.clientA.nom, clientB: a.clientB.nom }, null, 2));
  console.log("ORG B:", JSON.stringify({ orgId: b.org.id, home: b.home.nom, admin: b.user.email, clientA: b.clientA.nom, clientB: b.clientB.nom }, null, 2));
}

main().finally(() => prisma.$disconnect());
