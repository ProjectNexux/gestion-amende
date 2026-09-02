"use client";

import { useState } from "react";

const inp = "field";

export default function AddCertificatPanel({
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
        <h1 className="text-2xl font-semibold">Certificats d&apos;immatriculation</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
          aria-expanded={open}
          aria-controls="add-certificat-form"
        >
          + Ajouter
        </button>
      </div>

      <div
        id="add-certificat-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[480px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="card p-5">
          <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Nom de la société</label>
              <select name="societe" required defaultValue={defaultSociete} className={`${inp} w-full`}>
                {societeOptions.map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Plaque d&apos;immatriculation</label>
              <input name="immatriculation" placeholder="AB-123-CD" required className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Carte grise / Pièce jointe</label>
              <input
                type="file"
                name="fichier"
                required
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className={`${inp} w-full`}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-3">
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
