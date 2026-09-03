import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, RefreshCw, Send, Power } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { CLIENT_STATUS_LABELS, clientStatusTone, deriveClientStatus } from "@/lib/clients";
import { fmtDateTime, fmtMoney } from "@/lib/utils";
import { buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";
import { courrierTypeLabel } from "@/lib/courriers";
import { regenerateSetupLinkAction, markInvitationSentAction, deactivateClientAction, reactivateClientAction, updateClientAction, sendInvitationAction } from "../actions";
import { CopyLinkButton } from "./CopyLinkButton";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) redirect("/login");
  const { id } = await params;

  const s = await prisma.societe.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!s) notFound();

  // Reused everywhere-scoped queries — same {societe: s.nom} filter used in the rest of the app.
  const [courriers, contraventions, vehicules, conducteurs] = await Promise.all([
    prisma.courrier.findMany({ where: { societe: s.nom }, orderBy: { receivedAt: "desc" }, take: 15 }),
    prisma.contravention.findMany({ where: { societe: s.nom }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.vehicule.findMany({ where: { societe: s.nom }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: { societe: s.nom }, orderBy: { nom: "asc" } }),
  ]);

  const status = deriveClientStatus(s);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const setupUrl = s.codeAccesSetupToken ? buildSetupUrl(appUrl, s.codeAccesSetupToken) : null;
  const setupExpired = isSetupTokenExpired(s.codeAccesSetupExpiresAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <div>
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Retour à la liste
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-slate-400" />
              <h1 className="text-2xl font-semibold text-slate-900">{s.nom}</h1>
              <Badge tone={clientStatusTone(status)}>{CLIENT_STATUS_LABELS[status]}</Badge>
            </div>
            {s.tradeName && <p className="text-sm text-slate-500">{s.tradeName}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {status !== "desactive" ? (
              <form action={deactivateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-rose-700"><Power size={14} /> Désactiver</button>
              </form>
            ) : (
              <form action={reactivateClientAction.bind(null, s.id)}>
                <button className="btn-secondary text-emerald-700"><Power size={14} /> Réactiver</button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          <Section title="Informations" description="Coordonnées officielles de la société.">
            <form action={updateClientAction.bind(null, s.id)} className="space-y-4">
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

              <h3 className="pt-2 text-sm font-semibold text-slate-700">Adresse</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="addressLine1" label="Adresse" defaultValue={s.addressLine1 ?? ""} />
                <Field name="addressLine2" label="Complément" defaultValue={s.addressLine2 ?? ""} />
                <Field name="postalCode" label="Code postal" defaultValue={s.postalCode ?? ""} />
                <Field name="city" label="Ville" defaultValue={s.city ?? ""} />
                <Field name="country" label="Pays" defaultValue={s.country ?? "France"} />
              </div>

              <h3 className="pt-2 text-sm font-semibold text-slate-700">Contact</h3>
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
          </Section>

          <Section title="Documents & courriers" description={`${courriers.length} document(s) récent(s).`}>
            {courriers.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun document pour cette société.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {courriers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-800">{courrierTypeLabel(c.type)}</div>
                      <div className="text-xs text-slate-500">{c.fileName ?? "—"} · {fmtDateTime(c.receivedAt)}</div>
                    </div>
                    <Link href="/courriers" className="text-xs text-brand-600 hover:underline">Voir</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Contraventions" description={`${contraventions.length} dossier(s) récent(s).`}>
            {contraventions.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune contravention.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr><th className="text-left py-1">N° dossier</th><th className="text-left py-1">Date</th><th className="text-right py-1">Montant</th><th className="text-left py-1">Statut</th></tr>
                </thead>
                <tbody>
                  {contraventions.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="py-1.5"><Link href={`/contraventions/${c.id}`} className="text-brand-600 hover:underline">{c.numDossier}</Link></td>
                      <td className="py-1.5">{c.dateInfraction ?? "—"}</td>
                      <td className="py-1.5 text-right">{c.montantAmende != null ? fmtMoney(c.montantAmende) : "—"}</td>
                      <td className="py-1.5">{c.statutPaiement ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Véhicules" description={`${vehicules.length} véhicule(s).`}>
            {vehicules.length === 0 ? <p className="text-sm text-slate-500">Aucun véhicule enregistré.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {vehicules.map((v) => (
                  <li key={v.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                    <div className="font-medium">{v.immatriculation}</div>
                    <div className="text-xs text-slate-500">{[v.marque, v.modele].filter(Boolean).join(" ") || "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Conducteurs" description={`${conducteurs.length} conducteur(s).`}>
            {conducteurs.length === 0 ? <p className="text-sm text-slate-500">Aucun conducteur.</p> : (
              <ul className="divide-y divide-slate-100">
                {conducteurs.map((c) => (
                  <li key={c.id} className="py-1.5 text-sm">
                    <span className="font-medium">{c.prenom} {c.nom}</span>{c.email && <span className="text-xs text-slate-500"> · {c.email}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Section title="Compte client" description="Statut et accès du portail client.">
            <div className="text-sm space-y-1">
              <div><span className="text-slate-500">Statut :</span> <Badge tone={clientStatusTone(status)}>{CLIENT_STATUS_LABELS[status]}</Badge></div>
              <div><span className="text-slate-500">E-mail de connexion :</span> {s.email ?? "—"}</div>
              <div><span className="text-slate-500">Invitation envoyée le :</span> {s.invitationSentAt ? fmtDateTime(s.invitationSentAt) : "—"}</div>
              <div><span className="text-slate-500">Compte activé le :</span> {s.activatedAt ? fmtDateTime(s.activatedAt) : "—"}</div>
              <div><span className="text-slate-500">Dernière connexion :</span> {s.users[0]?.lastLoginAt ? fmtDateTime(s.users[0].lastLoginAt) : "—"}</div>
            </div>

            <div className="mt-4 space-y-2">
              {setupUrl && !setupExpired ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500 mb-1">Lien de création du code d&apos;accès</div>
                  <div className="break-all text-xs font-mono text-brand-600">{setupUrl}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Ce lien permet au client de créer lui-même son code d&apos;accès. Utilisation unique.</div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {setupExpired && setupUrl ? "Ce lien a expiré." : "Ce compte a déjà un code d'accès défini."}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {s.email ? (
                  <form action={sendInvitationAction.bind(null, s.id)}>
                    <button className="btn-primary" type="submit"><Send size={14} /> Envoyer l&apos;invitation par e-mail</button>
                  </form>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Renseignez une adresse e-mail principale pour pouvoir envoyer l&apos;invitation.
                  </div>
                )}
                <form action={regenerateSetupLinkAction.bind(null, s.id)}>
                  <button className="btn-secondary" type="submit"><RefreshCw size={14} /> Régénérer le lien</button>
                </form>
                {setupUrl && (
                  <CopyLinkButton url={setupUrl} />
                )}
                {s.email && (
                  <form action={markInvitationSentAction.bind(null, s.id)}>
                    <button className="text-xs text-slate-500 hover:underline" type="submit">Marquer comme envoyée manuellement</button>
                  </form>
                )}
              </div>
            </div>
          </Section>

          <Section title="Historique" description="Journal d&apos;activité administrateur.">
            {s.audits.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun événement pour le moment.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {s.audits.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <div className="font-medium text-slate-800">{humanizeAction(a.action)}</div>
                      {a.details && <div className="text-slate-500">{a.details}</div>}
                      <div className="text-[11px] text-slate-400">{fmtDateTime(a.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </header>
      {children}
    </section>
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
