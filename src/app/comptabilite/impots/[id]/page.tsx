import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { resendImpot, deleteImpot } from "../actions";
import { buildImpotEmail, COMPTABILITE_FORWARD_RECIPIENTS } from "@/lib/comptabilite-forward";
import { getImpotData, forwardStatutTone, origineLabel } from "@/lib/comptabilite";
import { fmtMoney, fmtDateTime } from "@/lib/utils";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ComptabiliteSendModal } from "@/components/ComptabiliteSendModal";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function classificationTone(statut: string | undefined): BadgeTone {
  return statut === "À vérifier" ? "warning" : "success";
}

export default async function ImpotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const item = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "impot" } : { id, societe, type: "impot" } });
  if (!item) notFound();

  const d = getImpotData(item.data);
  const forward = d.forward;
  const canSend = forward && forward.statut !== "En cours d'envoi";
  const alreadySent = forward?.statut === "Envoyé";
  const sendLabel = alreadySent || forward?.statut === "Erreur d'envoi" ? "Renvoyer" : "Transmettre à la comptabilité";
  const { subject, text } = buildImpotEmail(d, d.societeConcernee ?? item.societe);
  const isManuel = d.origine === "manuel";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Document fiscal</h1>
          <p className="text-sm text-slate-500">{item.fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={classificationTone(d.statutClassification)}>{d.statutClassification ?? "Nouveau"}</Badge>
          <Badge tone={d.origine === "manuel" ? "info" : "neutral"}>{origineLabel(d.origine)}</Badge>
          <Badge tone={forwardStatutTone(forward?.statut)}>{forward?.statut ?? "Non transmis"}</Badge>
          {isManuel && (
            <Link href={`/comptabilite/impots/${id}/edit`} className="inline-flex items-center gap-1.5 btn-secondary">
              <Pencil size={14} /> Modifier
            </Link>
          )}
          <Link href="/comptabilite/impots" className="btn-secondary">
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Informations extraites</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-medium text-slate-500">Société concernée</dt><dd className="text-slate-900">{d.societeConcernee ?? item.societe}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Type</dt><dd className="text-slate-900">{d.typeDocument ?? "Non détecté"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Organisme</dt><dd className="text-slate-900">{d.organisme ?? "Non détecté"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Référence</dt><dd className="text-slate-900">{d.reference ?? "Non détectée"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Date</dt><dd className="text-slate-900">{d.dateDocument ?? "Non détectée"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Échéance</dt><dd className="text-slate-900">{d.echeance ?? "Non détectée"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Montant</dt><dd className="text-slate-900">{d.montant != null ? fmtMoney(d.montant) : "Non détecté"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Période concernée</dt><dd className="text-slate-900">{d.periodeConcernee ?? "—"}</dd></div>
            {d.commentaire && <div className="col-span-2"><dt className="text-xs font-medium text-slate-500">Commentaire</dt><dd className="text-slate-900">{d.commentaire}</dd></div>}
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

        <div className="space-y-4 card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Transmission</h2>
            <form action={deleteImpot.bind(null, item.id)}>
              <ConfirmSubmitButton
                confirmMessage={alreadySent ? "Ce document fiscal a déjà été transmis à la comptabilité. Supprimer définitivement ce document ?" : "Supprimer définitivement ce document fiscal ?"}
                className="text-xs text-red-600 hover:underline"
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
                    <li key={email}><a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a></li>
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
                : "Ce document fiscal n'a pas encore été transmis."}
            </p>
          )}

          {forward?.statut === "Erreur d'envoi" && forward.derniereErreur && (
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700">
              Erreur : {forward.derniereErreur} ({forward.tentatives} tentative(s))
            </div>
          )}

          {canSend && (
            <ComptabiliteSendModal
              triggerLabel={sendLabel}
              documentLabel={`Document fiscal — ${item.fileName}`}
              recipients={COMPTABILITE_FORWARD_RECIPIENTS}
              subject={subject}
              message={text}
              attachmentName={item.fileName}
              action={resendImpot.bind(null, item.id, alreadySent)}
            />
          )}

          {forward && forward.historique.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                {[...forward.historique].reverse().map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
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
