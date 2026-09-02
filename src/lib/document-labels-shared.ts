/**
 * Pure, prisma-free lookup tables shared between the "+ Nouveau document" modal
 * (NewDocumentMenu.tsx) and the "Scanner un document" page (ScanDocumentClient.tsx) — both are
 * "use client" components, so this file MUST NOT import anything from document-import.ts (which
 * pulls in prisma at module scope and would break the client bundle, same pitfall as
 * vehicule-import.ts vs vehicule-import-shared.ts).
 */

export const RECLASS_OPTIONS: { key: string; label: string }[] = [
  { key: "contravention", label: "Contravention" },
  { key: "mise_en_demeure", label: "Mise en demeure" },
  { key: "retard_paiement", label: "Retard de paiement" },
  { key: "sinistre", label: "Sinistre" },
  { key: "certificat_immatriculation", label: "Certificat d'immatriculation" },
  { key: "permis_conduire", label: "Permis de conduire" },
  { key: "carte_identite", label: "Carte d'identité" },
  { key: "facture", label: "Facture" },
  { key: "impot", label: "Impôt / document fiscal" },
  { key: "pub", label: "Publicité" },
  { key: "inconnu", label: "Document à classer (inconnu)" },
];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contravention: "Contravention",
  mise_en_demeure: "Mise en demeure",
  retard_paiement: "Retard de paiement",
  sinistre: "Sinistre",
  certificat_immatriculation: "Certificat d'immatriculation",
  permis_conduire: "Permis de conduire",
  carte_identite: "Carte d'identité",
  facture: "Facture",
  impot: "Impôt / document fiscal",
  pub: "Publicité",
  inconnu: "Document à classer (inconnu)",
};

export const DOCUMENT_FIELD_LABELS: Record<string, string> = {
  numAvis: "N° avis",
  dateInfraction: "Date infraction",
  immatriculation: "Immatriculation",
  natureInfraction: "Nature infraction",
  lieuInfraction: "Lieu infraction",
  montantAmende: "Montant amende (€)",
  dateLimitePaiement: "Date limite paiement",
  expediteur: "Expéditeur",
  destinataire: "Destinataire",
  sens: "Sens",
  motif: "Motif",
  dateDocument: "Date du document",
  montant: "Montant (€)",
  echeance: "Échéance",
  reference: "Référence",
  emetteur: "Émetteur",
  typeDocument: "Type de document",
  organisme: "Organisme",
  typeSinistre: "Type de sinistre",
  dateSinistre: "Date du sinistre",
  lieuSinistre: "Lieu du sinistre",
  assureur: "Assureur",
  referenceAssureur: "Référence assureur",
  montantDommage: "Montant des dommages (€)",
  numPermis: "N° de permis",
  numCarteIdentite: "N° de carte d'identité",
  dateDelivrance: "Date de délivrance",
  dateExpiration: "Date d'expiration",
  typeDetecte: "Type détecté (estimé)",
};
