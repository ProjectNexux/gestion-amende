import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye, Mail, Send, TriangleAlert } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { updateMiseEnDemeure, deleteMiseEnDemeure, updateSocieteEmailTransmission, preparerEnvoi } from "../actions";
import { getMiseEnDemeureData, MISE_EN_DEMEURE_STATUTS, origineLabel } from "@/lib/courriers";
import { deriveTransmissionStatut, AUTO_FORWARD_URSSAF } from "@/lib/transmission";
import { fmtMoney, fmtDateTime } from "@/lib/utils";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const inp = "field";

function sensLabel(sens: string | undefined): string {
  if (sens === "recue") return "Reçue";
  if (sens === "envoyee") return "Envoyée";
  return "À vérifier";
}
function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Traité") return "success";
  if (statut === "À vérifier" || statut === "À traiter") return "warning";
  if (statut === "Archivé") return "neutral";
  return "info";
}
function transmissionStatutTone(statut: string): BadgeTone {
  if (statut === "Prêt à envoyer") return "success";
  if (statut === "Envoyé") return "success";
  if (statut === "Erreur d'envoi") return "danger";
  if (statut === "À vérifier") return "warning";
  return "warning"; // À transmettre
}
function confianceTone(confiance: string | undefined): BadgeTone {
  if (confiance === "Élevée") return "success";
  if (confiance === "Moyenne") return "warning";
  return "danger";
}

