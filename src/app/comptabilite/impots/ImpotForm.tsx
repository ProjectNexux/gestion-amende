"use client";

import { useState } from "react";
import { IMPOT_ORGANISME_OPTIONS, IMPOT_TYPE_OPTIONS } from "@/lib/comptabilite";

const inp = "field";
const lbl = "mb-1 block text-xs font-medium text-slate-500";

/** <select> with a list of suggestions plus a free-text "Autre" fallback — submits a single field. */
function SelectOrOther({ name, options, defaultValue }: { name: string; options: string[]; defaultValue?: string | null }) {
  const initialIsOther = !!defaultValue && !options.includes(defaultValue);
  const [choice, setChoice] = useState(initialIsOther ? "Autre" : defaultValue || "");

  return (
    <div className="space-y-2">
      <select
        value={choice || ""}
        onChange={(e) => setChoice(e.target.value)}
        className={inp}
      >
        <option value="" disabled>Sélectionner…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {choice === "Autre" ? (
        <input name={name} defaultValue={initialIsOther ? defaults(defaultValue) : ""} placeholder="Préciser…" className={inp} />
      ) : (
        <input type="hidden" name={name} value={choice} />
      )}
    </div>
  );
}

function defaults(v?: string | null) {
  return v ?? "";
}

export type ImpotFormDefaults = {
  societe?: string;
  organisme?: string | null;
  typeDocument?: string | null;
  reference?: string | null;
  dateDocument?: string | null; // ISO yyyy-mm-dd
  echeance?: string | null; // ISO yyyy-mm-dd
  montant?: number | null;
  periodeConcernee?: string | null;
  commentaire?: string | null;
};

export function ImpotForm({
  action,
  societeOptions,
  defaultSociete,
  isAdmin,
  defaults: d,
  fileRequired,
  submitLabel,
  onCancel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  societeOptions: string[];
  defaultSociete: string;
  isAdmin: boolean;
  defaults?: ImpotFormDefaults;
  fileRequired: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className={lbl}>Société concernée</label>
        {isAdmin ? (
          <select name="societe" required defaultValue={d?.societe ?? defaultSociete} className={inp}>
            {societeOptions.map((nom) => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="societe" value={d?.societe ?? defaultSociete} />
        )}
      </div>
      <div>
        <label className={lbl}>Référence</label>
        <input name="reference" defaultValue={d?.reference ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Organisme / Administration</label>
        <SelectOrOther name="organisme" options={IMPOT_ORGANISME_OPTIONS} defaultValue={d?.organisme} />
      </div>
      <div>
        <label className={lbl}>Type d&apos;impôt / document fiscal</label>
        <SelectOrOther name="typeDocument" options={IMPOT_TYPE_OPTIONS} defaultValue={d?.typeDocument} />
      </div>
      <div>
        <label className={lbl}>Date du document</label>
        <input type="date" name="dateDocument" defaultValue={d?.dateDocument ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Date d&apos;échéance</label>
        <input type="date" name="echeance" defaultValue={d?.echeance ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Montant *</label>
        <input type="number" step="0.01" min="0" required name="montant" defaultValue={d?.montant ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Période concernée</label>
        <input name="periodeConcernee" defaultValue={d?.periodeConcernee ?? ""} placeholder="Ex : 2026, T1 2026" className={inp} />
      </div>
      <div className="md:col-span-2">
        <label className={lbl}>Commentaire</label>
        <textarea name="commentaire" defaultValue={d?.commentaire ?? ""} rows={2} className={inp} />
      </div>
      <div className="md:col-span-2">
        <label className={lbl}>Pièce jointe {fileRequired ? "*" : "(remplacer, optionnel)"}</label>
        <input
          type="file"
          name="fichier"
          required={fileRequired}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className={inp}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
        )}
        <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
