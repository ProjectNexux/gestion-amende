import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { courrierTypeLabel } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { Eye, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientCourriersPage() {
  const societe = await requireSociete();

  // Same double filter as everywhere in the client portal: société AND visibleClient. Excludes
  // the client's own "client_envoi" submissions on purpose — those live under "Documents envoyés",
  // to avoid mixing "what we shared with you" and "what you sent us" in the same list.
  const items = await prisma.courrier.findMany({
    where: { societe, visibleClient: true, type: { not: "client_envoi" } },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Mes courriers" description={`${items.length} document(s) partagé(s) par notre équipe`} />

      {items.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Aucun courrier partagé pour le moment"
          description="Les documents que notre équipe partage avec vous apparaîtront ici."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Nom du fichier</th>
                <th className="p-3 text-left">Reçu le</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3"><Badge tone="neutral">{courrierTypeLabel(item.type)}</Badge></td>
                  <td className="p-3 max-w-xs truncate" title={item.fileName}>{item.fileName}</td>
                  <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3 text-right">
                    <DocumentViewerTrigger
                      fileUrl={`/api/client/courriers/${item.id}/document`}
                      downloadUrl={`/api/client/courriers/${item.id}/document?download=1`}
                      fileName={item.fileName}
                      fileMime={item.fileMime}
                      title="Visualiser"
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Eye size={15} />
                    </DocumentViewerTrigger>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
