import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, Pencil, Trash2, Paperclip, IdCard } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { createCertificat, deleteCertificat } from "./actions";
import AddCertificatPanel from "./AddCertificatPanel";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getImmatriculation } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CertificatsImmatriculationPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [items, allSocietes] = await Promise.all([
    prisma.courrier.findMany({
      where: isAdmin ? { type: "certificat_immatriculation" } : { societe, type: "certificat_immatriculation" },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [societe];

  return (
    <div className="space-y-6">
      <AddCertificatPanel action={createCertificat} societeOptions={societeOptions} defaultSociete={societe} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Immatriculation</th>
              <th className="p-3 text-left">Pièce jointe</th>
              <th className="p-3 text-left">Date d&apos;ajout</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{item.societe}</td>
                <td className="p-3 font-mono text-xs">{getImmatriculation(item.data) || "—"}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Paperclip size={13} className="shrink-0 text-slate-400" />
                    <span className="max-w-[200px] truncate" title={item.fileName}>{item.fileName}</span>
                  </span>
                </td>
                <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
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
                    <Link
                      href={`/courriers/certificats-immatriculation/${item.id}`}
                      title="Modifier"
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Pencil size={15} />
                    </Link>
                    <form action={deleteCertificat.bind(null, item.id)}>
                      <ConfirmSubmitButton
                        confirmMessage="Supprimer définitivement ce certificat d'immatriculation ?"
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={IdCard}
                    title="Aucun certificat d'immatriculation"
                    description="Ajoutez la carte grise d'un véhicule pour la conserver ici."
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
