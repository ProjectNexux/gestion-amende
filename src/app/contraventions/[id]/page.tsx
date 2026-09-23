import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import ContraventionForm from "@/components/ContraventionForm";
import { updateContraventionAction } from "../actions";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { fmtMoney } from "@/lib/utils";
import { DetailActions } from "./DetailActions";
import { TransmettreClientButton } from "@/components/TransmettreClientModal";
import type { TransmissionClientInfo } from "@/app/courriers/actions";
import { BackButton } from "@/components/ui/BackButton";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Record<string, string> = {
  toutes: "Toutes",
  a_denoncer: "À dénoncer",
  paiement_attente: "Paiement en attente",
  en_retard: "En retard",
  terminees: "Terminées",
};

function statutTone(s?: string | null, type?: string): BadgeTone {
  if (type === "denonciation") {
    if (s === "Effectuée") return "success";
    if (s === "Non applicable") return "neutral";
    if (s === "À effectuer") return "warning";
    return "info";
  }
  
  if (type === "paiement") {
    if (s === "Payé") return "success";
    if (s === "En retard") return "danger";
    if (s === "En attente") return "warning";
    return "neutral";
  }
  
  return "neutral";
}

export default async function EditContraventionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const listHref = from && VIEW_LABELS[from] ? `/contraventions?view=${from}` : "/contraventions";
  const [item, vehicules, conducteurs] = await Promise.all([
    prisma.contravention.findUnique({ where: { id } }),
    prisma.vehicule.findMany({ where: isAdmin ? {} : { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } }),
  ]);
  if (!item || (!isAdmin && item.societe !== societe)) notFound();

  const updateWith = updateContraventionAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackButton fallbackHref={listHref} label="Retour au suivi" />
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/contraventions" className="hover:text-slate-600 hover:underline">Contraventions</Link>
          {from && VIEW_LABELS[from] && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={listHref} className="hover:text-slate-600 hover:underline">{VIEW_LABELS[from]}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="text-slate-600">{item.numDossier}</span>
        </nav>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{item.numDossier}</h1>
          <p className="mt-1 text-sm text-slate-500">{item.societe} • N° Avis: {item.numAvis ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={statutTone(item.statutDenonciation, "denonciation")} className="text-xs">
            {item.statutDenonciation}
          </Badge>
          <Badge tone={statutTone(item.statutPaiement, "paiement")} className="text-xs">
            {item.statutPaiement}
          </Badge>
          {isAdmin && (
            <TransmettreClientButton
              kind="contravention"
              id={item.id}
              detectedSociete={item.societe}
              transmission={item.transmissionClient as TransmissionClientInfo | null}
            />
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Résumé rapide */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <div className="text-xs text-slate-500">Date infraction</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{item.dateInfraction ?? "—"}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500">Montant</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{fmtMoney(item.montantAmende)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500">Échéance</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{item.dateLimitePaiement ?? "—"}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500">Points retirés</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{item.pointsRetires ?? "—"}</div>
            </div>
          </div>

          {/* Formulaire modification */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Modifier le dossier</h2>
            <ContraventionForm
              action={updateWith}
              initial={item}
              vehicules={vehicules.map((v) => ({ id: v.id, label: `${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
              conducteurs={conducteurs.map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}` }))}
              showStatutBlocks={false}
              submitLabel="Mettre à jour le dossier"
            />
          </div>

          {/* Observations */}
          {item.observations && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-2">Notes & historique</h3>
              <div className="text-sm whitespace-pre-wrap text-slate-700">{item.observations}</div>
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          <DetailActions
            id={id}
            currentDenonciation={item.statutDenonciation}
            currentPaiement={item.statutPaiement}
            visibleClient={item.visibleClient}
          />
        </div>
      </div>
    </div>
  );
}
