import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateFactureManuelle } from "../../actions";
import { FactureForm } from "../../FactureForm";
import { getFactureData } from "@/lib/comptabilite";

export const dynamic = "force-dynamic";

// "DD/MM/YYYY" (the format both entry methods store) -> "YYYY-MM-DD" for <input type="date">.
function toIsoDate(v?: string | null): string {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export default async function EditFacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [item, allSocietes] = await Promise.all([
    prisma.courrier.findFirst({ where: isAdmin ? { id, type: "facture" } : { id, societe, type: "facture" } }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  if (!item) notFound();

  const d = getFactureData(item.data);
  // Only manually-created documents can be edited — automatically detected ones stay read-only.
  if (d.origine !== "manuel") redirect(`/comptabilite/factures/${id}`);

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [item.societe];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier la facture</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <Link href={`/comptabilite/factures/${id}`} className="btn-secondary">
          Retour à la fiche
        </Link>
      </div>

      <div className="card p-5">
        <FactureForm
          action={updateFactureManuelle.bind(null, id)}
          societeOptions={societeOptions}
          defaultSociete={item.societe}
          isAdmin={isAdmin}
          fileRequired={false}
          submitLabel="Enregistrer"
          defaults={{
            societe: item.societe,
            emetteur: d.emetteur,
            numeroFacture: d.reference,
            dateDocument: toIsoDate(d.dateDocument),
            echeance: toIsoDate(d.echeance),
            montantHT: d.montantHT,
            tva: d.tva,
            montantTTC: d.montantTTC ?? d.montant,
            devise: d.devise,
            referenceCommande: d.referenceCommande,
            commentaire: d.commentaire,
          }}
        />
      </div>
    </div>
  );
}
