import type { Societe } from "@prisma/client";

export type ClientStatus = "actif" | "invitation_envoyee" | "compte_non_active" | "desactive";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  actif: "Actif",
  invitation_envoyee: "Invitation envoyée",
  compte_non_active: "Compte non activé",
  desactive: "Désactivé",
};

// Purely derived from lifecycle timestamps + code state, so we never need to keep a redundant
// enum column in sync with reality — the DB rows are the single source of truth.
export function deriveClientStatus(s: Pick<Societe, "codeAccesSetupToken" | "invitationSentAt" | "activatedAt" | "archivedAt">): ClientStatus {
  if (s.archivedAt) return "desactive";
  if (s.activatedAt) return "actif";
  if (s.invitationSentAt) return "invitation_envoyee";
  if (s.codeAccesSetupToken) return "compte_non_active";
  return "actif"; // legacy row with a code that was set directly by an admin
}

export type ClientStatusTone = "success" | "info" | "warning" | "neutral";

export function clientStatusTone(status: ClientStatus): ClientStatusTone {
  if (status === "actif") return "success";
  if (status === "invitation_envoyee") return "info";
  if (status === "compte_non_active") return "warning";
  return "neutral";
}

export function formatClientName(s: Pick<Societe, "nom" | "tradeName">): string {
  return s.tradeName?.trim() ? `${s.nom} (${s.tradeName})` : s.nom;
}

export function fullContactName(s: Pick<Societe, "contactCivilite" | "contactFirstName" | "contactLastName">): string {
  const parts = [s.contactCivilite, s.contactFirstName, s.contactLastName].filter(Boolean);
  return parts.join(" ").trim();
}

export function formatSiretMasked(siret: string | null | undefined): string {
  if (!siret) return "—";
  const n = siret.replace(/\D/g, "");
  if (n.length !== 14) return siret;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
}
