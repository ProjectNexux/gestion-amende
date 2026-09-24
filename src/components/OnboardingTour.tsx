"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X, type LucideIcon } from "lucide-react";
import { LayoutGrid, Inbox, FileWarning, Building2, LifeBuoy, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { advanceOnboardingStepAction, finishOnboardingAction } from "@/app/aide/actions";

type Slide = { icon: LucideIcon; title: string; body: string; cta?: { label: string; href: string } };

// Contenu 100% statique, aucune donnée réelle ni chiffre affiché ici (une visite guidée ne doit
// jamais fabriquer un chiffre) — seulement une présentation des grandes zones de l'application.
const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    title: "Bienvenue dans ScanAppAmendes",
    body: "Cette courte visite vous présente les grandes zones de l'application en moins d'une minute. Vous pouvez la passer à tout moment et la relancer plus tard depuis « Aide et assistance ».",
  },
  {
    icon: LayoutGrid,
    title: "La Vue d'ensemble",
    body: "C'est la page affichée après connexion. Les cartes en haut résument ce qui nécessite votre attention (documents à classer, dossiers urgents, échéances proches) — chacune ouvre la liste correspondante.",
    cta: { label: "Ouvrir la Vue d'ensemble", href: "/" },
  },
  {
    icon: Inbox,
    title: "Recevoir et classer un document",
    body: "Les documents scannés ou reçus par e-mail arrivent automatiquement dans « Courriers » → « Scans reçus ». Ceux que l'application n'a pas pu reconnaître seule attendent dans l'onglet « À classer ».",
    cta: { label: "Ouvrir Scans reçus", href: "/admin/scans" },
  },
  {
    icon: FileWarning,
    title: "Gérer les contraventions",
    body: "Chaque dossier suit son propre cycle : dénonciation puis paiement. Vous pouvez aussi le rendre visible pour la société cliente concernée directement depuis sa fiche.",
    cta: { label: "Ouvrir Contraventions", href: "/contraventions" },
  },
  {
    icon: Building2,
    title: "Créer et inviter vos clients",
    body: "Depuis « Clients », créez une société puis ajoutez-y des comptes utilisateurs individuels — chacun reçoit une invitation par e-mail pour définir son propre mot de passe.",
    cta: { label: "Ouvrir Clients", href: "/admin/clients" },
  },
  {
    icon: LifeBuoy,
    title: "Besoin d'aide plus tard ?",
    body: "Retrouvez à tout moment des guides détaillés, le glossaire des statuts et les réponses aux problèmes fréquents dans « Aide et assistance », tout en bas de la barre latérale.",
    cta: { label: "Ouvrir Aide et assistance", href: "/aide" },
  },
];

export function OnboardingTour({ initialStep }: { initialStep: number }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep, 0), SLIDES.length - 1));

  if (!open) return null;

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  function goTo(next: number) {
    setStep(next);
    void advanceOnboardingStepAction(next);
  }

  function skip() {
    setOpen(false);
    void finishOnboardingAction("skipped");
  }

  function finish() {
    setOpen(false);
    void finishOnboardingAction("completed");
  }

  return (
    <Modal open={open} onClose={skip} title="Visite guidée" className="max-w-md">
      <div className="p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <slide.icon size={20} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-900">{slide.title}</h2>
        <p className="mt-1.5 text-sm text-slate-600">{slide.body}</p>
        {slide.cta && (
          <Link href={slide.cta.href} onClick={finish} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
            {slide.cta.label} <ArrowRight size={13} />
          </Link>
        )}

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span key={i} className={"h-1.5 rounded-full transition-all " + (i === step ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200")} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5">
        <button type="button" onClick={skip} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          <X size={13} className="mr-1 inline" /> Passer
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button type="button" onClick={() => goTo(step - 1)} className="btn-secondary text-xs">
              <ArrowLeft size={13} /> Précédent
            </button>
          )}
          {isLast ? (
            <button type="button" onClick={finish} className="btn-primary text-xs">
              Terminer
            </button>
          ) : (
            <button type="button" onClick={() => goTo(step + 1)} className="btn-primary text-xs">
              Suivant <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
