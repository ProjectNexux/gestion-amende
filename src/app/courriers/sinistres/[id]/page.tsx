import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye, Download } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateSinistre, deleteSinistre, addSinistreDocument } from "../actions";
import { SINISTRE_STATUTS, SINISTRE_TYPES, sinistreStatutTone, SINISTRE_HISTORIQUE_LABELS } from "@/lib/sinistres";
import { fmtMoney, fmtDateTime } from "@/lib/utils";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";

export const dynamic = "force-dynamic";

const inp = "field";
const label = "mb-1 block text-xs font-medium text-slate-500";

export default async function SinistreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const sinistre = await prisma.sinistre.findFirst({
    where: isAdmin ? { id } : { id, societe },
    include: {
      vehicule: true,
      conducteur: true,
      documents: { orderBy: { receivedAt: "desc" } },
      historique: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!sinistre) notFound();

  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ where: isAdmin ? {} : { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{sinistre.reference}</h1>
          <p className="text-sm text-slate-500">{sinistre.societe} — {sinistre.typeSinistre ?? "Type non défini"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={sinistreStatutTone(sinistre.statut)}>{sinistre.statut}</Badge>
          <Link href="/courriers/sinistres" className="btn-secondary">
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Résumé */}
        <div className="space-y-3 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Résumé du sinistre</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-medium text-slate-500">Référence interne</dt><dd className="font-mono text-slate-900">{sinistre.reference}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Société</dt><dd className="text-slate-900">{sinistre.societe}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Type</dt><dd className="text-slate-900">{sinistre.typeSinistre ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Date du sinistre</dt><dd className="text-slate-900">{sinistre.dateSinistre ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Lieu</dt><dd className="text-slate-900">{sinistre.lieuSinistre ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Origine</dt><dd className="text-slate-900">{sinistre.origine === "auto" ? "Automatique (OCR)" : "Manuel"}</dd></div>
          </dl>
          {sinistre.resume && (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{sinistre.resume}</div>
          )}
        </div>

        {/* Véhicule / conducteur + Assurance */}
        <div className="space-y-4 card p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Véhicule / conducteur</h2>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-medium text-slate-500">Véhicule</dt><dd className="font-mono text-slate-900">{sinistre.vehicule?.immatriculation ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Conducteur</dt><dd className="text-slate-900">{sinistre.conducteur ? `${sinistre.conducteur.nom} ${sinistre.conducteur.prenom}` : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Véhicule tiers</dt><dd className="text-slate-900">{sinistre.vehiculeTiers ?? "—"}</dd></div>
            </dl>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <h2 className="text-sm font-semibold text-slate-700">Assurance et intervenants</h2>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-medium text-slate-500">Assureur</dt><dd className="text-slate-900">{sinistre.assureur ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">N° dossier sinistre</dt><dd className="text-slate-900">{sinistre.referenceAssureur ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">N° contrat</dt><dd className="text-slate-900">{sinistre.numeroContrat ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Expert</dt><dd className="text-slate-900">{sinistre.expert ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Garage</dt><dd className="text-slate-900">{sinistre.garage ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Tiers</dt><dd className="text-slate-900">{sinistre.tiers ?? "—"}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Description */}
        <div className="space-y-2 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Description / circonstances</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{sinistre.description ?? "Aucune description renseignée."}</p>
          {sinistre.circonstances && <p className="whitespace-pre-wrap text-sm text-slate-500">{sinistre.circonstances}</p>}
        </div>

        {/* Montants + Échéances */}
        <div className="space-y-4 card p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Montants</h2>
            <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs font-medium text-slate-500">Estimé</dt><dd className="font-semibold text-slate-900">{fmtMoney(sinistre.montantDommage)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Réclamé</dt><dd className="font-semibold text-slate-900">{fmtMoney(sinistre.montantReclame)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Indemnisé</dt><dd className="font-semibold text-emerald-600">{fmtMoney(sinistre.montantPropose)}</dd></div>
            </dl>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <h2 className="text-sm font-semibold text-slate-700">Échéances</h2>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-medium text-slate-500">Échéance / date limite</dt><dd className="text-slate-900">{sinistre.dateLimiteReponse ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Rendez-vous d&apos;expertise</dt><dd className="text-slate-900">{sinistre.dateExpertise ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Date limite envoi documents</dt><dd className="text-slate-900">{sinistre.dateLimiteEnvoiDocs ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{sinistre.autreEcheanceLabel ?? "Autre échéance"}</dt><dd className="text-slate-900">{sinistre.autreEcheance ?? "—"}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-3 card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Documents ({sinistre.documents.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sinistre.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={doc.fileName}>{doc.fileName}</span>
              <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(doc.receivedAt)}</span>
              <div className="flex shrink-0 items-center gap-1">
                <DocumentViewerTrigger
                  fileUrl={`/api/courriers/${doc.id}`}
                  downloadUrl={`/api/courriers/${doc.id}?download=1`}
                  fileName={doc.fileName}
                  fileMime={doc.fileMime}
                  title="Visualiser"
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <Eye size={15} />
                </DocumentViewerTrigger>
                <a
                  href={`/api/courriers/${doc.id}?download=1`}
                  title="Télécharger"
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>
          ))}
          {sinistre.documents.length === 0 && <p className="py-4 text-sm text-slate-500">Aucun document rattaché à ce dossier.</p>}
        </div>
        <form action={addSinistreDocument.bind(null, sinistre.id)} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input type="file" name="fichiers" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={`${inp} max-w-sm`} />
          <button className="field w-auto font-medium text-slate-700 hover:bg-slate-50">Ajouter un document</button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Correction form */}
        <div className="space-y-3 card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Corriger les informations</h2>
            <form action={deleteSinistre.bind(null, sinistre.id)}>
              <ConfirmSubmitButton confirmMessage="Supprimer définitivement ce dossier de sinistre et ses documents ?" className="text-xs text-red-600 hover:underline">
                Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>
          <form action={updateSinistre.bind(null, sinistre.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Type de sinistre</label>
              <select name="typeSinistre" defaultValue={sinistre.typeSinistre ?? ""} className={inp}>
                <option value="">— Sélectionner —</option>
                {SINISTRE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Date du sinistre</label>
              <input name="dateSinistre" defaultValue={sinistre.dateSinistre ?? ""} placeholder="jj/mm/aaaa" className={inp} />
            </div>
            <div>
              <label className={label}>Lieu</label>
              <input name="lieuSinistre" defaultValue={sinistre.lieuSinistre ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>Véhicule</label>
              <select name="vehiculeId" defaultValue={sinistre.vehiculeId ?? ""} className={inp}>
                <option value="">— Aucun / non rattaché —</option>
                {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation}{v.marque ? ` — ${v.marque}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Conducteur</label>
              <select name="conducteurId" defaultValue={sinistre.conducteurId ?? ""} className={inp}>
                <option value="">— Non identifié —</option>
                {conducteurs.map((c) => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Assureur</label>
              <input name="assureur" defaultValue={sinistre.assureur ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>N° dossier sinistre</label>
              <input name="referenceAssureur" defaultValue={sinistre.referenceAssureur ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>N° contrat</label>
              <input name="numeroContrat" defaultValue={sinistre.numeroContrat ?? ""} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Description / circonstances</label>
              <textarea name="description" defaultValue={sinistre.description ?? ""} rows={3} className={inp} />
            </div>
            <div>
              <label className={label}>Montant estimé (€)</label>
              <input name="montantDommage" defaultValue={sinistre.montantDommage ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>Montant réclamé (€)</label>
              <input name="montantReclame" defaultValue={sinistre.montantReclame ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>Montant indemnisé (€)</label>
              <input name="montantPropose" defaultValue={sinistre.montantPropose ?? ""} className={inp} />
            </div>
            <div>
              <label className={label}>Échéance / date limite</label>
              <input name="dateLimiteReponse" defaultValue={sinistre.dateLimiteReponse ?? ""} placeholder="jj/mm/aaaa" className={inp} />
            </div>
            <div>
              <label className={label}>Statut</label>
              <select name="statut" defaultValue={sinistre.statut} className={inp}>
                {SINISTRE_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">Enregistrer</button>
            </div>
          </form>
        </div>

        {/* Historique */}
        <div className="space-y-3 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Historique</h2>
          <div className="space-y-3">
            {sinistre.historique.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{SINISTRE_HISTORIQUE_LABELS[h.action] ?? h.action}</div>
                  {h.details && <div className="text-xs text-slate-500">{h.details}</div>}
                </div>
                <div className="shrink-0 text-xs text-slate-400">{fmtDateTime(h.createdAt)}</div>
              </div>
            ))}
            {sinistre.historique.length === 0 && <p className="text-sm text-slate-500">Aucun historique pour le moment.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
