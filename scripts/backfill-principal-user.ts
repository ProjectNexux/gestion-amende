import { prisma } from "../src/lib/prisma";

/**
 * One-off backfill (2026-09-23): "rattacher correctement l'ancien contact principal" — for every
 * société that has at least one User row but none marked isPrincipal yet, mark its oldest user as
 * principal. Purely additive (never touches passwordHash/email/documents).
 */
async function main() {
  const societes = await prisma.societe.findMany({
    where: { users: { some: { isPrincipal: false } }, NOT: { users: { some: { isPrincipal: true } } } },
    select: { id: true, nom: true, users: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } } },
  });

  let updated = 0;
  for (const s of societes) {
    const oldest = s.users[0];
    if (!oldest) continue;
    await prisma.user.update({ where: { id: oldest.id }, data: { isPrincipal: true } });
    updated++;
  }
  console.log(`Backfilled isPrincipal for ${updated} société(s).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
