"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

const inp = "px-3 py-2 border border-gray-300 rounded-md text-sm";

export default function AddVehiculePanel({ action }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Véhicules</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
          aria-expanded={open}
          aria-controls="add-vehicule-form"
        >
          + Ajouter un véhicule
        </button>
      </div>

      <div
        id="add-vehicule-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[540px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <form action={action} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input name="code" placeholder="Code (auto)" className={inp} />
            <input name="immatriculation" placeholder="Immatriculation *" required className={inp} />
            <input name="marque" placeholder="Marque" className={inp} />
            <input name="modele" placeholder="Modèle" className={inp} />
            <input name="typeVehicule" placeholder="Type (fourgon, camion…)" className={inp} />
            <input name="service" placeholder="Service" className={inp} />
            <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
