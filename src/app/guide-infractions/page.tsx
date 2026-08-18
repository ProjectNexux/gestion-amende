import Link from "next/link";
import { AlertTriangle, ArrowRight, CarFront, Gauge, ShieldAlert, CircleParking, Wine, TrafficCone } from "lucide-react";
import { requireSociete } from "@/lib/auth";

const guide = [
  {
    title: "Vitesse",
    points: "1 à 6 points",
    summary: "Le retrait de points dépend du dépassement constaté, du contexte de circulation et de la récidive.",
    infractions: [
      { label: "Excès de vitesse jusqu'à 20 km/h", points: 1, law: "Code de la route, art. R. 413-1 à R. 413-10" },
      { label: "Excès de vitesse de 20 à 30 km/h", points: 2, law: "Code de la route, art. R. 413-1 à R. 413-10" },
      { label: "Excès de vitesse de 30 à 40 km/h", points: 3, law: "Code de la route, art. R. 413-1 à R. 413-10" },
      { label: "Excès de vitesse de 40 à 50 km/h", points: 4, law: "Code de la route, art. R. 413-1 à R. 413-10" },
      { label: "Excès de vitesse supérieur à 50 km/h ou récidive aggravée", points: 6, law: "Code de la route, art. R. 413-1 et R. 413-2" },
    ],
    icon: Gauge,
  },
  {
    title: "Priorités",
    points: "1 à 6 points",
    summary: "Non-respect des règles de priorité, des signaux et des droits de passage des autres usagers.",
    infractions: [
      { label: "Non-respect d'un stop ou d'un cédez-le-passage", points: 3, law: "Code de la route, art. R. 415-1 et R. 415-2" },
      { label: "Ignorance d'un feu rouge ou d'un signal lumineux", points: 4, law: "Code de la route, art. R. 417-1" },
      { label: "Franchissement d'un signal d'arrêt ou manœuvre dangereuse", points: 6, law: "Code de la route, art. R. 417-1 et R. 421-1" },
    ],
    icon: AlertTriangle,
  },
  {
    title: "Comportement et sécurité",
    points: "1 à 6 points",
    summary: "Conduite dangereuse, rupture de distance, dépassement ou comportement mettant en péril les autres usagers.",
    infractions: [
      { label: "Rupture de distance de sécurité", points: 2, law: "Code de la route, art. R. 412-1" },
      { label: "Dépassement dangereux ou inapproprié", points: 3, law: "Code de la route, art. R. 414-1" },
      { label: "Conduite dangereuse / manœuvre téméraire", points: 4, law: "Code de la route, art. R. 412-1 et R. 414-1" },
      { label: "Conduite brutale ou risque grave pour autrui", points: 6, law: "Code de la route, art. R. 412-1 et R. 411-1" },
    ],
    icon: CarFront,
  },
  {
    title: "Équipement et sécurité",
    points: "1 à 6 points",
    summary: "Absence ou défaut d'équipement obligatoire, ainsi que défaut de sécurité ou de signalisation.",
    infractions: [
      { label: "Éclairage ou signalisation insuffisante", points: 1, law: "Code de la route, art. R. 316-1" },
      { label: "Défaut de gilet, triangle ou équipement obligatoire", points: 2, law: "Code de la route, art. R. 318-1" },
      { label: "Équipement non conforme ou inadapté", points: 3, law: "Code de la route, art. R. 316-1" },
      { label: "Absence de sécurité obligatoire ou non-conformité grave", points: 6, law: "Code de la route, art. R. 311-1 et R. 316-1" },
    ],
    icon: ShieldAlert,
  },
  {
    title: "Circulation et voie",
    points: "1 à 6 points",
    summary: "Mauvais usage de la voie, franchissement interdit, conduite hors des règles de circulation.",
    infractions: [
      { label: "Conduite sur une voie interdite ou inadaptée", points: 2, law: "Code de la route, art. R. 421-1" },
      { label: "Dépassement interdit ou mauvaise positionnement sur la chaussée", points: 3, law: "Code de la route, art. R. 414-1" },
      { label: "Conduite à contresens ou sur trottoir", points: 4, law: "Code de la route, art. R. 421-1 et R. 431-1" },
      { label: "Circulation sur une voie totalement interdite ou en situation très dangereuse", points: 6, law: "Code de la route, art. R. 421-1" },
    ],
    icon: TrafficCone,
  },
  {
    title: "Stationnement",
    points: "0 à 3 points",
    summary: "Stationnement gênant, dangereux, interdit ou dangereux pour les autres usagers.",
    infractions: [
      { label: "Stationnement gênant sans danger immédiat", points: 0, law: "Code de la route, art. R. 417-7" },
      { label: "Stationnement interdit ou gênant", points: 1, law: "Code de la route, art. R. 417-7" },
      { label: "Stationnement dangereux ou obstacle grave à la circulation", points: 2, law: "Code de la route, art. R. 417-7" },
      { label: "Stationnement sur emplacement à forte interdiction ou en zone très réglementée", points: 3, law: "Code de la route, art. R. 417-7" },
    ],
    icon: CircleParking,
  },
  {
    title: "Alcool et stupéfiants",
    points: "2 à 6 points",
    summary: "Les infractions liées à l'alcool, aux stupéfiants et à l'état de conduite sous influence sont parmi les plus graves.",
    infractions: [
      { label: "Alcool au-dessus du seuil autorisé, mais sans situation extrême", points: 2, law: "Code de la route, art. L. 234-1 et R. 234-1" },
      { label: "Conduite sous l'empire de l'alcool au-delà du seuil de danger", points: 4, law: "Code de la route, art. L. 234-1 et R. 234-1" },
      { label: "Conduite avec alcool très élevé ou conduite sous stupéfiants", points: 6, law: "Code de la route, art. L. 234-1, L. 235-1 et R. 234-1" },
    ],
    icon: Wine,
  },
] as const;

