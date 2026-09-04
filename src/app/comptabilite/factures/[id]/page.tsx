import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { resendFacture, deleteFacture } from "../actions";
import { buildFactureEmail, COMPTABILITE_FORWARD_RECIPIENTS } from "@/lib/comptabilite-forward";
import { getFactureData, forwardStatutTone, origineLabel } from "@/lib/comptabilite";
import { fmtMoney, fmtDateTime } from "@/lib/utils";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ComptabiliteSendModal } from "@/components/ComptabiliteSendModal";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function classificationTone(statut: string | undefined): BadgeTone {
  return statut === "À vérifier" ? "warning" : "success";
}

export default async function FactureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const item = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "facture" } : { id, societe, type: "facture" } });
  if (!item) notFound();

  const d = getFactureData(item.data);
  const forward = d.forward;
  const canSend = forward && forward.statut !== "En cours d'envoi";
  const alreadySent = forward?.statut === "Envoyé";
  const sendLabel = alreadySent || forward?.statut === "Erreur d'envoi" ? "Renvoyer" : "Transmettre à la comptabilité";
  const { subject, text } = buildFactureEmail(d, d.societeConcernee ?? item.societe);
  const isManuel = d.origine === "manuel";

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Comptabilité</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Facture</h1>
          <p className="mt-1 text-sm text-slate-500">{item.fileName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={classificationTone(d.statutClassification)}>{d.statutClassification ?? "Nouveau"}</Badge>
          <Badge tone={d.origine === "manuel" ? "info" : "neutral"}>{origineLabel(d.origine)}</Badge>
          <Badge tone={forwardStatutTone(forward?.statut)}>{forward?.statut ?? "Non transmis"}</Badge>
          {isManuel && (
            <Link href={`/comptabilite/factures/${id}/edit`} className="btn-secondary inline-flex items-center gap-1.5">
              <Pencil size={14} /> Modifier
            </Link>
          )}
          <Link href="/comptabilite/factures" className="btn-secondary">
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-800">Informations extraites</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Société concernée</dt><dd className="mt-1 text-slate-900">{d.societeConcernee ?? item.societe}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Émetteur / Fournisseur</dt><dd className="mt-1 text-slate-900">{d.emetteur ?? "Non détecté"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">N° facture</dt><dd className="mt-1 text-slate-900">{d.reference ?? "Non détecté"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Référence / Bon de commande</dt><dd className="mt-1 text-slate-900">{d.referenceCommande ?? "—"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date de facture</dt><dd className="mt-1 text-slate-900">{d.dateDocument ?? "Non détectée"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date d&apos;échéance</dt><dd className="mt-1 text-slate-900">{d.echeance ?? "—"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Montant HT</dt><dd className="mt-1 text-slate-900">{d.montantHT != null ? fmtMoney(d.montantHT) : "—"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">TVA</dt><dd className="mt-1 text-slate-900">{d.tva != null ? fmtMoney(d.tva) : "—"}</dd></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 col-span-2"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Montant TTC</dt><dd className="mt-1 text-slate-900">{d.montant != null ? fmtMoney(d.montant) : "Non détecté"}{d.devise && d.devise !== "EUR" ? ` (${d.devise})` : ""}</dd></div>
            {d.commentaire && <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Commentaire</dt><dd className="mt-1 text-slate-900">{d.commentaire}</dd></div>}
          </dl>

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
            <a href={`/api/courriers/${item.id}?download=1`} className="btn-secondary">
              Télécharger
            </a>
          </div>
        </div>

        <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Transmission</h2>
            <form action={deleteFacture.bind(null, item.id)}>
              <ConfirmSubmitButton
                confirmMessage={alreadySent ? "Cette facture a déjà été transmise à la comptabilité. Supprimer définitivement ce document ?" : "Supprimer définitivement cette facture ?"}
                className="text-xs font-medium text-rose-700 hover:underline"
              >
                Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>

          {alreadySent ? (
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-xs font-medium text-slate-500">Transmis à :</div>
                <ul className="mt-1 space-y-0.5">
                  {forward.destinataires.map((email) => (
                    <li key={email}><a href={`mailto:${email}`} className="text-brand-700 hover:underline">{email}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Date d&apos;envoi : </span>
                <span className="text-slate-900">{forward.envoyeAt ? fmtDateTime(forward.envoyeAt) : "—"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {d.statutClassification === "À vérifier"
                ? "Classification incertaine — aucun envoi automatique. Vérifiez les informations puis transmettez manuellement si tout est correct."
                : "Cette facture n'a pas encore été transmise."}
            </p>
          )}

          {forward?.statut === "Erreur d'envoi" && forward.derniereErreur && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
              Erreur : {forward.derniereErreur} ({forward.tentatives} tentative(s))
            </div>
          )}

          {canSend && (
            <ComptabiliteSendModal
              triggerLabel={sendLabel}
              documentLabel={`Facture — ${item.fileName}`}
              recipients={COMPTABILITE_FORWARD_RECIPIENTS}
              subject={subject}
              message={text}
              attachmentName={item.fileName}
              action={resendFacture.bind(null, item.id, alreadySent)}
            />
          )}

          {forward && forward.historique.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                {[...forward.historique].reverse().map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span>{h.action.replace(/_/g, " ")}{h.details ? ` — ${h.details}` : ""}</span>
                    <span className="shrink-0 text-slate-400">{fmtDateTime(h.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
