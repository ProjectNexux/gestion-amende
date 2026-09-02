"use client";

import { useState } from "react";
import { MISE_EN_DEMEURE_STATUTS } from "@/lib/courriers";

const inp = "field";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddMiseEnDemeurePanel({
  action,
  societeOptions,
  defaultSociete,
}: {
  action: (formData: FormData) => void | Promise<void>;
  societeOptions: string[];
  defaultSociete: string;
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
          aria-controls="add-mise-en-demeure-form"
        >
          + Ajouter une mise en demeure
        </button>
      </div>

      <div
        id="add-mise-en-demeure-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[900px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="card p-5">
          <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informations principales</h3>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sens</label>
              <select name="sens" required defaultValue="recue" className={`${inp} w-full`}>
                <option value="recue">Reçue</option>
                <option value="envoyee">Envoyée</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Société concernée</label>
              <select name="societeConcernee" required defaultValue={defaultSociete} className={`${inp} w-full`}>
                {societeOptions.map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Expéditeur</label>
              <input name="expediteur" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Destinataire</label>
              <input name="destinataire" className={`${inp} w-full`} />
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</h3>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date de la mise en demeure</label>
              <input name="dateDocument" placeholder="24/08/2026" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date de réception</label>
              <input type="date" name="dateReception" defaultValue={todayIso()} className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Référence / N° dossier</label>
              <input name="reference" className={`${inp} w-full`} />
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Motif</h3>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Objet / Motif de la mise en demeure</label>
              <textarea name="motif" rows={2} className={`${inp} w-full`} />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Financier</h3>
              <label className="mb-1 mt-2 block text-xs font-medium text-slate-500">Montant réclamé (€)</label>
              <input name="montant" placeholder="4523.17" className={`${inp} w-full`} />
            </div>
            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Échéance</h3>
              <label className="mb-1 mt-2 block text-xs font-medium text-slate-500">Date limite de réponse / paiement</label>
              <input name="echeance" placeholder="31/08/2026" className={`${inp} w-full`} />
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pièce jointe</h3>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Document original (PDF, JPG, JPEG, PNG)</label>
              <input
                type="file"
                name="fichier"
                required
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className={`${inp} w-full`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Statut</label>
              <select name="statut" defaultValue="Nouveau" className={`${inp} w-full`}>
                {MISE_EN_DEMEURE_STATUTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary"
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
