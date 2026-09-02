import { prisma } from "@/lib/prisma";
import { Eye, Megaphone } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { conserverPub, supprimerPubMaintenant } from "./actions";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPubData, pubMinutesRemaining } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PubPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const items = await prisma.courrier.findMany({
    where: isAdmin ? { type: "pub" } : { societe, type: "pub" },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pub</h1>
        <p className="text-sm text-slate-500">
          {items.length} document(s) — publicités/prospectus détectés automatiquement, supprimés au bout de 15 min sauf si conservés.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Expéditeur</th>
              <th className="p-3 text-left">Document</th>
              <th className="p-3 text-left">Suppression prévue</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const d = getPubData(item.data);
              const minutesLeft = pubMinutesRemaining(item.expiresAt);
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3 max-w-[220px] truncate" title={d.expediteur ?? ""}>{d.expediteur ?? "—"}</td>
                  <td className="p-3 max-w-[200px] truncate" title={item.fileName}>{item.fileName}</td>
                  <td className="p-3">
                    {d.conserve || !item.expiresAt ? (
                      <span className="text-emerald-600">Conservé</span>
                    ) : (
                      <span className="text-amber-600">
                        {minutesLeft !== null && minutesLeft > 0
                          ? `Suppression dans ${minutesLeft} min`
                          : "Suppression imminente"}
                        {" "}
                        <span className="text-slate-400">(à {item.expiresAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
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
                      {!d.conserve && item.expiresAt && (
                        <form action={conserverPub.bind(null, item.id)}>
                          <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            Conserver
                          </button>
                        </form>
                      )}
                      <form action={supprimerPubMaintenant.bind(null, item.id)}>
                        <ConfirmSubmitButton
                          confirmMessage="Supprimer définitivement ce document maintenant ?"
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Supprimer maintenant
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={Megaphone} title="Aucune publicité détectée" description="Les prospectus et communications commerciales détectés automatiquement apparaîtront ici avant leur suppression." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
