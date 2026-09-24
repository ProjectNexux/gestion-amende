import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleSocieteNames } from "@/lib/org-scope";

/** Admin-only société picker list, used by the "Transmettre au client" modal. */
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const names = await getVisibleSocieteNames();
  const societes = await prisma.societe.findMany({
    where: { isOrganizationHome: false, archivedAt: null, ...(names === "all-own-societe" ? {} : { nom: { in: names } }) },
    orderBy: { nom: "asc" },
    select: { nom: true },
  });

  return NextResponse.json(societes.map((s) => s.nom), { headers: { "Cache-Control": "private, no-store" } });
}
