import { CheckCircle2, Power, PowerOff, Archive, ArchiveRestore } from "lucide-react";
import type { Societe } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Field, SectionHeader } from "../shared";
import { DeleteClientForm } from "../DeleteClientForm";
import {
  updateClientAction,
  activateClientAction,
  deactivateClientAction,
  reactivateClientAction,
  archiveClientAction,
  unarchiveClientAction,
  deleteClientAction,
} from "../../actions";
import type { ClientStatus } from "@/lib/clients";

export function SettingsTab({ s, status, hasAnyLinkedData }: { s: Societe; status: ClientStatus; hasAnyLinkedData: boolean }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card space-y-3">
        <SectionHeader title="Statut du compte" description="Actions immédiates, effectives côté serveur et persistées après actualisation." />
        <div className="flex flex-wrap gap-2">
          {status !== "actif" && (
            <ActionForm action={activateClientAction.bind(null, s.id)}>
              <button className="btn-primary" type="submit"><CheckCircle2 size={14} /> Activer</button>
            </ActionForm>
          )}
          {status === "actif" && (
            <ActionForm action={deactivateClientAction.bind(null, s.id)}>
              <ConfirmSubmitButton confirmMessage={`Désactiver le compte de ${s.nom} ?`} className="btn-secondary text-amber-700">
                <PowerOff size={14} /> Désactiver
              </ConfirmSubmitButton>
            </ActionForm>
          )}
          {status === "desactive" && (
            <ActionForm action={reactivateClientAction.bind(null, s.id)}>
              <button className="btn-secondary text-emerald-700" type="submit"><Power size={14} /> Réactiver</button>
            </ActionForm>
          )}
          {status !== "archive" ? (
            <ActionForm action={archiveClientAction.bind(null, s.id)}>
              <ConfirmSubmitButton confirmMessage={`Archiver ${s.nom} ? Le compte sera masqué de la liste par défaut, ses données seront conservées.`} className="btn-secondary text-slate-700">
                <Archive size={14} /> Archiver
              </ConfirmSubmitButton>
            </ActionForm>
          ) : (
            <ActionForm action={unarchiveClientAction.bind(null, s.id)}>
              <button className="btn-secondary text-emerald-700" type="submit"><ArchiveRestore size={14} /> Désarchiver</button>
            </ActionForm>
          )}
        </div>
      </div>

      <form action={updateClientAction.bind(null, s.id)} className="space-y-6 rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
        <SectionHeader title="Informations société" description="Coordonnées officielles récupérées depuis l'INSEE." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="nom" label="Raison sociale *" defaultValue={s.nom} required />
          <Field name="tradeName" label="Nom commercial" defaultValue={s.tradeName ?? ""} />
          <Field name="siret" label="SIRET" defaultValue={s.siret ?? ""} />
          <Field name="siren" label="SIREN" defaultValue={s.siren ?? ""} />
          <Field name="legalForm" label="Forme juridique" defaultValue={s.legalForm ?? ""} />
          <Field name="vatNumber" label="N° TVA" defaultValue={s.vatNumber ?? ""} />
          <Field name="nafCode" label="Code NAF" defaultValue={s.nafCode ?? ""} />
          <Field name="activityLabel" label="Activité" defaultValue={s.activityLabel ?? ""} />
        </div>

        <SectionHeader title="Adresse" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="addressLine1" label="Adresse" defaultValue={s.addressLine1 ?? ""} />
          <Field name="addressLine2" label="Complément" defaultValue={s.addressLine2 ?? ""} />
          <Field name="postalCode" label="Code postal" defaultValue={s.postalCode ?? ""} />
          <Field name="city" label="Ville" defaultValue={s.city ?? ""} />
          <Field name="country" label="Pays" defaultValue={s.country ?? "France"} />
        </div>

        <SectionHeader title="Contact" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Civilité</label>
            <select name="contactCivilite" defaultValue={s.contactCivilite ?? ""} className="field">
              <option value="">—</option>
              <option>M.</option>
              <option>Mme</option>
            </select>
          </div>
          <Field name="contactFirstName" label="Prénom" defaultValue={s.contactFirstName ?? ""} />
          <Field name="contactLastName" label="Nom" defaultValue={s.contactLastName ?? ""} />
          <Field name="contactRole" label="Fonction" defaultValue={s.contactRole ?? ""} />
          <Field name="email" label="E-mail principal" type="email" defaultValue={s.email ?? ""} />
          <Field name="emailSecondary" label="E-mail secondaire" type="email" defaultValue={s.emailSecondary ?? ""} />
          <Field name="phone" label="Téléphone" defaultValue={s.phone ?? ""} />
          <Field name="phoneSecondary" label="Téléphone secondaire" defaultValue={s.phoneSecondary ?? ""} />
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Enregistrer les modifications</button>
        </div>
      </form>

      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card space-y-3">
        <SectionHeader title="Zone de danger" description="Ne supprime jamais silencieusement les documents liés." />
        <form action={deleteClientAction.bind(null, s.id)}>
          <DeleteClientForm nom={s.nom} hasAnyLinkedData={hasAnyLinkedData} />
        </form>
      </div>
    </div>
  );
}
