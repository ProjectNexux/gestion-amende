import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateImpotManuelle } from "../../actions";
import { ImpotForm } from "../../ImpotForm";
import { getImpotData } from "@/lib/comptabilite";

export const dynamic = "force-dynamic";

function toIsoDate(v?: string | null): string {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export default async function EditImpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [item, allSocietes] = await Promise.all([
    prisma.courrier.findFirst({ where: isAdmin ? { id, type: "impot" } : { id, societe, type: "impot" } }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  if (!item) notFound();

  const d = getImpotData(item.data);
  if (d.origine !== "manuel") redirect(`/comptabilite/impots/${id}`);

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [item.societe];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier le document fiscal</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <Link href={`/comptabilite/impots/${id}`} className="btn-secondary">
          Retour à la fiche
        </Link>
      </div>

      <div className="card p-5">
        <ImpotForm
          action={updateImpotManuelle.bind(null, id)}
          societeOptions={societeOptions}
          defaultSociete={item.societe}
          isAdmin={isAdmin}
          fileRequired={false}
          submitLabel="Enregistrer"
          defaults={{
            societe: item.societe,
            organisme: d.organisme,
            typeDocument: d.typeDocument,
            reference: d.reference,
            dateDocument: toIsoDate(d.dateDocument),
            echeance: toIsoDate(d.echeance),
            montant: d.montant,
            periodeConcernee: d.periodeConcernee,
            commentaire: d.commentaire,
          }}
        />
      </div>
    </div>
  );
}
