type Scannable = {
  messageId: string;
  fileName: string;
  createdAt?: Date;
  receivedAt?: Date;
  updatedAt?: Date;
};

type ScanPartInfo = {
  baseMessageId: string;
  baseFileName: string;
  bundleKey: string;
  partIndex: number;
  partTotal: number;
  isSplitPart: boolean;
};

import { PDFDocument } from "pdf-lib";

const MESSAGE_PART_SUFFIX_RE = /-p\d+(?:-\d+)?-[a-f0-9]{8}$/i;
const FILE_PART_SUFFIX_RE = /(_part-(\d+)-sur-(\d+))(?:_p\d+(?:-\d+)?)?/i;

export function normalizeBaseMessageId(messageId: string): string {
  return messageId.replace(MESSAGE_PART_SUFFIX_RE, "");
}

export function normalizeBaseFileName(fileName: string): string {
  return fileName.replace(FILE_PART_SUFFIX_RE, "").replace(/_+\./, ".").replace(/_+$/, "");
}

export function getScanPartInfo(scan: Pick<Scannable, "messageId" | "fileName">): ScanPartInfo {
  const baseMessageId = normalizeBaseMessageId(scan.messageId);
  const baseFileName = normalizeBaseFileName(scan.fileName);
  const partMatch = scan.fileName.match(FILE_PART_SUFFIX_RE);
  const partIndex = partMatch?.[2] ? parseInt(partMatch[2], 10) : 0;
  const partTotal = partMatch?.[3] ? parseInt(partMatch[3], 10) : 1;
  const isSplitPart = partIndex > 0 || partTotal > 1;

  return {
    baseMessageId,
    baseFileName,
    bundleKey: `${baseMessageId}::${baseFileName}`.toLowerCase(),
    partIndex,
    partTotal,
    isSplitPart,
  };
}

export function sortScansByPart<T extends Scannable>(scans: T[]): T[] {
  return [...scans].sort((a, b) => {
    const ai = getScanPartInfo(a).partIndex;
    const bi = getScanPartInfo(b).partIndex;
    if (ai !== bi) return ai - bi;
    const ad = a.receivedAt?.getTime() ?? a.createdAt?.getTime() ?? a.updatedAt?.getTime() ?? 0;
    const bd = b.receivedAt?.getTime() ?? b.createdAt?.getTime() ?? b.updatedAt?.getTime() ?? 0;
    return ad - bd;
  });
}

export function groupScansByBundle<T extends Scannable>(scans: T[]): Array<{ key: string; scans: T[]; partTotal: number; baseFileName: string }> {
  const map = new Map<string, { key: string; scans: T[]; partTotal: number; baseFileName: string }>();

  for (const scan of scans) {
    const info = getScanPartInfo(scan);
    const existing = map.get(info.bundleKey);
    if (existing) {
      existing.scans.push(scan);
      existing.partTotal = Math.max(existing.partTotal, info.partTotal);
      continue;
    }

    map.set(info.bundleKey, {
      key: info.bundleKey,
      scans: [scan],
      partTotal: info.partTotal,
      baseFileName: info.baseFileName,
    });
  }

  return [...map.values()].map((group) => ({
    ...group,
    scans: sortScansByPart(group.scans),
  }));
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 1) return buffers[0];

  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await merged.copyPages(source, source.getPageIndices());
    for (const page of copiedPages) {
      merged.addPage(page);
    }
  }

  const bytes = await merged.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