export default async function GuideInfractionsPage() {
  await requireSociete();

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-indigo-200 bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900 p-6 text-white shadow-[0_25px_60px_-25px_rgba(79,70,229,0.7)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-100">Référence</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Guide des infractions et points retirés</h1>
          </div>
          <Link href="/contraventions/scan" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
            Scanner une amende <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            <div className="font-semibold">Important</div>
            <p className="mt-1">
              Ce guide est un outil de référence interne pour aider à la saisie et au contrôle d’un dossier.
              Le calcul exact peut varier selon le seuil d’excès, la récidive, la zone concernée et le bulletin de contravention.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {guide.map(({ title, points, summary, infractions, icon: Icon }) => (
          <article key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <Icon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                  <p className="text-sm text-slate-500">Points retirés</p>
                </div>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">{points}</span>
            </div>

            <p className="mt-4 text-sm text-slate-600">{summary}</p>

            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {infractions.map(({ label, points: infractionPoints, law }) => (
                <li key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-800">{label}</span>
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{infractionPoints} pt{infractionPoints > 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{law}</div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-slate-900">Synthèse rapide</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="pb-3 pr-4 font-semibold">Catégorie</th>
                <th className="pb-3 pr-4 font-semibold">Retrait standard</th>
                <th className="pb-3 font-semibold">Référence principale</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Vitesse</td>
                <td className="py-3 pr-4">1 à 6 points</td>
                <td className="py-3">Code de la route, art. R. 413-1 à R. 413-10</td>
              </tr>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Priorités</td>
                <td className="py-3 pr-4">3 à 6 points</td>
                <td className="py-3">Code de la route, art. R. 415-1, R. 415-2, R. 417-1</td>
              </tr>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Comportement</td>
                <td className="py-3 pr-4">2 à 6 points</td>
                <td className="py-3">Code de la route, art. R. 412-1 et R. 414-1</td>
              </tr>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Équipement</td>
                <td className="py-3 pr-4">1 à 6 points</td>
                <td className="py-3">Code de la route, art. R. 316-1, R. 318-1</td>
              </tr>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Circulation</td>
                <td className="py-3 pr-4">2 à 6 points</td>
                <td className="py-3">Code de la route, art. R. 414-1 et R. 421-1</td>
              </tr>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Stationnement</td>
                <td className="py-3 pr-4">0 à 3 points</td>
                <td className="py-3">Code de la route, art. R. 417-7</td>
              </tr>
              <tr className="align-top">
                <td className="py-3 pr-4 font-medium text-slate-800">Alcool / stupéfiants</td>
                <td className="py-3 pr-4">2 à 6 points</td>
                <td className="py-3">Code de la route, art. L. 234-1, L. 235-1, R. 234-1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
