import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete, isAdminSession } from "@/lib/auth";

export async function GET() {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const isAdmin = await isAdminSession();

  const scans = await prisma.emailScan.findMany({
    where: isAdmin ? {} : { societe },
    select: {
      id: true,
      societe: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      fromAddress: true,
      subject: true,
      status: true,
      errorMessage: true,
      contraventionId: true,
      parsedData: true,
      receivedAt: true,
      processedAt: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(scans);
}
