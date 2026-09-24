"use client";

import { useActionState } from "react";
import { inviteOrganizationMemberAction, type InviteMemberState } from "./actions";

export function InviteMemberForm() {
  const initialState: InviteMemberState = {};
  const [state, formAction, pending] = useActionState(inviteOrganizationMemberAction, initialState);

  if (state.ok) {
    return <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Invitation envoyée.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state.error && <p className="w-full rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{state.error}</p>}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Adresse e-mail</span>
        <input name="email" type="email" required className="field text-sm" placeholder="prenom.nom@societe.fr" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Rôle</span>
        <select name="orgRole" defaultValue="admin" className="field text-sm">
          <option value="admin">Administrateur</option>
          <option value="collaborator">Collaborateur</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn-primary text-xs disabled:opacity-50">
        {pending ? "Envoi…" : "Envoyer l'invitation"}
      </button>
    </form>
  );
}
