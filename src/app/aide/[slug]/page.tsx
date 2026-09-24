import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, ListOrdered } from "lucide-react";
import { isAdminSession } from "@/lib/auth";
import { getHelpGuide, HELP_GUIDES } from "@/lib/help-content";

export const dynamic = "force-dynamic";

export default async function AideGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdminSession())) redirect("/login");

  const { slug } = await params;
  const guide = getHelpGuide(slug);
  if (!guide) notFound();

  const index = HELP_GUIDES.findIndex((g) => g.slug === slug);
  const previous = index > 0 ? HELP_GUIDES[index - 1] : null;
  const next = index >= 0 && index < HELP_GUIDES.length - 1 ? HELP_GUIDES[index + 1] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/aide" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Retour au centre d&apos;aide
      </Link>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Guide pas à pas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{guide.title}</h1>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-brand-700">Objectif</h2>
        <p className="mt-1.5 text-sm text-slate-700">{guide.objectif}</p>
      </div>

      {guide.etapes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ListOrdered size={16} className="text-brand-600" /> Étapes
          </h2>
          <ol className="mt-3 space-y-3">
            {guide.etapes.map((etape, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                <span className="pt-0.5">{etape}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <CheckCircle2 size={15} /> Résultat attendu
        </h2>
        <p className="mt-1.5 text-sm text-emerald-900">{guide.resultatAttendu}</p>
      </div>

      {guide.problemes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <AlertTriangle size={16} className="text-amber-600" /> Problèmes possibles &amp; solutions
          </h2>
          <div className="mt-3 space-y-3">
            {guide.problemes.map((p, i) => (
              <div key={i} className="rounded-xl bg-amber-50/70 p-3.5">
                <p className="text-sm font-medium text-slate-800">{p.probleme}</p>
                <p className="mt-1 text-sm text-slate-600">→ {p.solution}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href={guide.pageLink.href} className="btn-primary inline-flex w-fit">
        {guide.pageLink.label} <ArrowRight size={15} />
      </Link>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
        {previous ? (
          <Link href={`/aide/${previous.slug}`} className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> {previous.title}
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/aide/${next.slug}`} className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800">
            {next.title} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
