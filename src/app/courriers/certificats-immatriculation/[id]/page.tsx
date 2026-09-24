import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { getVisibleSocieteFilter, getVisibleSocieteNames } from "@/lib/org-scope";
import { updateCertificat, deleteCertificat } from "../actions";
import { getImmatriculation } from "@/lib/courriers";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TransmettreClientButton } from "@/components/TransmettreClientModal";
import type { TransmissionClientInfo } from "@/app/courriers/actions";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const dynamic = "force-dynamic";

const inp = "field";

export default async function CertificatImmatriculationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [item, allSocietes] = await Promise.all([
    prisma.courrier.findFirst({ where: { id, ...(await getVisibleSocieteFilter()) } }),
    (async () => {
      const names = await getVisibleSocieteNames();
      return prisma.societe.findMany({
        where: names === "all-own-societe" ? { nom: societe } : { nom: { in: names } },
        orderBy: { nom: "asc" },
        select: { nom: true },
      });
    })(),
  ]);
  if (!item) notFound();

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [item.societe];
  const immatriculation = getImmatriculation(item.data);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Courriers", href: "/courriers" }, { label: "Certificats d'immatriculation", href: "/courriers/certificats-immatriculation" }, { label: immatriculation || "Détail" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier le certificat</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <div className="flex items-center gap-2">
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
          <BackButton fallbackHref="/courriers/certificats-immatriculation" label="Retour à la liste" className="btn-secondary" />
        </div>
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
