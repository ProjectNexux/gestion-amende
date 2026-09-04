import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Building2, RefreshCw, Send, Power, Car, Users, Mail, Trash2, PowerOff, CheckCircle2, Calendar, MapPin, FileWarning } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CLIENT_STATUS_LABELS, clientStatusTone, deriveClientStatus } from "@/lib/clients";
import { fmtDateTime, fmtMoney } from "@/lib/utils";
import { buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";
import { courrierTypeLabel } from "@/lib/courriers";
import {
  regenerateSetupLinkAction,
  markInvitationSentAction,
  deactivateClientAction,
  reactivateClientAction,
  updateClientAction,
  sendInvitationAction,
  activateClientAction,
  deleteClientAction,
} from "../actions";
import { CopyLinkButton } from "./CopyLinkButton";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "infos", label: "Informations", icon: Building2 },
  { id: "compte", label: "Compte client", icon: Power },
  { id: "documents", label: "Documents & courriers", icon: Mail },
  { id: "contraventions", label: "Contraventions", icon: FileWarning },
  { id: "vehicules", label: "Véhicules", icon: Car },
  { id: "conducteurs", label: "Conducteurs", icon: Users },
  { id: "historique", label: "Historique", icon: Calendar },
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
  const tab = (((Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "infos") as TabId);
  const activeTab: TabId = TABS.some((t) => t.id === tab) ? tab : "infos";

  const s = await prisma.societe.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!s) notFound();

  const [courriers, contraventions, vehicules, conducteurs, counts] = await Promise.all([
    prisma.courrier.findMany({ where: { societe: s.nom }, orderBy: { receivedAt: "desc" }, take: 30 }),
    prisma.contravention.findMany({ where: { societe: s.nom }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.vehicule.findMany({ where: { societe: s.nom }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: { societe: s.nom }, orderBy: { nom: "asc" } }),
    Promise.all([
      prisma.courrier.count({ where: { societe: s.nom } }),
      prisma.contravention.count({ where: { societe: s.nom } }),
      prisma.vehicule.count({ where: { societe: s.nom } }),
      prisma.conducteur.count({ where: { societe: s.nom } }),
    ]),
  ]);
  const [nCourriers, nContraventions, nVehicules, nConducteurs] = counts;
  const hasAnyLinkedData = nCourriers + nContraventions + nVehicules + nConducteurs > 0;

  const status = deriveClientStatus(s);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const setupUrl = s.codeAccesSetupToken ? buildSetupUrl(appUrl, s.codeAccesSetupToken) : null;
  const setupExpired = isSetupTokenExpired(s.codeAccesSetupExpiresAt);
  const lastLogin = s.users[0]?.lastLoginAt ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
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
              {lastLogin && <span>Dernière connexion : {fmtDateTime(lastLogin)}</span>}
              {s.city && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {s.city}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {status !== "actif" && (
              <form action={activateClientAction.bind(null, s.id)}>
                <button className="btn-primary" type="submit"><CheckCircle2 size={14} /> Activer le compte</button>
              </form>
            )}
            {s.email && (
              <form action={sendInvitationAction.bind(null, s.id)}>
                <button className="btn-secondary" type="submit"><Send size={14} /> Envoyer l&apos;invitation</button>
              </form>
            )}
            {status !== "desactive" ? (
              <form action={deactivateClientAction.bind(null, s.id)}>
                <ConfirmSubmitButton confirmMessage={`Désactiver le compte de ${s.nom} ?\n\nLe client ne pourra plus se connecter. Ses données restent conservées.`} className="btn-secondary text-amber-700">
                  <PowerOff size={14} /> Désactiver
                </ConfirmSubmitButton>
              </form>
            ) : (
              <form action={reactivateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-emerald-700" type="submit"><Power size={14} /> Réactiver</button>
              </form>
            )}
            <form action={deleteClientAction.bind(null, s.id)}>
              <ConfirmSubmitButton
                confirmMessage={
                  hasAnyLinkedData
                    ? `Ce client possède des données liées (${nCourriers} courriers, ${nContraventions} contraventions, ${nVehicules} véhicules, ${nConducteurs} conducteurs). Il sera ARCHIVÉ (données conservées, connexion bloquée). Continuer ?`
                    : `Aucune donnée liée. Tapez SUPPRIMER dans la confirmation ci-dessous pour confirmer la suppression définitive de ${s.nom}.`
                }
                className="btn-secondary text-rose-700"
              >
                <Trash2 size={14} /> {hasAnyLinkedData ? "Archiver" : "Supprimer"}
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Car} label="Véhicules" value={nVehicules} href={`/admin/clients/${s.id}?tab=vehicules`} />
        <StatCard icon={Users} label="Conducteurs" value={nConducteurs} href={`/admin/clients/${s.id}?tab=conducteurs`} />
        <StatCard icon={Mail} label="Courriers" value={nCourriers} href={`/admin/clients/${s.id}?tab=documents`} />
        <StatCard icon={FileWarning} label="Contraventions" value={nContraventions} href={`/admin/clients/${s.id}?tab=contraventions`} />
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

      {activeTab === "infos" && (
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
      )}

      {activeTab === "compte" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card space-y-4">
          <SectionHeader title="Compte client" description="Statut et accès au portail client." />
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <KV k="Statut" v={<Badge tone={clientStatusTone(status)}>{CLIENT_STATUS_LABELS[status]}</Badge>} />
            <KV k="E-mail de connexion" v={s.email ?? "—"} />
            <KV k="Invitation envoyée le" v={s.invitationSentAt ? fmtDateTime(s.invitationSentAt) : "—"} />
            <KV k="Compte activé le" v={s.activatedAt ? fmtDateTime(s.activatedAt) : "—"} />
            <KV k="Dernière connexion" v={lastLogin ? fmtDateTime(lastLogin) : "—"} />
          </div>

          {setupUrl && !setupExpired ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 text-xs font-medium text-slate-500">Lien de création du code d&apos;accès</div>
              <div className="break-all text-xs font-mono text-brand-700">{setupUrl}</div>
              <div className="mt-1 text-[11px] text-slate-500">Ce lien permet au client de créer lui-même son code d&apos;accès. Utilisation unique.</div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {setupExpired && setupUrl ? "Ce lien a expiré." : "Ce compte a déjà un code d'accès défini."}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {s.email && (
              <form action={sendInvitationAction.bind(null, s.id)}>
                <button className="btn-primary" type="submit"><Send size={14} /> Envoyer l&apos;invitation par e-mail</button>
              </form>
            )}
            {status !== "actif" && (
              <form action={activateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-emerald-700" type="submit"><CheckCircle2 size={14} /> Activer manuellement</button>
              </form>
            )}
            <form action={regenerateSetupLinkAction.bind(null, s.id)}>
              <button className="btn-secondary" type="submit"><RefreshCw size={14} /> Régénérer le lien</button>
            </form>
            {setupUrl && <CopyLinkButton url={setupUrl} />}
            {s.email && (
              <form action={markInvitationSentAction.bind(null, s.id)}>
                <button className="text-xs text-slate-500 hover:underline" type="submit">Marquer envoyée manuellement</button>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <SectionHeader title="Documents & courriers" description={`${nCourriers} document(s) au total, ${courriers.length} affiché(s).`} />
          {courriers.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun document pour cette société.</p>
          ) : (
            <div className="table-shell overflow-hidden">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Fichier</th>
                    <th className="p-3 text-left">Reçu le</th>
                    <th className="p-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {courriers.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="p-3 text-slate-700">{courrierTypeLabel(c.type)}</td>
                      <td className="p-3 text-slate-600">{c.fileName ?? "—"}</td>
                      <td className="p-3 text-slate-500">{fmtDateTime(c.receivedAt)}</td>
                      <td className="p-3 text-right"><Link href="/courriers" className="text-xs font-medium text-brand-700 hover:underline">Voir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "contraventions" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <SectionHeader title="Contraventions" description={`${nContraventions} dossier(s) au total.`} />
          {contraventions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune contravention.</p>
          ) : (
            <div className="table-shell overflow-hidden">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="p-3 text-left">N° dossier</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Nature</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {contraventions.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="p-3"><Link href={`/contraventions/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.numDossier}</Link></td>
                      <td className="p-3 text-slate-600">{c.dateInfraction ?? "—"}</td>
                      <td className="p-3 text-slate-600">{c.natureInfraction ?? "—"}</td>
                      <td className="p-3 text-right font-medium text-slate-900">{c.montantAmende != null ? fmtMoney(c.montantAmende) : "—"}</td>
                      <td className="p-3 text-slate-600">{c.statutPaiement ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "vehicules" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <SectionHeader title="Véhicules" description={`${nVehicules} véhicule(s).`} />
          {vehicules.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun véhicule enregistré.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {vehicules.map((v) => (
                <li key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium text-slate-900">{v.immatriculation}</div>
                  <div className="mt-1 text-xs text-slate-500">{[v.marque, v.modele].filter(Boolean).join(" ") || "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "conducteurs" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <SectionHeader title="Conducteurs" description={`${nConducteurs} conducteur(s).`} />
          {conducteurs.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun conducteur.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conducteurs.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <span className="font-medium text-slate-900">{c.prenom} {c.nom}</span>
                  {c.email && <span className="text-xs text-slate-500"> · {c.email}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "historique" && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <SectionHeader title="Journal d'activité" description={`${s.audits.length} événement(s) récent(s).`} />
          {s.audits.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun événement.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {s.audits.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <div className="font-medium text-slate-800">{humanizeAction(a.action)}</div>
                    {a.details && <div className="text-xs text-slate-500">{a.details}</div>}
                    <div className="text-[11px] text-slate-400">{a.acteur ? `${a.acteur} — ` : ""}{fmtDateTime(a.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </header>
  );
}

function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue} required={required} className="field" />
    </label>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</div>
      <div className="mt-0.5 text-slate-800">{v}</div>
    </div>
  );
}

function humanizeAction(a: string): string {
  const map: Record<string, string> = {
    creation: "Client créé",
    invitation_envoyee: "Invitation envoyée",
    compte_active: "Compte activé",
    connexion: "Connexion",
    code_regenere: "Code d'accès régénéré",
    informations_modifiees: "Informations modifiées",
    desactivation: "Compte désactivé",
    reactivation: "Compte réactivé",
    archivage: "Client archivé",
  };
  return map[a] ?? a;
}
