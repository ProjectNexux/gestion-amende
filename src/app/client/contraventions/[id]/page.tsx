import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { fmtMoney } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ArrowLeft, Eye, ExternalLink } from "lucide-react";
import { ClientContraventionActions } from "./ClientContraventionActions";

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

  const scan = await prisma.emailScan.findFirst({ where: { contraventionId: item.id }, select: { id: true, fileName: true, fileMime: true } });
  const conducteurs = await prisma.conducteur.findMany({ 
    where: { societe },
    orderBy: { nom: "asc" },
  });

  return (
    <div className="space-y-6">
      <Link href="/client/contraventions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Retour à mes contraventions
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{item.numDossier}</h2>
          <p className="text-sm text-slate-500">N° Avis: {item.numAvis ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={statutTone(item.statutDenonciation)}>
            {item.statutDenonciation}
          </Badge>
          <Badge tone={statutTone(item.statutPaiement)}>
            {item.statutPaiement}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Infos rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <h3 className="font-semibold text-sm mb-4">Détails de l'infraction</h3>
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
              <h3 className="font-semibold text-sm mb-3">Avis de contravention</h3>
              <p className="text-sm text-slate-600 mb-3">{scan.fileName}</p>
              <div className="flex flex-wrap gap-2">
                <DocumentViewerTrigger
                  fileUrl={`/api/client/contraventions/${item.id}/document`}
                  downloadUrl={`/api/client/contraventions/${item.id}/document?download=1`}
                  fileName={scan.fileName}
                  fileMime={scan.fileMime}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
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
            <h3 className="font-semibold text-sm mb-4">Conducteur impliqué</h3>
            {item.conducteur ? (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
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
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          {/* Paiement */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">Paiement</h3>
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

          {/* Dénonciation */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">Dénonciation</h3>
            <div className="text-sm">
              <div className="flex justify-between mb-3">
                <span className="text-slate-600">Statut</span>
                <Badge tone={statutTone(item.statutDenonciation)}>{item.statutDenonciation}</Badge>
              </div>
            </div>
            {item.statutDenonciation !== "Effectuée" && item.statutDenonciation !== "Non applicable" && (
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

          {/* Info légale */}
          <div className="card p-4">
            <p className="text-xs text-slate-600 mb-3">
              Pour dénoncer ou payer en ligne, visitez le site officiel de l'ANTAI
            </p>
            <a
              href="https://www.antai.gouv.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-700 font-medium text-sm hover:underline"
            >
              <ExternalLink size={14} /> Site ANTAI officiel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
