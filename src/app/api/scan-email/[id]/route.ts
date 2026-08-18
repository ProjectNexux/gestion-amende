import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete, isAdminSession } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const isAdmin = await isAdminSession();

  const scan = await prisma.emailScan.findUnique({
    where: { id },
    select: { societe: true, fileName: true, fileMime: true, fileData: true },
  });
  if (!scan || (!isAdmin && scan.societe !== societe)) {
    return NextResponse.json({ error: "Scan introuvable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(scan.fileData), {
    headers: {
      "Content-Type": scan.fileMime,
      "Content-Disposition": `inline; filename="${scan.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const isAdmin = await isAdminSession();

  const scan = await prisma.emailScan.findUnique({ where: { id }, select: { id: true, societe: true } });
  if (!scan || (!isAdmin && scan.societe !== societe)) {
    return NextResponse.json({ error: "Scan introuvable" }, { status: 404 });
  }

  // Only the received scan (and its file) is deleted — any contravention
  // already created from it is a separate record and is left untouched.
  await prisma.emailScan.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
