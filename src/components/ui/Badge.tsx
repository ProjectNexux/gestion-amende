import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "indigo" | "turquoise" | "coral" | "orange" | "violet" | "emerald" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
  // Document-category tones (2026-08-25 palette pass) — same soft-pastel-bg/darker-text shape as
  // the tones above, just extending the palette so each document type reads as its own color.
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  turquoise: "bg-teal-50 text-teal-700 ring-teal-600/20",
  coral: "bg-coral-50 text-coral-700 ring-coral-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const dotClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
  indigo: "bg-indigo-500",
  turquoise: "bg-teal-500",
  coral: "bg-coral-500",
  orange: "bg-orange-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

/** Maps existing business status strings (statutPaiement / statutDenonciation) to a badge tone. */
export function statusTone(status: string | null | undefined): BadgeTone {
  if (status === "Payé" || status === "Effectuée" || status === "Traité" || status === "Envoyé" || status === "Terminé") return "success";
  if (status === "En retard" || status === "Urgent" || status === "Erreur" || status === "Erreur d'envoi") return "danger";
  if (status === "À effectuer" || status === "En attente" || status === "À vérifier" || status === "À traiter" || status === "En cours") return "warning";
  if (status === "Archivé") return "neutral";
  return "neutral";
}

/** Maps a document/courrier category label to its own soft color, so "Documents récents"-style
 * lists read as distinct categories at a glance instead of one generic gray badge for everything. */
const DOCUMENT_TYPE_TONES: Record<string, BadgeTone> = {
  Contravention: "indigo",
  "Certificat d'immatriculation": "turquoise",
  "Mise en demeure": "coral",
  "Retard de paiement": "orange",
  Sinistre: "violet",
  Facture: "emerald",
  Impôt: "slate",
  Pub: "neutral",
  "Document à classer": "neutral",
  "Document envoyé par le client": "info",
};
export function documentTypeTone(typeLabel: string): BadgeTone {
  return DOCUMENT_TYPE_TONES[typeLabel] ?? "neutral";
}
