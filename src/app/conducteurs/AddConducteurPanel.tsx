"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

const inp = "field";

export default function AddConducteurPanel({ action }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Conducteurs</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
          aria-expanded={open}
          aria-controls="add-conducteur-form"
        >
          + Ajouter un conducteur
        </button>
      </div>

      <div
        id="add-conducteur-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[540px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="card p-5">
          <form action={action} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select name="civilite" className={inp}>
              <option value="">Civilité</option>
              <option>M.</option>
              <option>Mme</option>
            </select>
            <input name="nom" placeholder="Nom *" required className={inp} />
            <input name="prenom" placeholder="Prénom *" required className={inp} />
            <input name="telephone" placeholder="Téléphone" className={inp} />
            <input name="email" placeholder="Email" className={inp} />
            <input name="numPermis" placeholder="N° Permis" className={inp} />

            <div className="md:col-span-3 mt-2 border-t border-slate-100 pt-4">
              <h2 className="text-sm font-semibold text-slate-700">Carte d'identité</h2>
            </div>
            <input name="numCarteIdentite" placeholder="N° de carte d'identité" className={inp} />
            <input name="dateDelivranceCni" placeholder="Date de délivrance (jj/mm/aaaa)" className={inp} />
            <input name="dateExpirationCni" placeholder="Date d'expiration (jj/mm/aaaa)" className={inp} />

            <label className="md:col-span-3 grid gap-1 text-sm text-slate-700">
              <span>Télécharger le recto de la carte d'identité</span>
              <input
                type="file"
                name="cniRecto"
                accept="application/pdf,image/jpeg,image/jpg,image/png"
                className={inp}
              />
            </label>

            <label className="md:col-span-3 grid gap-1 text-sm text-slate-700">
              <span>Télécharger le verso de la carte d'identité</span>
              <input
                type="file"
                name="cniVerso"
                accept="application/pdf,image/jpeg,image/jpg,image/png"
                className={inp}
              />
            </label>

            <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button className="bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm hover:bg-[var(--color-brand-dark)]">
                Créer
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
