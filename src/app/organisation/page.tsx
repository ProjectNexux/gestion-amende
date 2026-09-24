import { redirect } from "next/navigation";
import { Building2, Users, ScanLine, Send, History, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminSession, getUserId } from "@/lib/auth";
import { getCurrentOrganizationId, getCurrentOrgRole } from "@/lib/org-scope";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { HelpHint } from "@/components/ui/HelpHint";
import {
  updateOrganizationAction,
  setMemberRoleAction,
  toggleMemberDisabledAction,
  resendOrganizationInvitationAction,
  cancelOrganizationInvitationAction,
} from "./actions";
import { InviteMemberForm } from "./InviteMemberForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", collaborator: "Collaborateur" };

export default async function OrganisationPage() {
  if (!(await isAdminSession())) redirect("/login");
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/login");
  const myRole = await getCurrentOrgRole();
  const canManage = myRole === "owner" || myRole === "admin";
  const myUserId = await getUserId();

  const [organization, members, invitations, clientCount, homeSociete, audits] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.organizationMember.findMany({ where: { organizationId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.organizationInvitation.findMany({ where: { organizationId, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.societe.count({ where: { organizationId, isOrganizationHome: false } }),
    prisma.societe.findFirst({ where: { organizationId, isOrganizationHome: true }, select: { nom: true, emailTransmission: true } }),
    prisma.organizationAudit.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  if (!organization) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Espace gestionnaire</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Mon organisation</h1>
          <p className="mt-1 text-sm text-slate-500">
            {organization.name} — {clientCount} société(s) cliente(s), {members.length} membre(s) gestionnaire(s).
          </p>
        </div>
        <div className="mt-1">
          <HelpHint
            text="Cet espace regroupe les informations de votre organisation, ses administrateurs/collaborateurs et son historique. Un client ne voit jamais cette page — elle est réservée aux membres gestionnaires."
            guideHref="/aide"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Building2 size={16} className="text-brand-600" /> Informations</h2>
        {canManage ? (
          <form action={updateOrganizationAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Nom de l&apos;organisation</span>
              <input name="name" defaultValue={organization.name} className="field text-sm" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">E-mail de contact</span>
              <input name="contactEmail" type="email" defaultValue={organization.contactEmail ?? ""} className="field text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Téléphone</span>
              <input name="contactPhone" defaultValue={organization.contactPhone ?? ""} className="field text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Ville</span>
              <input name="city" defaultValue={organization.city ?? ""} className="field text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Adresse</span>
              <input name="addressLine1" defaultValue={organization.addressLine1 ?? ""} className="field text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Code postal</span>
              <input name="postalCode" defaultValue={organization.postalCode ?? ""} className="field text-sm" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary text-xs">Enregistrer</button>
            </div>
          </form>
        ) : (
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{organization.name}</p>
            {organization.contactEmail && <p>{organization.contactEmail}</p>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><ScanLine size={16} className="text-brand-600" /> Réception des scans</h2>
        <p className="mt-1 text-sm text-slate-500">
          Société de réception : <span className="font-medium text-slate-800">{homeSociete?.nom ?? "—"}</span>
          {homeSociete?.emailTransmission && <> — transmission vers <span className="font-medium text-slate-800">{homeSociete.emailTransmission}</span></>}
        </p>
        <p className="mt-1 text-xs text-slate-400">La configuration technique (adresse e-mail IMAP, mot de passe) est gérée par l&apos;équipe technique et n&apos;est jamais affichée ici, conformément à la politique de sécurité.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Users size={16} className="text-brand-600" /> Administrateurs &amp; collaborateurs</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                  {m.user.prenom} {m.user.nom}
                  {m.userId === myUserId && <span className="text-xs font-normal text-slate-400">(vous)</span>}
                </div>
                <div className="text-xs text-slate-500">{m.user.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={m.disabledAt ? "neutral" : "success"}>{m.disabledAt ? "Désactivé" : "Actif"}</Badge>
                {canManage && m.orgRole !== "owner" ? (
                  <ActionForm action={setMemberRoleAction.bind(null, m.id, m.orgRole === "admin" ? "collaborator" : "admin")}>
                    <button type="submit" className="btn-secondary text-xs">{ROLE_LABELS[m.orgRole]}</button>
                  </ActionForm>
                ) : (
                  <Badge tone="info">{ROLE_LABELS[m.orgRole]}</Badge>
                )}
                {canManage && m.orgRole !== "owner" && (
                  <ActionForm action={toggleMemberDisabledAction.bind(null, m.id, !m.disabledAt)}>
                    <button type="submit" className="btn-secondary text-xs">{m.disabledAt ? "Activer" : "Désactiver"}</button>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>

        {invitations.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invitations en attente</h3>
            {invitations.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{inv.email} <span className="text-xs text-slate-400">({ROLE_LABELS[inv.orgRole]})</span></span>
                {canManage && (
                  <div className="flex gap-2">
                    <ActionForm action={resendOrganizationInvitationAction.bind(null, inv.id)}>
                      <button type="submit" className="btn-secondary text-xs"><Send size={12} /> Renvoyer</button>
                    </ActionForm>
                    <ActionForm action={cancelOrganizationInvitationAction.bind(null, inv.id)}>
                      <ConfirmSubmitButton confirmMessage="Annuler cette invitation ?" className="btn-secondary text-xs">Annuler</ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><UserPlus size={13} /> Inviter un administrateur</h3>
            <InviteMemberForm />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><History size={16} className="text-brand-600" /> Activité récente</h2>
        {audits.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Aucune activité enregistrée pour le moment.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {audits.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2 text-slate-600">
                <span>{a.details ?? a.action}</span>
                <span className="shrink-0 text-xs text-slate-400">{a.createdAt.toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
