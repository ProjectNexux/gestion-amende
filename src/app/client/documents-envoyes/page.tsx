import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { getClientEnvoiData } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { Eye, Send } from "lucide-react";
import { EnvoyerDocumentButton } from "./EnvoyerDocumentModal";

export const dynamic = "force-dynamic";

function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Traité") return "success";
  if (statut === "Vu") return "info";
  return "warning"; // Nouveau
}

export default async function DocumentsEnvoyesPage() {
  const societe = await requireSociete();

  const items = await prisma.courrier.findMany({
    where: { societe, source: "CLIENT" },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents envoyés"
        description="Les documents que vous avez transmis à notre équipe, et leur statut de traitement."
        actions={<EnvoyerDocumentButton />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Aucun document envoyé pour le moment"
          description="Utilisez « Envoyer un document » pour transmettre un fichier à notre équipe."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-left">Titre / objet</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Référence</th>
                <th className="p-3 text-left">Envoyé le</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const d = getClientEnvoiData(item.data);
                return (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 max-w-xs truncate font-medium text-slate-800" title={d.titre ?? ""}>{d.titre ?? item.fileName}</td>
                    <td className="p-3">{d.typeDocument ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{d.reference ?? "—"}</td>
                    <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                    <td className="p-3"><Badge tone={statutTone(d.statut)}>{d.statut ?? "Nouveau"}</Badge></td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
