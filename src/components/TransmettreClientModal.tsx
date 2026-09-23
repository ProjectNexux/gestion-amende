"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Eye, CheckCircle2, RefreshCcw, XCircle, ArrowRightLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { COURRIER_TYPES } from "@/lib/courriers";
import {
  transmitCourrierToClientAction,
  retirerDuPortailClientAction,
  type TransmissionClientInfo,
} from "@/app/courriers/actions";

type Props = {
  courrierId: string;
  fileName: string;
  fileMime: string;
  currentType: string;
  detectedSociete?: string | null;
  transmission?: TransmissionClientInfo | null;
  /** Bouton compact (icône seule) pour les lignes de tableau, ou pleine largeur avec libellé. */
  compact?: boolean;
};

/**
 * "Transmettre au client" — bouton + modale réutilisables partout où un document existant peut
 * être relié à une société cliente (Scans reçus, Documents à classer, Tous les documents, fiche
 * d'un document dans son module définitif). Ne crée jamais de copie du fichier : relie le
 * `Courrier` existant à la société choisie (voir `transmitCourrierToClientAction`).
 */
export function TransmettreClientButton({ courrierId, fileName, fileMime, currentType, detectedSociete, transmission, compact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [changingDestinataire, setChangingDestinataire] = useState(false);
  const [societes, setSocietes] = useState<string[] | null>(null);
  const [societe, setSociete] = useState(detectedSociete ?? "");
  const [type, setType] = useState(currentType);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || societes) return;
    fetch("/api/admin/societes-list")
      .then((r) => r.json())
      .then((list: string[]) => {
        setSocietes(list);
        if (!societe && detectedSociete && list.includes(detectedSociete)) setSociete(detectedSociete);
        else if (!societe && list.length > 0 && !changingDestinataire) setSociete(list[0]);
      })
      .catch(() => setSocietes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function confirmTransmission() {
    if (!societe) {
      setError("Choisissez une société destinataire.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await transmitCourrierToClientAction(courrierId, societe, { type, titre: titre || undefined, message: message || undefined });
      setOpen(false);
      setChangingDestinataire(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la transmission.");
    } finally {
      setPending(false);
    }
  }

  async function handleRetirer() {
    if (!window.confirm("Retirer ce document du portail client ?")) return;
    setPending(true);
    try {
      await retirerDuPortailClientAction(courrierId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const triggerClass = compact
    ? "inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    : "btn-secondary text-xs";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass} title="Transmettre au client">
        <Send size={compact ? 15 : 13} /> {!compact && "Transmettre au client"}
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title={transmission && !changingDestinataire ? "Transmission au client" : "Transmettre au client"}>
          <div className="space-y-4 p-5">
            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            {transmission && !changingDestinataire ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="flex items-center gap-1.5 font-medium"><CheckCircle2 size={14} /> Déjà transmis</p>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between"><dt>Société destinataire</dt><dd className="font-medium">{transmission.societe}</dd></div>
                    <div className="flex justify-between"><dt>Date de transmission</dt><dd>{new Date(transmission.transmisAt).toLocaleString("fr-FR")}</dd></div>
                    <div className="flex justify-between"><dt>Statut de consultation</dt><dd>{transmission.statutConsultation}</dd></div>
                  </dl>
                </div>
                <DocumentViewerTrigger
                  fileUrl={`/api/courriers/${courrierId}`}
                  downloadUrl={`/api/courriers/${courrierId}?download=1`}
                  fileName={fileName}
                  fileMime={fileMime}
                  className="btn-secondary w-full text-xs"
                >
                  <Eye size={13} /> Visualiser le document
                </DocumentViewerTrigger>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleRetirer} disabled={pending} className="btn-secondary text-xs text-rose-700 disabled:opacity-50">
                    <XCircle size={13} /> Retirer du portail client
                  </button>
                  <button type="button" onClick={() => setChangingDestinataire(true)} className="btn-secondary text-xs">
                    <ArrowRightLeft size={13} /> Changer de destinataire
                  </button>
                  <button type="button" onClick={confirmTransmission} disabled={pending} className="btn-secondary text-xs">
                    <RefreshCcw size={13} /> Transmettre à nouveau
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {changingDestinataire && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Changement de destinataire — société actuelle : <strong>{transmission?.societe}</strong>
                  </div>
                )}
                <DocumentViewerTrigger
                  fileUrl={`/api/courriers/${courrierId}`}
                  downloadUrl={`/api/courriers/${courrierId}?download=1`}
                  fileName={fileName}
                  fileMime={fileMime}
                  className="btn-secondary w-full text-xs"
                >
                  <Eye size={13} /> Prévisualiser le document original
                </DocumentViewerTrigger>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Société destinataire *</span>
                  <select value={societe} onChange={(e) => setSociete(e.target.value)} className="field text-sm">
                    <option value="">— Sélectionner —</option>
                    {(societes ?? []).map((s) => (
                      <option key={s} value={s}>{s}{s === detectedSociete ? " (détectée)" : ""}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Catégorie</span>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="field text-sm">
                    {COURRIER_TYPES.filter((t) => t.key !== "client_envoi").map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Titre</span>
                  <input value={titre} onChange={(e) => setTitre(e.target.value)} className="field text-sm" placeholder={fileName} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Message (facultatif)</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="field text-sm" />
                </label>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => { setOpen(false); setChangingDestinataire(false); }} className="btn-secondary text-xs">
                    <X size={13} /> Annuler
                  </button>
                  <button type="button" onClick={confirmTransmission} disabled={pending || !societe} className="btn-primary text-xs disabled:opacity-50">
                    <Send size={13} /> {pending ? "Transmission…" : "Confirmer la transmission"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
