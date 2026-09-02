import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { fmtMoney } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ArrowLeft, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

function statutTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "En retard") return "danger";
  if (statut === "En attente") return "warning";
  return "neutral";
}

export default async function ClientContraventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();

  // Single query enforces both rules at once — société match AND visibleClient — a client can
  // never reach another société's dossier, nor one an admin hasn't explicitly shared, no matter
  // what id is typed in the URL.
  const item = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
    include: { vehicule: true },
  });
  if (!item) notFound();

  const scan = await prisma.emailScan.findFirst({ where: { contraventionId: item.id }, select: { id: true, fileName: true, fileMime: true } });

  return (
    <div className="space-y-6">
      <Link href="/client/contraventions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Retour à mes contraventions
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{item.numDossier}</h2>
          <p className="text-sm text-slate-500">{item.vehicule?.immatriculation ?? item.immatriculationOcr ?? "Véhicule non renseigné"}</p>
        </div>
        <Badge tone={statutTone(item.statutPaiement)}>{item.statutPaiement ?? "—"}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-medium text-slate-500">Référence</dt><dd className="font-mono text-slate-900">{item.numDossier}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">N° Avis</dt><dd className="font-mono text-slate-900">{item.numAvis ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Date</dt><dd className="text-slate-900">{item.dateInfraction ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Type d&apos;infraction</dt><dd className="text-slate-900">{item.natureInfraction ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Véhicule</dt><dd className="text-slate-900">{item.vehicule?.immatriculation ?? item.immatriculationOcr ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Montant</dt><dd className="font-semibold text-slate-900">{fmtMoney(item.montantAmende)}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Échéance</dt><dd className="text-slate-900">{item.dateLimitePaiement ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Statut</dt><dd><Badge tone={statutTone(item.statutPaiement)}>{item.statutPaiement ?? "—"}</Badge></dd></div>
          </dl>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Document</h3>
          {scan ? (
            <>
              <p className="text-sm text-slate-600">{scan.fileName}</p>
              <div className="flex flex-wrap gap-2">
                <DocumentViewerTrigger
                  fileUrl={`/api/client/contraventions/${item.id}/document`}
                  downloadUrl={`/api/client/contraventions/${item.id}/document?download=1`}
                  fileName={scan.fileName}
                  fileMime={scan.fileMime}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
                >
                  <Eye size={15} /> Visualiser le document
                </DocumentViewerTrigger>
                <a href={`/api/client/contraventions/${item.id}/document?download=1`} className="btn-secondary">
                  Télécharger
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Aucun document disponible pour ce dossier.</p>
          )}
        </div>
      </div>
    </div>
  );
}
