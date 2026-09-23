import type { Societe } from "@prisma/client";

export type ClientStatus = "actif" | "invitation_attente" | "desactive" | "archive";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  actif: "Actif",
  invitation_attente: "Invitation en attente",
  desactive: "Désactivé",
  archive: "Archivé",
};

// Purely derived from lifecycle timestamps, so we never need to keep a redundant enum column in
// sync with reality — the DB rows are the single source of truth.
// - archive: soft-deleted (hidden from the default list, kept for history) — takes priority over
//   every other state.
// - desactive: temporary access block (`disabledAt`) — société stays in the main list.
// - actif: has logged in at least once (or an admin activated it manually), and isn't
//   disabled/archived.
// - invitation_attente: anything else (just created, invitation not yet accepted).
export function deriveClientStatus(s: Pick<Societe, "invitationSentAt" | "activatedAt" | "archivedAt" | "disabledAt">): ClientStatus {
  if (s.archivedAt) return "archive";
  if (s.disabledAt) return "desactive";
  if (s.activatedAt) return "actif";
  return "invitation_attente";
}

export type ClientStatusTone = "success" | "info" | "warning" | "neutral" | "danger";

export function clientStatusTone(status: ClientStatus): ClientStatusTone {
  if (status === "actif") return "success";
  if (status === "invitation_attente") return "info";
  if (status === "desactive") return "warning";
  return "neutral"; // archive
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

