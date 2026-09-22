export function shouldAutoProcessScans(scans: Array<{ status?: string; processedAt?: string | null; updatedAt?: string | null }>): boolean {
  if (!Array.isArray(scans) || scans.length === 0) return false;

  return scans.some((scan) => {
    const status = (scan.status ?? "received").toLowerCase();
    if (status === "received" || status === "error" || status === "processing") return true;
    if (status === "analyzed") {
      const updated = scan.updatedAt ? new Date(scan.updatedAt).getTime() : 0;
      const processed = scan.processedAt ? new Date(scan.processedAt).getTime() : 0;
      const last = Number.isFinite(updated) && updated > 0 ? updated : processed;
      if (!last) return true;
      return Date.now() - last > 30_000;
    }
    return false;
  });
}
