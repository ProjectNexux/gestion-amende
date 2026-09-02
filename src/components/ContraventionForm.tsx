"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import type { Contravention } from "@prisma/client";

type Option = { id: string; label: string };

export type ContraventionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<Contravention> & { rawOcrText?: string | null };
  vehicules: Option[];
  conducteurs: Option[];
  submitLabel?: string;
  showStatutBlocks?: boolean;
};

export default function ContraventionForm({
  action,
  initial = {},
  vehicules,
  conducteurs,
  submitLabel = "Enregistrer",
  showStatutBlocks = false,
}: ContraventionFormProps) {
  const [showOcr, setShowOcr] = useState(false);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="rawOcrText" defaultValue={initial.rawOcrText ?? ""} />

      <Card title="Identification">
        <Grid>
          <Field label="Société" hint="obligatoire">
            <input name="societe" defaultValue={initial.societe ?? "Societe principale"} className={inp} required />
          </Field>
          <Field label="N° Dossier" hint="auto si vide">
            <input name="numDossier" defaultValue={initial.numDossier ?? ""} placeholder="PV-2024-XXX" className={inp} />
          </Field>
          <Field label="N° Avis contravention">
            <input name="numAvis" defaultValue={initial.numAvis ?? ""} className={inp} />
          </Field>
          <Field label="Date réception avis">
            <input name="dateReceptionAvis" defaultValue={initial.dateReceptionAvis ?? ""} placeholder="jj/mm/aaaa" className={inp} />
          </Field>
        </Grid>
      </Card>

      <Card title="Infraction">
        <Grid>
          <Field label="Date infraction">
            <input name="dateInfraction" defaultValue={initial.dateInfraction ?? ""} placeholder="jj/mm/aaaa" className={inp} />
          </Field>
          <Field label="Heure">
            <input name="heureInfraction" defaultValue={initial.heureInfraction ?? ""} placeholder="HHhMM" className={inp} />
          </Field>
          <Field label="Date limite paiement">
            <input name="dateLimitePaiement" defaultValue={initial.dateLimitePaiement ?? ""} placeholder="jj/mm/aaaa" className={inp} />
          </Field>
          <Field label="Nature infraction" full>
            <input name="natureInfraction" defaultValue={initial.natureInfraction ?? ""} className={inp} />
          </Field>
          <Field label="Lieu" full>
            <input name="lieuInfraction" defaultValue={initial.lieuInfraction ?? ""} className={inp} />
          </Field>
          <Field label="Vitesse constatée (km/h)">
            <input name="vitesseConstatee" type="number" defaultValue={initial.vitesseConstatee ?? ""} className={inp} />
          </Field>
          <Field label="Vitesse autorisée (km/h)">
            <input name="vitesseAutorisee" type="number" defaultValue={initial.vitesseAutorisee ?? ""} className={inp} />
          </Field>
          <Field label="Montant amende (€)">
            <input name="montantAmende" type="number" step="0.01" defaultValue={initial.montantAmende ?? ""} className={inp} />
          </Field>
          <Field label="Points retirés">
            <input name="pointsRetires" type="number" defaultValue={initial.pointsRetires ?? ""} className={inp} />
          </Field>
        </Grid>
      </Card>

      <Card title="Véhicule & conducteur">
        <Grid>
          <Field label="Immatriculation (OCR)">
            <input name="immatriculationOcr" defaultValue={initial.immatriculationOcr ?? ""} className={inp} />
          </Field>
          <Field label="Véhicule (lié)">
            <select name="vehiculeId" defaultValue={initial.vehiculeId ?? ""} className={inp}>
              <option value="">— Auto / non rattaché —</option>
              {vehicules.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Conducteur">
            <select name="conducteurId" defaultValue={initial.conducteurId ?? ""} className={inp}>
              <option value="">— Non identifié —</option>
              {conducteurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </Grid>
      </Card>

      {showStatutBlocks && (
        <>
          <Card title="Dénonciation">
            <Grid>
              <Field label="Statut">
                <select name="statutDenonciation" defaultValue={initial.statutDenonciation ?? "À effectuer"} className={inp}>
                  <option>À effectuer</option><option>Effectuée</option><option>En cours</option><option>Non applicable</option>
                </select>
              </Field>
              <Field label="Date dénonciation">
                <input name="dateDenonciation" defaultValue={initial.dateDenonciation ?? ""} className={inp} />
              </Field>
              <Field label="Mode">
                <select name="modeDenonciation" defaultValue={initial.modeDenonciation ?? ""} className={inp}>
                  <option value="">—</option>
                  <option>ANTAI en ligne</option>
                  <option>Courrier RAR</option>
                  <option>Formulaire papier</option>
                </select>
              </Field>
              <Field label="N° Dénonciation ANTAI">
                <input name="numDenonciationAntai" defaultValue={initial.numDenonciationAntai ?? ""} className={inp} />
              </Field>
            </Grid>
          </Card>

          <Card title="Paiement">
            <Grid>
              <Field label="Statut">
                <select name="statutPaiement" defaultValue={initial.statutPaiement ?? "En attente"} className={inp}>
                  <option>En attente</option><option>Payé</option><option>En retard</option><option>Contesté</option>
                </select>
              </Field>
              <Field label="Date paiement">
                <input name="datePaiement" defaultValue={initial.datePaiement ?? ""} className={inp} />
              </Field>
              <Field label="Payé par">
                <select name="payePar" defaultValue={initial.payePar ?? ""} className={inp}>
                  <option value="">—</option>
                  <option>Conducteur</option>
                  <option>Société</option>
                </select>
              </Field>
            </Grid>
          </Card>

          <Card title="Observations">
            <textarea name="observations" defaultValue={initial.observations ?? ""} rows={3} className={inp + " w-full"} />
          </Card>
        </>
      )}

      {initial.rawOcrText && (
        <div className="text-xs">
          <button type="button" onClick={() => setShowOcr((v) => !v)} className="text-slate-500 underline">
            {showOcr ? "Masquer" : "Voir"} le texte OCR brut
          </button>
          {showOcr && <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded whitespace-pre-wrap">{initial.rawOcrText}</pre>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <SubmitBtn label={submitLabel} />
      </div>
    </form>
  );
}

const inp = "field";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-sm text-slate-700 mb-4">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>;
}
function Field({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={"block " + (full ? "md:col-span-3" : "")}>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label} {hint && <span className="text-gray-400 font-normal">· {hint}</span>}</span>
      {children}
    </label>
  );
}
function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
      {pending ? "Enregistrement..." : label}
    </button>
  );
}
