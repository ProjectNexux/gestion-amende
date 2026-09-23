import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSociete, isAdminSession } from "@/lib/auth";
import { getScanPartInfo, groupScansByBundle } from "@/lib/scan-bundles";

export async function GET() {
  const societe = await getSociete();
  if (!societe) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const isAdmin = await isAdminSession();

  const scans = await prisma.emailScan.findMany({
    where: isAdmin ? {} : { societe },
    select: {
      id: true,
      messageId: true,
      societe: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      fromAddress: true,
      subject: true,
      status: true,
      errorMessage: true,
      contraventionId: true,
      courrierId: true,
      parsedData: true,
      receivedAt: true,
      processedAt: true,
      updatedAt: true,
      origine: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  const groupedScans = groupScansByBundle(scans);
  const rows = groupedScans.map((group) => {
    const bundleScans = group.scans;
    const statuses = new Set(bundleScans.map((scan) => scan.status));
    const partInfo = getScanPartInfo(bundleScans[0]);
    const bundleStatus = group.partTotal > 1 && bundleScans.length < group.partTotal
      ? "waiting_parts"
      : statuses.has("processing")
        ? "processing"
        : statuses.has("error") && !statuses.has("created")
          ? "error"
          : statuses.has("created")
            ? "created"
            : statuses.has("waiting_parts")
              ? "waiting_parts"
              : bundleScans[0].status;
    const representative = bundleScans.find((scan) => scan.status === "created")
      ?? bundleScans.find((scan) => scan.courrierId)
      ?? bundleScans[0];

    return {
      ...representative,
      status: bundleStatus,
      errorMessage: representative.errorMessage ?? (bundleStatus === "waiting_parts" ? `En attente des autres parties (${bundleScans.length}/${group.partTotal}).` : null),
      contraventionId: bundleScans.find((scan) => scan.contraventionId)?.contraventionId ?? null,
      courrierId: bundleScans.find((scan) => scan.courrierId)?.courrierId ?? null,
      courrierType: null as string | null,
      bundleCount: bundleScans.length,
      bundlePartTotal: partInfo.partTotal,
      bundlePartIndex: partInfo.partIndex || 1,
    };
  });

  const courrierIds = [...new Set(rows.map((scan) => scan.courrierId).filter((id): id is string => !!id))];
  const courrierTypes = courrierIds.length > 0
    ? await prisma.courrier.findMany({
        where: { id: { in: courrierIds } },
        select: { id: true, type: true, data: true },
      })
    : [];
  const courrierTypeById = new Map(courrierTypes.map((courrier) => [courrier.id, courrier.type]));
  const transmissionById = new Map(
    courrierTypes.map((courrier) => [
      courrier.id,
      (courrier.data as Record<string, unknown> | null)?.transmissionClient ?? null,
    ])
  );

  return NextResponse.json(rows.map((scan) => ({
    ...scan,
    courrierType: scan.courrierId ? courrierTypeById.get(scan.courrierId) ?? null : null,
    transmissionClient: scan.courrierId ? transmissionById.get(scan.courrierId) ?? null : null,
  })));
}
