import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { getVisibleSocieteFilter } from "@/lib/org-scope";
import { courrierTypeLabel, courrierSourceLabel, COURRIER_LIST_SELECT } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { Badge } from "@/components/ui/Badge";
import { TransmettreClientButton } from "@/components/TransmettreClientModal";
import type { TransmissionClientInfo } from "@/app/courriers/actions";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function GenericCourrierPage({ params }: { params: Promise<{ id: string }> }) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const { id } = await params;

  const item = await prisma.courrier.findFirst({
    where: { id, ...(await getVisibleSocieteFilter()) },
    select: COURRIER_LIST_SELECT,
  });
  if (!item) notFound();

  const originalScan = await prisma.emailScan.findFirst({
    where: { courrierId: item.id },
    select: { id: true, fileName: true, fileMime: true, status: true, errorMessage: true, processedAt: true, updatedAt: true, origine: true },
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Courriers", href: "/courriers" }, { label: courrierTypeLabel(item.type) }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{courrierTypeLabel(item.type)}</h1>
          <p className="mt-1 text-sm text-slate-500">{item.fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{courrierSourceLabel(item.source)}</Badge>
          <Badge tone="info">{item.societe}</Badge>
          {isAdmin && (
            <TransmettreClientButton
              id={item.id}
              fileName={item.fileName}
              fileMime={item.fileMime}
              currentType={item.type}
              detectedSociete={item.societe}
              transmission={(item.data as Record<string, unknown> | null)?.transmissionClient as TransmissionClientInfo | undefined ?? null}
            />
          )}
          <BackButton fallbackHref="/courriers" label="Retour à la liste" className="btn-secondary" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Document original</h2>
              <p className="text-xs text-slate-500">Visualisation et téléchargement du fichier conservé.</p>
            </div>
            <div className="flex items-center gap-2">
              <DocumentViewerTrigger
                fileUrl={`/api/courriers/${item.id}`}
                downloadUrl={`/api/courriers/${item.id}?download=1`}
                fileName={item.fileName}
                fileMime={item.fileMime}
                title="Visualiser"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Visualiser
              </DocumentViewerTrigger>
              <a href={`/api/courriers/${item.id}?download=1`} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Télécharger</a>
            </div>
          </div>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(item.data, null, 2)}</pre>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Informations</h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Reçu le</dt>
                <dd className="text-slate-900">{fmtDateTime(item.receivedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Type</dt>
                <dd className="text-slate-900">{courrierTypeLabel(item.type)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Source</dt>
                <dd className="text-slate-900">{courrierSourceLabel(item.source)}</dd>
              </div>
              {originalScan && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Scan lié</dt>
                  <dd className="text-slate-900">{originalScan.fileName} — {originalScan.status}</dd>
                </div>
              )}
            </dl>
          </div>

          {originalScan && (
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Scan d’origine</h2>
              <p className="mt-1 text-xs text-slate-500">Statut du scan conservé dans la file.</p>
              <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{originalScan.fileName}</div>
                    <div className="text-xs text-slate-500">{originalScan.status}</div>
                  </div>
                  <a href="/courriers" className="text-xs font-medium text-brand-700 hover:underline">Retour à la liste</a>
                </div>
                {originalScan.errorMessage && <div className="mt-2 text-xs text-amber-700">{originalScan.errorMessage}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
