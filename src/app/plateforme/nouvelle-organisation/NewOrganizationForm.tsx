"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createOrganizationAction, type CreateOrganizationState } from "../actions";

export function NewOrganizationForm() {
  const initialState: CreateOrganizationState = {};
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  if (state.ok) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <h2 className="text-lg font-semibold">Organisation créée</h2>
        <p className="text-sm">
          Un espace vide a été initialisé et une invitation a été envoyée au propriétaire pour créer son mot de passe.
          Aucune donnée de démonstration n&apos;a été copiée.
        </p>
        <Link href="/plateforme" className="btn-primary inline-flex w-fit">Retour aux organisations</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {state.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</div>}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Nom de la société gestionnaire *</span>
        <input name="name" required className="field text-sm" placeholder="Ex : Transports Atlas" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">SIRET (optionnel — récupération automatique des informations si disponible)</span>
        <input name="siret" className="field text-sm" placeholder="14 chiffres" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">E-mail du propriétaire *</span>
        <input name="ownerEmail" type="email" required className="field text-sm" placeholder="proprietaire@societe.fr" />
      </label>
      <div className="flex items-center gap-2 pt-2">
        <Link href="/plateforme" className="btn-secondary text-xs"><ArrowLeft size={13} /> Annuler</Link>
        <button type="submit" disabled={pending} className="btn-primary text-xs disabled:opacity-50">
          {pending ? "Création…" : "Créer l'organisation et inviter le propriétaire"}
        </button>
      </div>
    </form>
  );
}