export default async function MiseEnDemeureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const sp = searchParams ? await searchParams : {};
  const showApercu = sp.apercu === "1";

  const [item, allSocietes] = await Promise.all([
    prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe } }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  if (!item) notFound();

  const d = getMiseEnDemeureData(item.data);
  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [item.societe];

  const clientNom = d.transmission?.clientDetecte ?? null;
  const clientSociete = clientNom ? await prisma.societe.findUnique({ where: { nom: clientNom }, select: { emailTransmission: true } }) : null;
  const emailDestination = clientSociete?.emailTransmission ?? null;
  const transmissionStatut = d.transmission ? deriveTransmissionStatut(d.transmission, emailDestination) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mise en demeure</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statutTone(d.statut)}>{d.statut ?? "Nouveau"}</Badge>
          <Badge tone={d.origine === "manuel" ? "neutral" : "info"}>{origineLabel(d.origine)}</Badge>
          <Link href="/courriers/mise-en-demeure" className="btn-secondary">
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Informations générales</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Expéditeur</dt>
              <dd className="text-slate-900">{d.expediteur ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Destinataire</dt>
              <dd className="text-slate-900">{d.destinataire ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Sens</dt>
              <dd className="text-slate-900">{sensLabel(d.sens)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Société concernée</dt>
              <dd className="text-slate-900">{d.societeConcernee ?? item.societe}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Date</dt>
              <dd className="text-slate-900">{d.dateDocument ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Référence</dt>
              <dd className="text-slate-900">{d.reference ?? "—"}</dd>
            </div>
          </dl>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problème</h3>
            <div className="mt-1">
              <dt className="text-xs font-medium text-slate-500">Motif</dt>
              <dd className="text-slate-900">{d.motif ?? "—"}</dd>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Financier</h3>
            <div className="mt-1">
              <dt className="text-xs font-medium text-slate-500">Montant réclamé</dt>
              <dd className="text-slate-900">{d.montant != null ? fmtMoney(d.montant) : d.montantIncertain ? "À vérifier" : "—"}</dd>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Échéance</h3>
            <div className="mt-1">
              <dt className="text-xs font-medium text-slate-500">À régulariser avant</dt>
              <dd className="text-slate-900">{d.echeance ?? "—"} {d.echeanceTexte ? `(${d.echeanceTexte})` : ""}</dd>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <DocumentViewerTrigger
              fileUrl={`/api/courriers/${item.id}`}
              downloadUrl={`/api/courriers/${item.id}?download=1`}
              fileName={item.fileName}
              fileMime={item.fileMime}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
            >
              <Eye size={15} /> Visualiser le document
            </DocumentViewerTrigger>
            <a
              href={`/api/courriers/${item.id}?download=1`}
              className="btn-secondary"
            >
              Télécharger
            </a>
          </div>
        </div>

        <div id="correction-form" className="space-y-4 card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Corriger les informations</h2>
            <form action={deleteMiseEnDemeure.bind(null, item.id)}>
              <ConfirmSubmitButton confirmMessage="Supprimer définitivement cette mise en demeure ?" className="text-xs text-red-600 hover:underline">
                Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>
          <form action={updateMiseEnDemeure.bind(null, item.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Expéditeur</label>
              <input name="expediteur" defaultValue={d.expediteur ?? ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Destinataire</label>
              <input name="destinataire" defaultValue={d.destinataire ?? ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sens</label>
              <select name="sens" defaultValue={d.sens ?? "a_verifier"} className={inp}>
                <option value="recue">Reçue</option>
                <option value="envoyee">Envoyée</option>
                <option value="a_verifier">À vérifier</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Société concernée</label>
              <select name="societeConcernee" defaultValue={d.societeConcernee ?? item.societe} className={inp}>
                {societeOptions.map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Motif</label>
              <input name="motif" defaultValue={d.motif ?? ""} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date du document (JJ/MM/AAAA)</label>
              <input name="dateDocument" defaultValue={d.dateDocument ?? ""} placeholder="24/08/2026" className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Échéance (JJ/MM/AAAA)</label>
              <input name="echeance" defaultValue={d.echeance ?? ""} placeholder="31/08/2026" className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Montant réclamé (€)</label>
              <input name="montant" defaultValue={d.montant != null ? String(d.montant) : ""} placeholder="4523.17" className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Référence</label>
              <input name="reference" defaultValue={d.reference ?? ""} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Statut</label>
              <select name="statut" defaultValue={d.statut ?? "Nouveau"} className={inp}>
                {MISE_EN_DEMEURE_STATUTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>

      {d.transmission && (
        <div className="space-y-4 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Transmission au client</h2>
            {transmissionStatut && <Badge tone={transmissionStatutTone(transmissionStatut)}>{transmissionStatut}</Badge>}
          </div>

          {d.transmission.confiance === "Faible" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert size={15} className="shrink-0" /> Client à vérifier
            </div>
          )}
          {d.transmission.confiance !== "Faible" && !emailDestination && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert size={15} className="shrink-0" /> Adresse de transmission manquante
            </div>
          )}

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Organisme</dt>
              <dd className="text-slate-900">{d.transmission.organisme}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Client détecté</dt>
              <dd className="text-slate-900">{d.transmission.clientDetecte ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Adresse de destination</dt>
              <dd className="text-slate-900">{emailDestination ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Confiance de l'identification</dt>
              <dd><Badge tone={confianceTone(d.transmission.confiance)}>{d.transmission.confiance}</Badge></dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Document à transmettre</dt>
              <dd className="text-slate-900">{item.fileName}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <a href="#correction-form" className="btn-secondary">
              Modifier le client
            </a>
            {transmissionStatut !== "À vérifier" && (
              <form action={preparerEnvoi.bind(null, item.id)}>
                <button className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
                  <Send size={15} /> Préparer l'envoi
                </button>
              </form>
            )}
          </div>

          {clientNom && (
            <details className="border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">Modifier l'adresse e-mail de {clientNom}</summary>
              <form action={updateSocieteEmailTransmission.bind(null, clientNom)} className="mt-2 flex flex-wrap gap-2">
                <input
                  type="email"
                  name="emailTransmission"
                  defaultValue={emailDestination ?? ""}
                  placeholder="comptabilite@client.fr"
                  className={`${inp} max-w-xs`}
                />
                <button className="btn-secondary">Enregistrer</button>
              </form>
            </details>
          )}

          {showApercu && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Mail size={15} /> Aperçu de l'e-mail (non envoyé)
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Destinataire</dt>
                  <dd className="text-slate-900">{emailDestination ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Objet</dt>
                  <dd className="text-slate-900">Courrier URSSAF reçu – {d.transmission.clientDetecte ?? item.societe}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Message</dt>
                  <dd className="whitespace-pre-line text-slate-900">
                    {"Bonjour,\n\nVeuillez trouver ci-joint un courrier URSSAF reçu concernant votre société.\n\nNous vous invitons à en prendre connaissance.\n\nCordialement."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Pièce jointe</dt>
                  <dd className="text-slate-900">{item.fileName} (document original)</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Référence</dt>
                  <dd className="text-slate-900">{d.reference ?? "—"}</dd>
                </div>
              </dl>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Envoi automatique désactivé — aucun e-mail n'a été envoyé (AUTO_FORWARD_URSSAF = {String(AUTO_FORWARD_URSSAF)}).
              </div>
              <Link href={`/courriers/mise-en-demeure/${item.id}`} className="text-xs text-slate-500 hover:underline">Fermer l'aperçu</Link>
            </div>
          )}

          {d.transmission.historique.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique de transmission</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                {d.transmission.historique.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>{h.action}{h.acteur ? ` — ${h.acteur}` : ""}</span>
                    <span className="text-slate-400">{fmtDateTime(h.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

