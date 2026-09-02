"use client";

import { useState } from "react";
import { SINISTRE_STATUTS, SINISTRE_TYPES } from "@/lib/sinistres";

type Opt = { id: string; label: string };

const inp = "field";
const label = "mb-1 block text-xs font-medium text-slate-500";

export default function AddSinistrePanel({
  action,
  societeOptions,
  defaultSociete,
  vehicules,
  conducteurs,
}: {
  action: (formData: FormData) => void | Promise<void>;
  societeOptions: string[];
  defaultSociete: string;
  vehicules: Opt[];
  conducteurs: Opt[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div />
        <button
          type="button"
          id="add-sinistre-trigger"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
          aria-expanded={open}
          aria-controls="add-sinistre-form"
        >
          + Ajouter un sinistre
        </button>
      </div>

      <div
        id="add-sinistre-form"
        aria-hidden={!open}
        className={"overflow-hidden transition-all duration-300 ease-out " + (open ? "max-h-[1400px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")}
      >
        <div className="card p-5">
          <form action={action} className="space-y-5">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Informations générales</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className={label}>Société concernée</label>
                  <select name="societe" defaultValue={defaultSociete} className={`${inp} w-full`}>
                    {societeOptions.map((nom) => (
                      <option key={nom} value={nom}>{nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Type de sinistre</label>
                  <select name="typeSinistre" defaultValue="" className={`${inp} w-full`}>
                    <option value="">— Sélectionner —</option>
                    {SINISTRE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Date du sinistre</label>
                  <input name="dateSinistre" placeholder="jj/mm/aaaa" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className={label}>Lieu</label>
                  <input name="lieuSinistre" className={`${inp} w-full`} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Véhicule</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <label className={label}>Véhicule concerné</label>
                  <select name="vehiculeId" defaultValue="" className={`${inp} w-full`}>
                    <option value="">— Aucun / non rattaché —</option>
                    {vehicules.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Conducteur si connu</label>
                  <select name="conducteurId" defaultValue="" className={`${inp} w-full`}>
                    <option value="">— Non identifié —</option>
                    {conducteurs.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assurance</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <label className={label}>Assureur</label>
                  <input name="assureur" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className={label}>N° dossier sinistre</label>
                  <input name="referenceAssureur" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className={label}>N° contrat</label>
                  <input name="numeroContrat" className={`${inp} w-full`} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</h3>
              <textarea name="description" rows={3} placeholder="Description / circonstances" className={`${inp} w-full`} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Financier (facultatif)</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={label}>Montant estimé (€)</label>
                  <input name="montantDommage" placeholder="0.00" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className={label}>Montant réclamé (€)</label>
                  <input name="montantReclame" placeholder="0.00" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className={label}>Montant indemnisé (€)</label>
                  <input name="montantPropose" placeholder="0.00" className={`${inp} w-full`} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <label className={label}>Échéance / prochaine date limite</label>
                <input name="dateLimiteReponse" placeholder="jj/mm/aaaa" className={`${inp} w-full`} />
              </div>
              <div>
                <label className={label}>Statut</label>
                <select name="statut" defaultValue="Nouveau" className={`${inp} w-full`}>
                  {SINISTRE_STATUTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Pièces jointes</label>
                <input type="file" name="fichiers" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={`${inp} w-full`} />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
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
