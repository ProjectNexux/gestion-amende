import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateRetardPaiement, deleteRetardPaiement, demarrerPaiementCarte, marquerRembourseManuel } from "../actions";
import { getRetardPaiementData, resteAPayer, RETARD_PAIEMENT_STATUTS } from "@/lib/courriers";
import { BENEFICIAIRES } from "@/lib/payments/beneficiaries";
import { fmtMoneyCents, fmtDateTime } from "@/lib/utils";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import GenerateLinkForm from "../GenerateLinkForm";

export const dynamic = "force-dynamic";

const inp = "field";

function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "Échec de paiement") return "danger";
  if (statut === "Remboursé") return "neutral";
  if (statut === "Partiellement payé" || statut === "Paiement en attente") return "warning";
  return "neutral";
}
function paiementStatutLabel(statut: string): string {
  if (statut === "reussi") return "Payé";
  if (statut === "echec") return "Échec";
  if (statut === "abandonne") return "Abandonné";
  if (statut === "rembourse") return "Remboursé";
  return "En attente";
}
function paiementStatutTone(statut: string): BadgeTone {
  if (statut === "reussi") return "success";
  if (statut === "echec") return "danger";
  if (statut === "rembourse") return "neutral";
  return "warning";
}
function modeLabel(mode: string): string {
  if (mode === "carte") return "Carte";
  if (mode === "lien") return "Lien";
  if (mode === "qrcode") return "QR code";
  return mode;
}

export default async function RetardPaiementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const item = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe } });
  if (!item || item.type !== "retard_paiement") notFound();

  const d = getRetardPaiementData(item.data);
  const reste = resteAPayer(d);
  const resteEuros = (reste / 100).toFixed(2);

  const paiements = await prisma.paiement.findMany({
    where: { linkedType: "retard_paiement", linkedId: id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Retard de paiement</h1>
          <p className="text-sm text-slate-500">{d.debiteur} — {d.reference ?? "sans référence"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statutTone(d.statutPaiement)}>{d.statutPaiement ?? "Non payé"}</Badge>
          <Link href="/courriers/retards-paiement" className="btn-secondary">
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Informations générales</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Société bénéficiaire</dt>
              <dd className="text-slate-900">{d.beneficiaire ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Débiteur</dt>
              <dd className="text-slate-900">{d.debiteur ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Référence</dt>
              <dd className="text-slate-900">{d.reference ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Date d'échéance</dt>
              <dd className="text-slate-900">{d.dateEcheance ?? "—"}</dd>
            </div>
          </dl>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paiement</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Montant dû</dt>
                <dd className="text-base font-semibold text-slate-900">{fmtMoneyCents(d.montantDu)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Déjà payé</dt>
                <dd className="text-base font-semibold text-emerald-600">{fmtMoneyCents(d.montantPaye ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Reste à payer</dt>
                <dd className="text-base font-semibold text-amber-600">{fmtMoneyCents(reste)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Bénéficiaire</dt>
                <dd className="text-slate-900">{d.beneficiaire ?? "—"}</dd>
              </div>
            </dl>

            {reste > 0 ? (
              <form action={demarrerPaiementCarte.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Montant à encaisser (€)</label>
                  <input name="montant" defaultValue={resteEuros} className={`${inp} w-32`} />
                </div>
                <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
                  Encaisser / Faire payer
                </button>
                <span className="text-[11px] text-slate-400">Le montant ne peut jamais dépasser le reste à payer.</span>
              </form>
            ) : (
              <p className="mt-3 text-sm font-medium text-emerald-600">Dossier soldé.</p>
            )}

            {reste > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <GenerateLinkForm courrierId={id} resteEuros={resteEuros} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Corriger les informations</h2>
            <form action={deleteRetardPaiement.bind(null, id)}>
              <ConfirmSubmitButton confirmMessage="Supprimer définitivement ce retard de paiement ?" className="text-xs text-red-600 hover:underline">
                Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>
          <form action={updateRetardPaiement.bind(null, id)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Société bénéficiaire</label>
              <select name="beneficiaire" defaultValue={d.beneficiaire} className={inp}>
                {BENEFICIAIRES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Débiteur</label>
              <input name="debiteur" defaultValue={d.debiteur ?? ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Montant dû (€)</label>
              <input name="montantDu" defaultValue={d.montantDu != null ? (d.montantDu / 100).toFixed(2) : ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Référence</label>
              <input name="reference" defaultValue={d.reference ?? ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date d'échéance</label>
              <input name="dateEcheance" defaultValue={d.dateEcheance ?? ""} placeholder="31/08/2026" className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Statut paiement</label>
              <select name="statutPaiement" defaultValue={d.statutPaiement ?? "Non payé"} className={inp}>
                {RETARD_PAIEMENT_STATUTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-3 card p-5">
        <h2 className="text-sm font-semibold text-slate-700">Historique des paiements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-indigo-50/50 text-slate-600">
              <tr>
                <th className="p-2.5 text-left">Date</th>
                <th className="p-2.5 text-right">Montant</th>
                <th className="p-2.5 text-left">Mode</th>
                <th className="p-2.5 text-left">Référence</th>
                <th className="p-2.5 text-left">Statut</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td className="p-2.5">{fmtDateTime(p.createdAt)}</td>
                  <td className="p-2.5 text-right">{fmtMoneyCents(p.montant)}</td>
                  <td className="p-2.5">{modeLabel(p.mode)}</td>
                  <td className="p-2.5 font-mono text-xs">{p.providerRef ?? "—"}</td>
                  <td className="p-2.5"><Badge tone={paiementStatutTone(p.statut)}>{paiementStatutLabel(p.statut)}</Badge></td>
                  <td className="p-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.statut === "reussi" && (
                        <details className="relative inline-block text-left">
                          <summary className="cursor-pointer list-none text-xs font-medium text-brand-600 hover:underline [&::-webkit-details-marker]:hidden">
                            Voir le reçu
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                            <p className="font-semibold text-slate-700">Reçu interne (mode test)</p>
                            <p className="mt-1 text-slate-500">Paiement : {p.id}</p>
                            <p className="text-slate-500">Montant : {fmtMoneyCents(p.montant)}</p>
                            <p className="text-slate-500">Bénéficiaire : {p.societe}</p>
                            <p className="text-slate-500">Date : {fmtDateTime(p.createdAt)}</p>
                            {p.recuUrl ? (
                              <a href={p.recuUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-brand-600 hover:underline">
                                Télécharger le reçu du prestataire
                              </a>
                            ) : (
                              <p className="mt-2 text-slate-400">Aucun reçu prestataire (mode simulé) — ce reçu est un justificatif interne uniquement.</p>
                            )}
                          </div>
                        </details>
                      )}
                      {p.statut === "reussi" && isAdmin && (
                        <form action={marquerRembourseManuel.bind(null, p.id)}>
                          <ConfirmSubmitButton confirmMessage="Marquer ce paiement comme remboursé ?" className="text-xs text-red-600 hover:underline">
                            Rembourser
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paiements.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">Aucun paiement pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
