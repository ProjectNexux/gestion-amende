"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

/**
 * Double confirmation before a real delete: a native `confirm()` first (handled by the parent
 * `<form>` submit), then this typed "SUPPRIMER" gate on the button itself. The server action
 * (`deleteClientAction`) still independently refuses to hard-delete a société with any linked
 * document/contravention/véhicule/conducteur — it archives instead — so this UI gate is a second,
 * not the only, safety net.
 */
export function DeleteClientForm({ nom, hasAnyLinkedData }: { nom: string; hasAnyLinkedData: boolean }) {
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim().toUpperCase() === "SUPPRIMER";

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-2 text-sm text-rose-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          {hasAnyLinkedData
            ? "Cette société possède des documents ou dossiers liés : la suppression l'archivera automatiquement (données conservées, connexion bloquée) plutôt que de tout effacer."
            : "Aucune donnée liée : cette action supprime définitivement la fiche société. Cette opération est irréversible."}
        </p>
      </div>
      <label className="block text-xs font-medium text-rose-800">
        Tapez SUPPRIMER pour confirmer
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="SUPPRIMER"
          className="field mt-1 border-rose-300"
        />
      </label>
      <button
        type="submit"
        disabled={!canDelete}
        onClick={(e) => {
          if (!window.confirm(`Confirmez-vous la suppression de « ${nom} » ?`)) e.preventDefault();
        }}
        className="btn-secondary text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={14} /> {hasAnyLinkedData ? "Archiver définitivement" : "Supprimer définitivement"}
      </button>
    </div>
  );
}
