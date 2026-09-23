"use client";

import { updateConductorClientAction, clientMarkDenonciationAction, clientMarkPaymentAction } from "../../../contraventions/actions";
import { Conducteur } from "@prisma/client";

type ClientContraventionActionsProps = {
  id: string;
  conducteurId: string | null;
  conducteur: Conducteur | null;
  conducteurs: Conducteur[];
  statutDenonciation?: string | null;
  statutPaiement?: string | null;
  /** Quand true, n'affiche que les boutons paiement/dénonciation (utilisé dans les cartes
   * "Paiement"/"Dénonciation" de la barre latérale) — évite de dupliquer le formulaire conducteur
   * qui vit uniquement dans la carte "Conducteur impliqué". */
  onlyPaymentAndDenonciation?: boolean;
};

export function ClientContraventionActions({
  id,
  conducteurId,
  conducteur,
  conducteurs,
  statutDenonciation,
  statutPaiement,
  onlyPaymentAndDenonciation,
}: ClientContraventionActionsProps) {
  async function handleSelectConducteur(fd: FormData) {
    await updateConductorClientAction(id, fd);
  }

  async function handleMarkDenonciation() {
    await clientMarkDenonciationAction(id);
  }

  async function handleMarkPayment() {
    await clientMarkPaymentAction(id);
  }

  return (
    <>
      {/* Conducteur — jamais affiché dans les cartes latérales, uniquement dans la carte dédiée */}
      {!onlyPaymentAndDenonciation && !conducteur && (
        <form action={handleSelectConducteur} className="space-y-3">
          {/* Préremplissage: présélectionne le seul conducteur connu de la société, l'utilisateur
             n'a plus qu'à confirmer. */}
          <select name="conducteurId" defaultValue={conducteurs.length === 1 ? conducteurs[0].id : ""} className="field">
            <option value="">— Sélectionner le conducteur —</option>
            {conducteurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary text-sm w-full">
            Confirmer le conducteur
          </button>
        </form>
      )}

      {/* Paiement */}
      {onlyPaymentAndDenonciation && statutPaiement !== "Payé" && (
        <button onClick={handleMarkPayment} className="btn-secondary w-full text-sm">
          Marquer comme payé
        </button>
      )}

      {/* Dénonciation */}
      {onlyPaymentAndDenonciation && statutDenonciation !== "Effectuée" && statutDenonciation !== "Non applicable" && (
        <button onClick={handleMarkDenonciation} className="btn-secondary w-full text-sm">
          Dénonciation effectuée
        </button>
      )}
    </>
  );
}
