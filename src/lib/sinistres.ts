import type { BadgeTone } from "@/components/ui/Badge";

export const SINISTRE_STATUTS = [
  "Nouveau",
  "À vérifier",
  "À traiter",
  "En cours",
  "En attente de documents",
  "En attente assurance",
  "Expertise",
  "Indemnisation en attente",
  "Clos",
] as const;

export const SINISTRE_TYPES = [
  "Accident",
  "Vol",
  "Vandalisme",
  "Bris de glace",
  "Dégât des eaux",
  "Incendie",
  "Dommage matériel",
  "Autre",
] as const;

export function sinistreStatutTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Clos") return "success";
  if (statut === "À vérifier") return "warning";
  if (statut === "À traiter" || statut === "En attente de documents" || statut === "En attente assurance" || statut === "Indemnisation en attente") return "warning";
  if (statut === "En cours" || statut === "Expertise" || statut === "Nouveau") return "info";
  return "neutral";
}

export const SINISTRE_HISTORIQUE_LABELS: Record<string, string> = {
  document_recu: "Document reçu",
  classification_auto: "Classification automatique",
  extraction: "Informations extraites",
  correction_manuelle: "Correction manuelle",
  changement_statut: "Statut modifié",
  piece_jointe_ajoutee: "Pièce jointe ajoutée",
  creation_manuelle: "Dossier créé manuellement",
  modification: "Dossier modifié",
  cloture: "Dossier clôturé",
};
