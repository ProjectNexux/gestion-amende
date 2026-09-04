import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "indigo" | "turquoise" | "coral" | "orange" | "violet" | "emerald" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-50 text-success-600 ring-success-500/15",
  warning: "bg-warning-50 text-warning-600 ring-warning-500/15",
  danger: "bg-danger-50 text-danger-500 ring-danger-500/15",
  info: "bg-brand-50 text-brand-700 ring-brand-500/15",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
  indigo: "bg-brand-50 text-brand-700 ring-brand-500/15",
  turquoise: "bg-sky-50 text-sky-700 ring-sky-500/15",
  coral: "bg-orange-50 text-orange-700 ring-orange-500/15",
  orange: "bg-warning-50 text-warning-600 ring-warning-500/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-500/15",
  emerald: "bg-success-50 text-success-600 ring-success-500/15",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const dotClasses: Record<BadgeTone, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-brand-500",
  neutral: "bg-slate-400",
  indigo: "bg-brand-500",
  turquoise: "bg-sky-500",
  coral: "bg-orange-500",
  orange: "bg-warning-500",
  violet: "bg-violet-500",
  emerald: "bg-success-500",
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
