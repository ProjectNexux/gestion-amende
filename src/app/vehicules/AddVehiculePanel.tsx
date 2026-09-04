"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  extraActions?: React.ReactNode;
};

const inp = "field";

export default function AddVehiculePanel({ action, extraActions }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Flotte</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Véhicules</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-primary"
            aria-expanded={open}
            aria-controls="add-vehicule-form"
          >
            + Ajouter un véhicule
          </button>
        </div>
      </div>

      <div
        id="add-vehicule-form"
        aria-hidden={!open}
        className={
          "overflow-hidden transition-all duration-300 ease-out " +
          (open ? "max-h-[540px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1")
        }
      >
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
          <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="code" placeholder="Code (auto)" className={inp} />
            <input name="immatriculation" placeholder="Immatriculation *" required className={inp} />
            <input name="marque" placeholder="Marque" className={inp} />
            <input name="modele" placeholder="Modèle" className={inp} />
            <input name="typeVehicule" placeholder="Type (fourgon, camion…)" className={inp} />
            <input name="service" placeholder="Service" className={inp} />
            <div className="md:col-span-3 flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button className="btn-primary">
                Créer
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
