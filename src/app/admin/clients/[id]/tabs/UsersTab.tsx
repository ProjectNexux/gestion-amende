"use client";

import { Mail, Phone, KeyRound, Trash2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyLinkButton } from "../CopyLinkButton";
import { fmtDateTime } from "@/lib/utils";
import { toggleUserActiveAction, deleteUserAction, sendInvitationAction, regenerateSetupLinkAction } from "../../actions";

export type UserRow = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  isActive: boolean;
  lastLoginAt: string | null; // ISO
  createdAt: string; // ISO
};

export function UsersTab({
  societeId,
  societeEmail,
  users,
  setupUrl,
  setupExpired,
}: {
  societeId: string;
  societeEmail: string | null;
  users: UserRow[];
  setupUrl: string | null;
  setupExpired: boolean;
}) {
  return (
    <div className="space-y-4">
      {setupUrl && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Accès / réinitialisation du mot de passe</h2>
          <p className="mb-3 text-xs text-slate-500">
            Lien à usage unique permettant au client de définir lui-même son mot de passe. Aucun mot de passe n&apos;est
            jamais stocké ou affiché en clair.
          </p>
          {setupExpired && <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Ce lien a expiré, régénérez-en un nouveau.</div>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-brand-700">{setupUrl}</div>
            <CopyLinkButton url={setupUrl} />
            <ActionForm action={regenerateSetupLinkAction.bind(null, societeId)}>
              <button type="submit" className="btn-secondary text-xs"><KeyRound size={13} /> Régénérer le lien</button>
            </ActionForm>
          </div>
        </div>
      )}

      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">{users.length} compte(s) utilisateur</h2>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun compte utilisateur pour cette société.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    <UserCog size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{u.prenom} {u.nom}</div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                      {u.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {u.email}</span>}
                      {u.telephone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {u.telephone}</span>}
                      <span>Dernière connexion : {u.lastLoginAt ? fmtDateTime(new Date(u.lastLoginAt)) : "jamais"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Actif" : "Désactivé"}</Badge>
                  <ActionForm action={toggleUserActiveAction.bind(null, u.id, !u.isActive)}>
                    <button type="submit" className="btn-secondary text-xs">{u.isActive ? "Désactiver" : "Activer"}</button>
                  </ActionForm>
                  {societeEmail && (
                    <ActionForm action={sendInvitationAction.bind(null, societeId)}>
                      <button type="submit" className="btn-secondary text-xs">Renvoyer l&apos;invitation</button>
                    </ActionForm>
                  )}
                  <ActionForm action={deleteUserAction.bind(null, u.id)}>
                    <ConfirmSubmitButton confirmMessage={`Supprimer le compte utilisateur ${u.prenom} ${u.nom} ?`} className="grid h-8 w-8 place-items-center rounded-md text-rose-600 hover:bg-rose-50">
                      <Trash2 size={14} />
                    </ConfirmSubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
