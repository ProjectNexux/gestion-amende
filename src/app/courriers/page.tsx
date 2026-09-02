import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, Paperclip, Inbox } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { Badge, documentTypeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { courrierTypeLabel, courrierSourceLabel, getMiseEnDemeureData, getPubData, pubMinutesRemaining } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { toggleCourrierVisibleClientAction } from "./actions";

export const dynamic = "force-dynamic";

// Central, read-only log of every document received/added, whatever its type. Each row also
// links to its type-specific page (e.g. Mise en demeure) when one exists.
const DETAIL_PATH: Record<string, (id: string) => string> = {
  certificat_immatriculation: (id) => `/courriers/certificats-immatriculation/${id}`,
  mise_en_demeure: (id) => `/courriers/mise-en-demeure/${id}`,
  pub: () => `/courriers/pub`,
  facture: (id) => `/comptabilite/factures/${id}`,
  impot: (id) => `/comptabilite/impots/${id}`,
};

export default async function CourriersPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const items = await prisma.courrier.findMany({
    where: isAdmin ? {} : { societe },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tous les documents</h1>
        <p className="text-sm text-slate-500">{items.length} document(s) reçu(s), tous types confondus</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Origine</th>
              <th className="p-3 text-left">Date de réception</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-left">Pièce jointe</th>
              {isAdmin && <th className="p-3 text-left">Visible client</th>}
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const href = DETAIL_PATH[item.type]?.(item.id);
              const statut = item.type === "mise_en_demeure" ? getMiseEnDemeureData(item.data).statut : null;
              const pub = item.type === "pub" ? getPubData(item.data) : null;
              const pubMinutes = pub ? pubMinutesRemaining(item.expiresAt) : null;
              const typeDetecte =
                item.type === "document" && item.data && typeof item.data === "object" && "typeDetecte" in item.data
                  ? ((item.data as Record<string, unknown>).typeDetecte as string | null)
                  : null;
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {href ? (
                        <Link href={href}>
                          <Badge tone={documentTypeTone(courrierTypeLabel(item.type))} className="hover:ring-2">{courrierTypeLabel(item.type)}</Badge>
                        </Link>
                      ) : (
                        <Badge tone={documentTypeTone(courrierTypeLabel(item.type))}>{courrierTypeLabel(item.type)}</Badge>
                      )}
                      {pub && <Badge tone="neutral">Pub</Badge>}
                    </div>
                    {pub && !pub.conserve && pubMinutes !== null && (
                      <div className="mt-0.5 text-[11px] text-amber-600">Suppression automatique dans {pubMinutes} min</div>
                    )}
                    {typeDetecte && (
                      <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-slate-500" title={typeDetecte}>{typeDetecte}</div>
                    )}
                  </td>
                  <td className="p-3">{item.societe}</td>
                  <td className="p-3">
                    <Badge tone={item.source === "CLIENT" ? "info" : "neutral"}>{courrierSourceLabel(item.source)}</Badge>
                  </td>
                  <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3">{statut ? <Badge tone="neutral">{statut}</Badge> : "—"}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Paperclip size={13} className="shrink-0 text-slate-400" />
                      <span className="max-w-[200px] truncate" title={item.fileName}>{item.fileName}</span>
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3">
                      <form action={toggleCourrierVisibleClientAction.bind(null, item.id, !item.visibleClient)}>
                        <button
                          type="submit"
                          className={
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition " +
                            (item.visibleClient
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100")
                          }
                          title="Visible par le client"
                        >
                          <span className={"h-1.5 w-1.5 rounded-full " + (item.visibleClient ? "bg-emerald-500" : "bg-slate-400")} />
                          {item.visibleClient ? "Visible" : "Masquée"}
                        </button>
                      </form>
                    </td>
                  )}
                  <td className="p-3 text-right">
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
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6}>
                  <EmptyState icon={Inbox} title="Aucun document pour le moment" description="Tous les courriers reçus ou ajoutés apparaîtront ici, quel que soit leur type." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
