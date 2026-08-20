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
