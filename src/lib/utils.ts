import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

/** Formats an integer amount in cents (as stored for payments) as euros. */
export function fmtMoneyCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return fmtMoney(cents / 100);
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return s;
}

export function fmtDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const datePart = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} - ${timePart}`;
}

/**
 * Turns a technical file name (underscores/dashes, trailing date, extension) into a readable
 * title for display — purely presentational, the original file name is always kept/shown
 * alongside it. e.g. "Incident_de_paiement_09-06-2026.pdf" -> "Incident de paiement".
 */
export function humanizeFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[a-zA-Z0-9]{2,5}$/, "");
  const withoutTrailingDate = withoutExt.replace(/[_-]?\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?$/, "");
  const spaced = withoutTrailingDate.replace(/[_-]+/g, " ").trim();
  if (!spaced) return fileName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
