import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSocieteVisible } from "@/lib/org-scope";

/** Admin-only — active individual users of a société, for the "Transmettre au client" recipient
 * picker. Only accounts with a real e-mail and `isActive` are returned (disabled accounts are
 * never selectable, per spec — they're simply not listed). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nom: string }> }) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { nom } = await params;
  const decodedNom = decodeURIComponent(nom);
  if (!(await isSocieteVisible(decodedNom))) return NextResponse.json([], { headers: { "Cache-Control": "private, no-store" } });
  const societe = await prisma.societe.findUnique({ where: { nom: decodedNom } });
  if (!societe) return NextResponse.json([], { headers: { "Cache-Control": "private, no-store" } });

  const users = await prisma.user.findMany({
    where: { societeId: societe.id, isActive: true, email: { not: null } },
    orderBy: [{ isPrincipal: "desc" }, { createdAt: "asc" }],
    select: { id: true, prenom: true, nom: true, email: true, isPrincipal: true },
  });

  return NextResponse.json(users, { headers: { "Cache-Control": "private, no-store" } });
}
