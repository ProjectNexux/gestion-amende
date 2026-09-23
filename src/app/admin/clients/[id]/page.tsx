import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Send, Power, LayoutGrid, Mail, FileWarning, Users, Clock, LogIn } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminSession, impersonateClientAction } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ActionForm";
import { CLIENT_STATUS_LABELS, clientStatusTone, deriveClientStatus } from "@/lib/clients";
import { fmtDateTime } from "@/lib/utils";
import { buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";
import { COURRIER_LIST_SELECT } from "@/lib/courriers";
import { deactivateClientAction, reactivateClientAction, activateClientAction, sendInvitationAction } from "../actions";
import { OverviewTab } from "./tabs/OverviewTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { ContraventionsTab } from "./tabs/ContraventionsTab";
import { UsersTab } from "./tabs/UsersTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { SettingsTab } from "./tabs/SettingsTab";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "vue-ensemble", label: "Vue d'ensemble", icon: LayoutGrid },
  { id: "documents", label: "Documents", icon: Mail },
  { id: "contraventions", label: "Contraventions", icon: FileWarning },
  { id: "utilisateurs", label: "Utilisateurs", icon: Users },
  { id: "activite", label: "Activité", icon: Clock },
  { id: "parametres", label: "Paramètres", icon: Building2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await isAdminSession())) redirect("/login");
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const tabParam = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "vue-ensemble";
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "vue-ensemble";

  const s = await prisma.societe.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!s) notFound();

  const [courriers, contraventions, nVehicules, nConducteurs] = await Promise.all([
    prisma.courrier.findMany({ where: { societe: s.nom }, orderBy: { receivedAt: "desc" }, select: COURRIER_LIST_SELECT }),
    prisma.contravention.findMany({
      where: { societe: s.nom },
      orderBy: { createdAt: "desc" },
      include: { conducteur: { select: { nom: true, prenom: true } }, vehicule: { select: { immatriculation: true } } },
    }),
    prisma.vehicule.count({ where: { societe: s.nom } }),
    prisma.conducteur.count({ where: { societe: s.nom } }),
  ]);

  const nDocuments = courriers.length;
  const nContraventions = contraventions.length;
  const hasAnyLinkedData = nDocuments + nContraventions + nVehicules + nConducteurs > 0;
  const contraventionsATraiter = contraventions.filter((c) => c.statutPaiement !== "Payé");
  const montantEnAttente = contraventionsATraiter.reduce((sum, c) => sum + (c.montantAmende ?? 0), 0);

  const status = deriveClientStatus(s);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const setupUrl = s.codeAccesSetupToken ? buildSetupUrl(appUrl, s.codeAccesSetupToken) : null;
  const setupExpired = isSetupTokenExpired(s.codeAccesSetupExpiresAt);
  const lastLogin = s.users[0]?.lastLoginAt ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div>
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:text-brand-800">
          <ArrowLeft size={14} /> Retour à la liste
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Building2 size={18} />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{s.nom}</h1>
              <Badge tone={clientStatusTone(status)}>{CLIENT_STATUS_LABELS[status]}</Badge>
            </div>
            {s.tradeName && <p className="mt-2 text-sm text-slate-500">{s.tradeName}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Créé le {fmtDateTime(s.createdAt)}</span>
              <span>Dernière connexion : {lastLogin ? fmtDateTime(lastLogin) : "jamais"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {status !== "actif" && (
              <ActionForm action={activateClientAction.bind(null, s.id)}>
                <button className="btn-primary" type="submit"><Power size={14} /> Activer le compte</button>
              </ActionForm>
            )}
            {status === "actif" && (
              <ActionForm action={deactivateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-amber-700" type="submit"><Power size={14} /> Désactiver</button>
              </ActionForm>
            )}
            {status === "desactive" && (
              <ActionForm action={reactivateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-emerald-700" type="submit"><Power size={14} /> Réactiver</button>
              </ActionForm>
            )}
            {s.email && (
              <ActionForm action={sendInvitationAction.bind(null, s.id)}>
                <button className="btn-secondary" type="submit"><Send size={14} /> Renvoyer l&apos;invitation</button>
              </ActionForm>
            )}
            <form action={impersonateClientAction.bind(null, s.id)}>
              <button className="btn-secondary" type="submit"><LogIn size={14} /> Accéder à l&apos;espace</button>
            </form>
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={`/admin/clients/${s.id}?tab=${t.id}`}
              className={
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition " +
                (active
                  ? "border-brand-600 text-brand-700 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200")
              }
            >
              <t.icon size={14} /> {t.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "vue-ensemble" && (
        <OverviewTab
          societeId={s.id}
          email={s.email}
          phone={s.phone}
          addressLine1={s.addressLine1}
          postalCode={s.postalCode}
          city={s.city}
          contactName={[s.contactCivilite, s.contactFirstName, s.contactLastName].filter(Boolean).join(" ")}
          lastLogin={lastLogin}
          createdAt={s.createdAt}
          nDocuments={nDocuments}
          nContraventions={nContraventions}
          nContraventionsATraiter={contraventionsATraiter.length}
          nVehicules={nVehicules}
          nConducteurs={nConducteurs}
          montantEnAttente={montantEnAttente}
          recentAudits={s.audits.slice(0, 6)}
        />
      )}

      {activeTab === "documents" && (
        <DocumentsTab
          societeId={s.id}
          courriers={courriers.map((c) => ({
            id: c.id,
            type: c.type,
            fileName: c.fileName,
            fileMime: c.fileMime,
            receivedAt: c.receivedAt.toISOString(),
            visibleClient: c.visibleClient,
          }))}
        />
      )}

      {activeTab === "contraventions" && (
        <ContraventionsTab
          contraventions={contraventions.map((c) => ({
            id: c.id,
            numDossier: c.numDossier,
            dateInfraction: c.dateInfraction,
            natureInfraction: c.natureInfraction,
            montantAmende: c.montantAmende,
            dateLimitePaiement: c.dateLimitePaiement,
            statutDenonciation: c.statutDenonciation,
            statutPaiement: c.statutPaiement,
            conducteurNom: c.conducteur ? `${c.conducteur.prenom} ${c.conducteur.nom}` : null,
            vehiculeImmat: c.vehicule?.immatriculation ?? null,
          }))}
        />
      )}

      {activeTab === "utilisateurs" && (
        <UsersTab
          societeId={s.id}
          societeEmail={s.email}
          users={s.users.map((u) => ({
            id: u.id,
            nom: u.nom,
            prenom: u.prenom,
            email: u.email,
            telephone: u.telephone,
            isActive: u.isActive,
            isPrincipal: u.isPrincipal,
            hasPassword: !!u.passwordHash,
            invitationPending: !!u.invitationToken && !isSetupTokenExpired(u.invitationExpiresAt),
            invitedAt: u.invitedAt?.toISOString() ?? null,
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            createdAt: u.createdAt.toISOString(),
          }))}
          setupUrl={setupUrl}
          setupExpired={setupExpired}
        />
      )}

      {activeTab === "activite" && <ActivityTab audits={s.audits} />}

      {activeTab === "parametres" && <SettingsTab s={s} status={status} hasAnyLinkedData={hasAnyLinkedData} />}
    </div>
  );
}
