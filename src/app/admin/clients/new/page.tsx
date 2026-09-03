import { isAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewClientWizard from "./NewClientWizard";
import { createClientAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  if (!(await isAdminSession())) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div>
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Retour à la liste
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Ajouter un client</h1>
        <p className="text-sm text-slate-500">Créez une société cliente à partir de son SIRET. Les informations officielles sont récupérées automatiquement.</p>
      </div>

      <NewClientWizard action={createClientAction} />
    </div>
  );
}
