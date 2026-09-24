import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isSuperAdminSession } from "@/lib/org-scope";
import { NewOrganizationForm } from "./NewOrganizationForm";

export const dynamic = "force-dynamic";

export default async function NouvelleOrganisationPage() {
  if (!(await isSuperAdminSession())) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/plateforme" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Retour aux organisations
      </Link>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Plateforme</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Créer une organisation</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Initialise un espace totalement vide et isolé pour une nouvelle société gestionnaire — aucune donnée de NetEco
          n&apos;y est jamais copiée. Le propriétaire recevra une invitation pour créer son mot de passe ; la réception des
          scans se configure ensuite depuis « Mon organisation ».
        </p>
      </div>
      <NewOrganizationForm />
    </div>
  );
}
