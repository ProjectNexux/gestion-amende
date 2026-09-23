import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { fmtMoney, fmtDateTime } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ArrowLeft, Eye, ExternalLink, History } from "lucide-react";
import { ClientContraventionActions } from "./ClientContraventionActions";
import { FavoriToggle } from "./FavoriToggle";
import { IdentiteUploadForms } from "./IdentiteUploadForms";
import { EnvoyerDocumentButton } from "../../documents-envoyes/EnvoyerDocumentModal";

export const dynamic = "force-dynamic";

function statutTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "En retard") return "danger";
  if (statut === "En attente") return "warning";
  if (statut === "Effectuée") return "success";
  if (statut === "À effectuer") return "warning";
  return "neutral";
}

export default async function ClientContraventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();

  const item = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
    include: { vehicule: true, conducteur: true },
  });
  if (!item) notFound();

  const [scan, conducteurs, favori, justificatifs] = await Promise.all([
    prisma.emailScan.findFirst({ where: { contraventionId: item.id }, select: { id: true, fileName: true, fileMime: true } }),
    prisma.conducteur.findMany({ where: { societe }, orderBy: { nom: "asc" } }),
    prisma.favori.findFirst({ where: { societe, itemType: "contravention", itemId: item.id } }),
    prisma.courrier.findMany({ where: { societe, type: "client_envoi" }, select: { receivedAt: true, data: true } }),
  ]);

  const historique: { label: string; date: Date }[] = [{ label: "Dossier transmis par notre équipe", date: item.createdAt }];
  if (item.dateDenonciation) historique.push({ label: "Dénonciation signalée comme effectuée", date: new Date(item.updatedAt) });
  if (item.datePaiement) historique.push({ label: "Paiement signalé comme effectué", date: new Date(item.updatedAt) });
  for (const j of justificatifs) {
    const relatedId = (j.data as { relatedContraventionId?: string } | null)?.relatedContraventionId;
    if (relatedId === item.id) historique.push({ label: "Justificatif ajouté par vos soins", date: j.receivedAt });
  }
  historique.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="space-y-6">
      <Link href="/client/contraventions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Retour à mes contraventions
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{item.numDossier}</h2>
            <p className="text-sm text-slate-500">N° Avis: {item.numAvis ?? "—"}</p>
          </div>
          <FavoriToggle itemId={item.id} initialFavori={!!favori} />
        </div>
        <div className="flex gap-2">
          <Badge tone={statutTone(item.statutDenonciation)}>{item.statutDenonciation}</Badge>
          <Badge tone={statutTone(item.statutPaiement)}>{item.statutPaiement}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Infos rapides */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card p-3">
              <div className="text-xs text-slate-500">Date</div>
              <div className="font-semibold text-slate-900">{item.dateInfraction ?? "—"}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-500">Montant</div>
              <div className="font-semibold text-slate-900">{fmtMoney(item.montantAmende)}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-500">Échéance</div>
              <div className="font-semibold text-slate-900">{item.dateLimitePaiement ?? "—"}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-500">Véhicule</div>
              <div className="font-semibold text-slate-900">{item.vehicule?.immatriculation ?? item.immatriculationOcr ?? "—"}</div>
            </div>
          </div>

          {/* Détails infraction */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold">Détails de l&apos;infraction</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Nature</dt>
                <dd className="font-medium text-slate-900">{item.natureInfraction ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Lieu</dt>
                <dd className="font-medium text-slate-900">{item.lieuInfraction ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Vitesse constatée</dt>
                <dd className="font-medium text-slate-900">{item.vitesseConstatee ?? "—"} km/h</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Vitesse autorisée</dt>
                <dd className="font-medium text-slate-900">{item.vitesseAutorisee ?? "—"} km/h</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Points retirés</dt>
                <dd className="font-medium text-slate-900">{item.pointsRetires ?? 0}</dd>
              </div>
            </dl>
          </div>

          {/* Document */}
          {scan && (
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Avis de contravention</h3>
                <EnvoyerDocumentButton
                  context={{ contraventionId: item.id, dossierLabel: item.numDossier }}
                  label="Ajouter un justificatif"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                />
              </div>
              <p className="mb-3 text-sm text-slate-600">{scan.fileName}</p>
              <div className="flex flex-wrap gap-2">
                <DocumentViewerTrigger
                  fileUrl={`/api/client/contraventions/${item.id}/document`}
                  downloadUrl={`/api/client/contraventions/${item.id}/document?download=1`}
                  fileName={scan.fileName}
                  fileMime={scan.fileMime}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  <Eye size={15} /> Visualiser
                </DocumentViewerTrigger>
                <a href={`/api/client/contraventions/${item.id}/document?download=1`} className="btn-secondary text-sm">
                  Télécharger
                </a>
              </div>
            </div>
          )}

          {/* Formulaire conducteur */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold">Conducteur impliqué</h3>
            {item.conducteur ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-900">
                  ✓ Conducteur identifié: <strong>{item.conducteur.prenom} {item.conducteur.nom}</strong>
                </p>
              </div>
            ) : (
              <ClientContraventionActions
                id={id}
                conducteurId={item.conducteurId}
                conducteur={item.conducteur}
                conducteurs={conducteurs}
                statutDenonciation={item.statutDenonciation}
                statutPaiement={item.statutPaiement}
              />
            )}
          </div>

          {/* Permis / pièce d'identité du conducteur */}
          {item.conducteur && (
            <IdentiteUploadForms conducteur={item.conducteur} contraventionId={item.id} />
          )}

          {/* Historique */}
          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><History size={15} className="text-teal-600" /> Historique du dossier</h3>
            <ul className="space-y-2 text-sm">
              {historique.map((h, i) => (
                <li key={i} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-slate-700">{h.label}</span>
                  <span className="text-xs text-slate-400">{fmtDateTime(h.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          {/* Paiement */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">Paiement</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Statut</span>
                <Badge tone={statutTone(item.statutPaiement)}>{item.statutPaiement}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Montant</span>
                <span className="font-semibold">{fmtMoney(item.montantAmende)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Échéance</span>
                <span className="font-semibold">{item.dateLimitePaiement ?? "—"}</span>
              </div>
            </div>
            {item.statutPaiement !== "Payé" && (
              <div className="mt-3">
                <ClientContraventionActions
                  id={id}
                  conducteurId={item.conducteurId}
                  conducteur={item.conducteur}
                  conducteurs={conducteurs}
                  statutDenonciation={item.statutDenonciation}
                  statutPaiement={item.statutPaiement}
                  onlyPaymentAndDenonciation
                />
              </div>
            )}
          </div>

          {/* Dénonciation */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">Dénonciation</h3>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-600">Statut</span>
              <Badge tone={statutTone(item.statutDenonciation)}>{item.statutDenonciation}</Badge>
            </div>
            {item.statutDenonciation !== "Effectuée" && item.statutDenonciation !== "Non applicable" && (
              <ClientContraventionActions
                id={id}
                conducteurId={item.conducteurId}
                conducteur={item.conducteur}
                conducteurs={conducteurs}
                statutDenonciation={item.statutDenonciation}
                statutPaiement={item.statutPaiement}
                onlyPaymentAndDenonciation
              />
            )}
          </div>

          {/* Info légale */}
          <div className="card p-4">
            <p className="mb-3 text-xs text-slate-600">Pour dénoncer ou payer en ligne, visitez le site officiel de l&apos;ANTAI</p>
            <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline">
              <ExternalLink size={14} /> Site ANTAI officiel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
