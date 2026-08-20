"use client";

import { useState } from "react";
import { BENEFICIAIRES } from "@/lib/payments/beneficiaries";

const inp = "px-3 py-2 border border-gray-300 rounded-md text-sm";

export default function AddRetardPaiementPanel({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
          aria-expanded={open}
          aria-controls="add-retard-form"
        >
          + Ajouter un retard de paiement
        </button>
      </div>

      <div
        id="add-retard-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[520px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Société bénéficiaire</label>
              <select name="beneficiaire" required defaultValue={BENEFICIAIRES[0]} className={`${inp} w-full`}>
                {BENEFICIAIRES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Débiteur</label>
              <input name="debiteur" required className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Montant dû (€)</label>
              <input name="montantDu" required placeholder="2500.00" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Référence</label>
              <input name="reference" placeholder="Facture n°..." className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date d'échéance</label>
              <input name="dateEcheance" placeholder="31/08/2026" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Document (facultatif)</label>
              <input type="file" name="fichier" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={`${inp} w-full`} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
