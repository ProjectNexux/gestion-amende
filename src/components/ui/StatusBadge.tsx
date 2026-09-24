import { Badge, statusTone, type BadgeTone } from "@/components/ui/Badge";
import { getStatusHint } from "@/lib/help-content";

// Refonte 2026-09-24 — badge de statut UNIQUE pour toute l'application : une même chaîne de statut
// donne toujours la même couleur ET la même explication au survol (glossaire). Cette table est un
// sur-ensemble de tous les statuts métier (contraventions, courriers, retards, sinistres,
// transmission, scans...) pour qu'un remplacement des anciens badges ne change jamais une couleur.
const EXTRA_TONES: Record<string, BadgeTone> = {
  // Réception / scans
  "Reçu": "info",
  "Analyse en cours": "warning",
  "Analysé": "info",
  "À classer": "warning",
  "À vérifier": "warning",
  "Classé": "success",
  "Dossier créé": "success",
  "Erreur": "danger",
  "Erreur de traitement": "danger",
  // Transmission client
  "Prêt à transmettre": "info",
  "Prêt à envoyer": "info",
  "À transmettre": "warning",
  "Transmis": "success",
  "Envoyé": "success",
  "Erreur d'envoi": "danger",
  "Visible": "success",
  "Masquée": "neutral",
  "Lu": "info",
  // Contraventions — dénonciation
  "À effectuer": "warning",
  "À dénoncer": "warning",
  "Effectuée": "success",
  "Non applicable": "neutral",
  // Contraventions / retards — paiement
  "Paiement en attente": "warning",
  "En attente": "warning",
  "Non payé": "warning",
  "Partiellement payé": "warning",
  "Payé": "success",
  "Échec de paiement": "danger",
  "Remboursé": "neutral",
  "Contesté": "warning",
  "En retard": "danger",
  // Mise en demeure / traitement générique
  "Nouveau": "info",
  "En cours": "warning",
  "À traiter": "warning",
  "Traité": "success",
  "Archivé": "neutral",
  // Sinistres
  "Expertise": "warning",
  "En attente assurance": "warning",
  "Indemnisation en attente": "warning",
  "Clos": "success",
  // Pub
  "Conservé": "success",
  "Suppression auto": "neutral",
  // Terminé
  "Terminé": "success",
  "Terminée": "success",
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
