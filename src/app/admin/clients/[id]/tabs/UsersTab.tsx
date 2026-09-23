"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Trash2, UserCog, UserPlus, Star, Pencil, X, Send, Power, ShieldOff } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyLinkButton } from "../CopyLinkButton";
import { fmtDateTime } from "@/lib/utils";
import {
  toggleUserActiveAction,
  deleteUserAction,
  sendInvitationAction,
  regenerateSetupLinkAction,
  addClientUserAction,
  updateClientUserAction,
  setPrincipalUserAction,
  sendUserInvitationAction,
  sendUserPasswordResetAction,
  type AddUserState,
} from "../../actions";

export type UserRow = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  isActive: boolean;
  isPrincipal: boolean;
  hasPassword: boolean;
  invitationPending: boolean;
  invitedAt: string | null; // ISO
  lastLoginAt: string | null; // ISO
  createdAt: string; // ISO
};

function userStatus(u: UserRow): { label: string; tone: BadgeTone } {
  if (!u.isActive) return { label: "Désactivé", tone: "neutral" };
  if (u.hasPassword) return { label: "Actif", tone: "success" };
  return { label: "Invitation en attente", tone: "warning" };
}

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
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  return (
    <div className="space-y-4">
      {setupUrl && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Ancien accès partagé (code d&apos;accès société)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Lien historique à usage unique — conservé pour compatibilité. Privilégiez désormais les comptes individuels
            ci-dessous (chaque personne avec son propre mot de passe).
          </p>
          {setupExpired && <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Ce lien a expiré, régénérez-en un nouveau.</div>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-brand-700">{setupUrl}</div>
            <CopyLinkButton url={setupUrl} />
            <ActionForm action={regenerateSetupLinkAction.bind(null, societeId)}>
              <button type="submit" className="btn-secondary text-xs"><KeyRound size={13} /> Régénérer le lien</button>
            </ActionForm>
            {societeEmail && (
              <ActionForm action={sendInvitationAction.bind(null, societeId)}>
                <button type="submit" className="btn-secondary text-xs"><Send size={13} /> Renvoyer (société)</button>
              </ActionForm>
            )}
          </div>
        </div>
      )}

      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{users.length} compte(s) utilisateur individuel(s)</h2>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary text-xs">
            <UserPlus size={14} /> Ajouter un utilisateur
          </button>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun compte utilisateur individuel pour cette société.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => {
              const status = userStatus(u);
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      <UserCog size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        {u.prenom} {u.nom}
                        {u.isPrincipal && (
                          <span title="Contact principal" className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                            <Star size={11} fill="currentColor" /> Principal
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                        {u.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {u.email}</span>}
                        <span>Invité le : {u.invitedAt ? fmtDateTime(new Date(u.invitedAt)) : "—"}</span>
                        <span>Dernière connexion : {u.lastLoginAt ? fmtDateTime(new Date(u.lastLoginAt)) : "jamais"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {!u.isPrincipal && (
                      <ActionForm action={setPrincipalUserAction.bind(null, u.id)}>
                        <button type="submit" className="btn-secondary text-xs" title="Définir comme contact principal">
                          <Star size={13} /> Principal
                        </button>
                      </ActionForm>
                    )}
                    <button type="button" onClick={() => setEditing(u)} className="btn-secondary text-xs" title="Modifier">
                      <Pencil size={13} /> Modifier
                    </button>
                    {u.email && !u.hasPassword && (
                      <ActionForm action={sendUserInvitationAction.bind(null, u.id)}>
                        <button type="submit" className="btn-secondary text-xs">
                          <Send size={13} /> {u.invitationPending ? "Renvoyer l'invitation" : "Envoyer une invitation"}
                        </button>
                      </ActionForm>
                    )}
                    {u.email && u.hasPassword && (
                      <ActionForm action={sendUserPasswordResetAction.bind(null, u.id)}>
                        <button type="submit" className="btn-secondary text-xs">
                          <KeyRound size={13} /> Réinitialiser le mot de passe
                        </button>
                      </ActionForm>
                    )}
                    <ActionForm action={toggleUserActiveAction.bind(null, u.id, !u.isActive)}>
                      <button type="submit" className="btn-secondary text-xs">
                        {u.isActive ? <><ShieldOff size={13} /> Désactiver</> : <><Power size={13} /> Activer</>}
                      </button>
                    </ActionForm>
                    <ActionForm action={deleteUserAction.bind(null, u.id)}>
                      <ConfirmSubmitButton confirmMessage={`Supprimer le compte utilisateur ${u.prenom} ${u.nom} ? Les documents et dossiers de la société ne sont jamais supprimés.`} className="grid h-8 w-8 place-items-center rounded-md text-rose-600 hover:bg-rose-50">
                        <Trash2 size={14} />
                      </ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {addOpen && <AddUserModal societeId={societeId} onClose={() => setAddOpen(false)} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddUserModal({ societeId, onClose }: { societeId: string; onClose: () => void }) {
  const router = useRouter();
  const initialState: AddUserState = {};
  const [state, formAction, pending] = useActionState(addClientUserAction.bind(null, societeId), initialState);

  if (state.ok) {
    return (
      <Modal open onClose={() => { onClose(); router.refresh(); }} title="Utilisateur ajouté">
        <div className="space-y-4 p-5">
          {state.error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{state.error}</div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Le compte a été créé et une invitation a été envoyée par e-mail.
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => { onClose(); router.refresh(); }} className="btn-primary text-sm">Fermer</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Ajouter un utilisateur">
      <form action={formAction} className="space-y-4 p-5">
        {state.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Prénom *</span>
            <input name="prenom" required className="field text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Nom *</span>
            <input name="nom" required className="field text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Adresse e-mail *</span>
          <input name="email" type="email" required className="field text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isPrincipal" className="h-4 w-4 rounded border-slate-300" /> Définir comme contact principal
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="btn-secondary text-xs"><X size={13} /> Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary text-xs disabled:opacity-50">
            <UserPlus size={13} /> {pending ? "Création…" : "Ajouter et inviter"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    setPending(true);
    setError(null);
    try {
      await updateClientUserAction(user.id, fd);
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la mise à jour.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Modifier ${user.prenom} ${user.nom}`}>
      <form action={handleSubmit} className="space-y-4 p-5">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Prénom</span>
            <input name="prenom" defaultValue={user.prenom} required className="field text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Nom</span>
            <input name="nom" defaultValue={user.nom} required className="field text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Adresse e-mail</span>
          <input name="email" type="email" defaultValue={user.email ?? ""} className="field text-sm" />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="btn-secondary text-xs"><X size={13} /> Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary text-xs disabled:opacity-50">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
