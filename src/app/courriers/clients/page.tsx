import { prisma } from "@/lib/prisma";
import { Eye, MailOpen } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientEnvoiData } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { updateClientEnvoiStatutAction } from "./actions";
import { StatutSelect } from "./StatutSelect";

export const dynamic = "force-dynamic";

export default async function CourriersClientsPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const items = await prisma.courrier.findMany({
    where: isAdmin ? { source: "CLIENT" } : { societe, source: "CLIENT" },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents reçus des clients"
        description="Documents envoyés directement par les sociétés depuis leur espace client."
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Titre / objet</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Référence</th>
              <th className="p-3 text-left">Reçu le</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const d = getClientEnvoiData(item.data);
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-medium">{item.societe}</td>
                  <td className="p-3 max-w-xs truncate" title={d.titre ?? ""}>{d.titre ?? item.fileName}</td>
                  <td className="p-3">{d.typeDocument ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{d.reference ?? "—"}</td>
                  <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3">
                    <StatutSelect id={item.id} defaultValue={d.statut ?? "Nouveau"} action={updateClientEnvoiStatutAction} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {d.message && <span className="max-w-[160px] truncate text-xs text-slate-400" title={d.message}>{d.message}</span>}
                      <DocumentViewerTrigger
                        fileUrl={`/api/courriers/${item.id}`}
                        downloadUrl={`/api/courriers/${item.id}?download=1`}
                        fileName={item.fileName}
                        fileMime={item.fileMime}
                        title="Visualiser"
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Eye size={15} />
                      </DocumentViewerTrigger>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={MailOpen}
                    title="Aucun document reçu d'un client pour le moment"
                    description="Les documents envoyés par les sociétés depuis leur espace client apparaîtront ici."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
