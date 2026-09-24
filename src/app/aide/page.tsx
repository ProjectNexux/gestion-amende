import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Compass,
  LayoutGrid,
  Inbox,
  FolderCheck,
  ListChecks,
  Send,
  FileWarning,
  Building2,
  UserPlus,
  Car,
  BookOpenCheck,
  LifeBuoy,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isAdminSession } from "@/lib/auth";
import { HELP_GUIDES } from "@/lib/help-content";
import { ActionForm } from "@/components/ActionForm";
import { restartOnboardingAction } from "./actions";

export const dynamic = "force-dynamic";

// Ordre exact demandé dans le cahier des charges — "Comprendre les statuts" pointe vers le
// glossaire (page dédiée) plutôt que vers un guide pas-à-pas, les deux autres champs sont dérivés
// de HELP_GUIDES pour ne jamais désynchroniser le libellé/lien entre la liste et le contenu réel.
const ICONS: Record<string, LucideIcon> = {
  "bien-demarrer": Compass,
  "comprendre-le-tableau-de-bord": LayoutGrid,
  "recevoir-un-scan": Inbox,
  "classer-un-document": FolderCheck,
  "documents-a-classer": ListChecks,
  "transmettre-un-document-au-client": Send,
  "gerer-les-contraventions": FileWarning,
  "creer-un-client": Building2,
  "creer-et-inviter-un-compte-client": UserPlus,
  "gerer-les-conducteurs-et-vehicules": Car,
  "resoudre-les-problemes-frequents": LifeBuoy,
};

const ORDER = [
  "bien-demarrer",
  "comprendre-le-tableau-de-bord",
  "recevoir-un-scan",
  "classer-un-document",
  "documents-a-classer",
  "transmettre-un-document-au-client",
  "gerer-les-contraventions",
  "creer-un-client",
  "creer-et-inviter-un-compte-client",
  "gerer-les-conducteurs-et-vehicules",
  "__glossaire__",
  "resoudre-les-problemes-frequents",
];

export default async function AideIndexPage() {
  if (!(await isAdminSession())) redirect("/login");

  const bySlug = new Map(HELP_GUIDES.map((g) => [g.slug, g]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Assistance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Aide et assistance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Des guides pas à pas pour apprendre à utiliser l&apos;application, sans jargon technique. Chaque guide indique
            le nom exact des boutons à cliquer, le résultat attendu, et comment résoudre les blocages courants.
          </p>
        </div>
        <ActionForm action={restartOnboardingAction}>
          <button type="submit" className="btn-secondary shrink-0">
            <RotateCcw size={15} /> Relancer la visite guidée
          </button>
        </ActionForm>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((slug) => {
          if (slug === "__glossaire__") {
            return (
              <Link
                key={slug}
                href="/aide/glossaire"
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-sand-100 text-sand-600">
                  <BookOpenCheck size={17} />
                </div>
                <h2 className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  Comprendre les statuts
                  <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </h2>
                <p className="mt-1 text-sm text-slate-500">Glossaire clair de tous les statuts affichés dans l&apos;application.</p>
              </Link>
            );
          }
          const guide = bySlug.get(slug);
          if (!guide) return null;
          const Icon = ICONS[slug] ?? Compass;
          return (
            <Link
              key={slug}
              href={`/aide/${guide.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon size={17} />
              </div>
              <h2 className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                {guide.title}
                <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </h2>
              <p className="mt-1 text-sm text-slate-500">{guide.summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
