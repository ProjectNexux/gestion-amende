import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { createImpotManuelle } from "../actions";
import { ImpotForm } from "../ImpotForm";

export const dynamic = "force-dynamic";

export default async function NewImpotPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const allSocietes = await prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } });
  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [societe];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ajouter un document fiscal</h1>
          <p className="text-sm text-slate-500">Ajout manuel — origine : Manuel</p>
        </div>
        <Link href="/comptabilite/impots" className="btn-secondary">
          Retour à la liste
        </Link>
      </div>

      <div className="card p-5">
        <ImpotForm
          action={createImpotManuelle}
          societeOptions={societeOptions}
          defaultSociete={societe}
          isAdmin={isAdmin}
          fileRequired
          submitLabel="Enregistrer"
        />
      </div>
    </div>
  );
}
