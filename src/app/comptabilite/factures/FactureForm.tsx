"use client";

import { DEVISE_OPTIONS } from "@/lib/comptabilite";

const inp = "field";
const lbl = "mb-1 block text-xs font-medium text-slate-500";

export type FactureFormDefaults = {
  societe?: string;
  emetteur?: string | null;
  numeroFacture?: string | null;
  dateDocument?: string | null; // ISO yyyy-mm-dd for the <input type="date">
  echeance?: string | null; // ISO yyyy-mm-dd
  montantHT?: number | null;
  tva?: number | null;
  montantTTC?: number | null;
  devise?: string | null;
  referenceCommande?: string | null;
  commentaire?: string | null;
};

export function FactureForm({
  action,
  societeOptions,
  defaultSociete,
  isAdmin,
  defaults,
  fileRequired,
  submitLabel,
  onCancel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  societeOptions: string[];
  defaultSociete: string;
  isAdmin: boolean;
  defaults?: FactureFormDefaults;
  fileRequired: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className={lbl}>Société concernée</label>
        {isAdmin ? (
          <select name="societe" required defaultValue={defaults?.societe ?? defaultSociete} className={inp}>
            {societeOptions.map((nom) => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="societe" value={defaults?.societe ?? defaultSociete} />
        )}
      </div>
      <div>
        <label className={lbl}>Émetteur / Fournisseur</label>
        <input name="emetteur" defaultValue={defaults?.emetteur ?? ""} placeholder="Nom de l'entreprise" className={inp} />
      </div>
      <div>
        <label className={lbl}>Numéro de facture</label>
        <input name="numeroFacture" defaultValue={defaults?.numeroFacture ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Référence / Bon de commande</label>
        <input name="referenceCommande" defaultValue={defaults?.referenceCommande ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Date de facture</label>
        <input type="date" name="dateDocument" defaultValue={defaults?.dateDocument ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Date d&apos;échéance</label>
        <input type="date" name="echeance" defaultValue={defaults?.echeance ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Montant HT</label>
        <input type="number" step="0.01" min="0" name="montantHT" defaultValue={defaults?.montantHT ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>TVA</label>
        <input type="number" step="0.01" min="0" name="tva" defaultValue={defaults?.tva ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Montant TTC *</label>
        <input type="number" step="0.01" min="0" required name="montantTTC" defaultValue={defaults?.montantTTC ?? ""} className={inp} />
      </div>
      <div>
        <label className={lbl}>Devise</label>
        <select name="devise" defaultValue={defaults?.devise ?? "EUR"} className={inp}>
          {DEVISE_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={lbl}>Commentaire</label>
        <textarea name="commentaire" defaultValue={defaults?.commentaire ?? ""} rows={2} className={inp} />
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
