import { Badge, statusTone, type BadgeTone } from "@/components/ui/Badge";
import { getStatusHint } from "@/lib/help-content";

// Refonte 2026-09-24 — badge de statut UNIQUE pour toute l'application : une même chaîne de statut
// donne toujours la même couleur (via statusTone) ET la même explication au survol (via le
// glossaire). Évite les badges divergents d'une page à l'autre.
const EXTRA_TONES: Record<string, BadgeTone> = {
  "Reçu": "info",
  "Analyse en cours": "warning",
  "À classer": "warning",
  "À vérifier": "warning",
  "Classé": "success",
  "Dossier créé": "success",
  "Prêt à transmettre": "info",
  "Prêt à envoyer": "info",
  "Transmis": "success",
  "Visible": "success",
  "Masquée": "neutral",
  "Lu": "info",
  "À dénoncer": "warning",
  "Paiement en attente": "warning",
  "En attente": "warning",
  "Payé": "success",
  "En retard": "danger",
  "Terminé": "success",
  "Terminée": "success",
  "Erreur": "danger",
  "Erreur d'envoi": "danger",
  "Nouveau": "info",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const label = status ?? "—";
  const tone: BadgeTone = EXTRA_TONES[label] ?? statusTone(label);
  return (
    <Badge tone={tone} title={getStatusHint(label)} className={className}>
      {label}
    </Badge>
  );
}
