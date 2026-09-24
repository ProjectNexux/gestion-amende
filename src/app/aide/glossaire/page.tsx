import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { isAdminSession } from "@/lib/auth";
import { STATUS_GLOSSARY } from "@/lib/help-content";

export const dynamic = "force-dynamic";

export default async function AideGlossairePage() {
  if (!(await isAdminSession())) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/aide" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Retour au centre d&apos;aide
      </Link>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Glossaire</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-900">
          <BookOpenCheck size={26} className="text-brand-600" /> Comprendre les statuts
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Chaque statut affiché dans l&apos;application est expliqué ici en langage clair, avec les pages où vous le
          croiserez.
        </p>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {STATUS_GLOSSARY.map((entry) => (
          <div key={entry.label} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-start sm:gap-6">
            <div className="shrink-0 sm:w-56">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{entry.label}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-700">{entry.meaning}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">Où le voir : {entry.appliesTo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
