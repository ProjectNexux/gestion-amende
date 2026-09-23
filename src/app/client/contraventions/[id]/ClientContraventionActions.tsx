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
};

export function ClientContraventionActions({
  id,
  conducteurId,
  conducteur,
  conducteurs,
  statutDenonciation,
  statutPaiement,
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
      {/* Conducteur */}
      {!conducteur && (
        <form action={handleSelectConducteur} className="space-y-3">
          <select name="conducteurId" defaultValue="" className="field">
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
      {statutPaiement !== "Payé" && (
        <button onClick={handleMarkPayment} className="btn-secondary w-full text-sm">
          Marquer comme payé
        </button>
      )}

      {/* Dénonciation */}
      {statutDenonciation !== "Effectuée" && statutDenonciation !== "Non applicable" && (
        <button onClick={handleMarkDenonciation} className="btn-secondary w-full text-sm">
          Dénonciation effectuée
        </button>
      )}
    </>
  );
}
