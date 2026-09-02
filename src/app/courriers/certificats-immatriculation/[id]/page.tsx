import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateCertificat, deleteCertificat } from "../actions";
import { getImmatriculation } from "@/lib/courriers";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

const inp = "field";

export default async function CertificatImmatriculationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [item, allSocietes] = await Promise.all([
    prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe } }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  if (!item) notFound();

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [item.societe];
  const immatriculation = getImmatriculation(item.data);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier le certificat</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <Link href="/courriers/certificats-immatriculation" className="btn-secondary">
          Retour à la liste
        </Link>
      </div>

      <div className="space-y-4 card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DocumentViewerTrigger
            fileUrl={`/api/courriers/${item.id}`}
            downloadUrl={`/api/courriers/${item.id}?download=1`}
            fileName={item.fileName}
            fileMime={item.fileMime}
            className="btn-secondary"
          >
            <Eye size={15} /> Visualiser le document
          </DocumentViewerTrigger>
          <form action={deleteCertificat.bind(null, item.id)}>
            <ConfirmSubmitButton confirmMessage="Supprimer définitivement ce certificat d'immatriculation ?" className="text-sm text-red-600 hover:underline">
              Supprimer
            </ConfirmSubmitButton>
          </form>
        </div>

        <form action={updateCertificat.bind(null, item.id)} className="space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nom de la société</label>
            {isAdmin ? (
              <select name="societe" defaultValue={item.societe} className={inp}>
                {societeOptions.map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="societe" value={item.societe} />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Plaque d&apos;immatriculation</label>
            <input name="immatriculation" defaultValue={immatriculation} placeholder="AB-123-CD" className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Remplacer la pièce jointe (optionnel)</label>
            <input type="file" name="fichier" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={inp} />
          </div>
          <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
