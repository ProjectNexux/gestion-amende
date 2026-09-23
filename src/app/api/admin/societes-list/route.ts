import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_SOCIETE = process.env.ADMIN_SOCIETE ?? "Mon espace";

/** Admin-only société picker list, used by the "Transmettre au client" modal. */
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const societes = await prisma.societe.findMany({
    where: { nom: { not: ADMIN_SOCIETE }, archivedAt: null },
    orderBy: { nom: "asc" },
    select: { nom: true },
  });

  return NextResponse.json(societes.map((s) => s.nom), { headers: { "Cache-Control": "private, no-store" } });
}
