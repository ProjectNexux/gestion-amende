import { PageHeader } from "@/components/ui/PageHeader";
import { Eye, Download, FileWarning, UserCheck, Paperclip, Mail, ExternalLink } from "lucide-react";

const SUPPORT_EMAIL = "contact@gestion-amendes.local";

const STEPS: { icon: typeof Eye; title: string; description: string }[] = [
  {
    icon: Eye,
    title: "Consulter un document",
    description: "Depuis « Mes documents » ou « Mes contraventions », cliquez sur l'icône œil pour ouvrir un aperçu du document sans le télécharger.",
  },
  {
    icon: Download,
    title: "Télécharger un document",
    description: "Cliquez sur l'icône de téléchargement à droite de chaque ligne pour enregistrer le fichier original sur votre ordinateur.",
  },
  {
    icon: FileWarning,
    title: "Traiter une contravention",
    description: "Ouvrez le dossier depuis « Mes contraventions », identifiez le conducteur si besoin, puis signalez que la dénonciation ou le paiement a été effectué(e).",
  },
  {
    icon: UserCheck,
    title: "Transmettre les informations d'un conducteur",
    description: "Dans la fiche d'une contravention, sélectionnez le conducteur concerné dans la liste puis validez — vous pouvez aussi y ajouter son permis et sa pièce d'identité.",
  },
  {
    icon: Paperclip,
    title: "Envoyer une pièce jointe",
    description: "Utilisez le bouton « Envoyer un document » (tableau de bord ou « Documents envoyés »), ou l'icône dédiée sur une ligne de document/contravention pour joindre un justificatif à ce dossier précis.",
  },
  {
    icon: Mail,
    title: "Contacter l'administrateur",
    description: `Écrivez-nous directement à ${SUPPORT_EMAIL} — notre équipe vous répond dans les meilleurs délais.`,
  },
];

export default function ClientAidePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Assistance et guide" description="Un guide simple pour prendre en main votre portail société." />

      <div className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((step) => (
          <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <step.icon size={17} />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-card">
        <h2 className="text-base font-semibold">Besoin d&apos;un accompagnement personnalisé ?</h2>
        <p className="mt-1 text-sm text-slate-300">Notre équipe reste disponible pour toute question sur vos documents ou contraventions.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3.5 py-2 text-xs font-semibold text-slate-900 transition hover:bg-teal-400">
            <Mail size={13} /> Nous contacter
          </a>
          <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-white/15">
            <ExternalLink size={13} /> Site officiel ANTAI
          </a>
        </div>
      </div>
    </div>
  );
}
