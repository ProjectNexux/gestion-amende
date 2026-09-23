"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Eye, CheckCircle2, RefreshCcw, XCircle, ArrowRightLeft, Users, Star, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { COURRIER_TYPES } from "@/lib/courriers";
import {
  transmitCourrierToClientAction,
  retirerDuPortailClientAction,
  resendFailedCourrierNotificationsAction,
  type TransmissionClientInfo,
} from "@/app/courriers/actions";
import {
  transmitContraventionToClientAction,
  retirerContraventionDuPortailClientAction,
  resendFailedContraventionNotificationsAction,
} from "@/app/contraventions/actions";

type RecipientUser = { id: string; prenom: string; nom: string; email: string; isPrincipal: boolean };

type Props = {
  /** "courrier" (défaut) relie un `Courrier`, "contravention" relie une `Contravention`. */
  kind?: "courrier" | "contravention";
  id: string;
  /** Fichier associé — optionnel (une Contravention n'a pas de prévisualisation ici). */
  fileName?: string;
  fileMime?: string;
  /** Catégorie éditable — uniquement pertinente pour un Courrier. */
  currentType?: string;
  detectedSociete?: string | null;
  transmission?: TransmissionClientInfo | null;
  /** Bouton compact (icône seule) pour les lignes de tableau, ou pleine largeur avec libellé. */
  compact?: boolean;
};

/**
 * "Transmettre au client" — bouton + modale réutilisables partout où un document/dossier existant
 * peut être relié à une société cliente (Scans reçus, Documents à classer, Tous les documents,
 * fiches Contraventions/Mises en demeure/URSSAF/Retards de paiement/Sinistres/Certificats
 * d'immatriculation/Factures/Impôts/Autres courriers). Ne crée jamais de copie du fichier : relie
 * l'enregistrement existant à la société choisie.
 *
 * Sécurité : l'accès réel côté client repose uniquement sur les colonnes serveur
 * `societe`+`visibleClient` (voir /api/client/courriers/[id]/document et
 * /api/client/contraventions/[id]/document) — `transmission` (data.transmissionClient) ainsi que
 * les destinataires de notification e-mail ci-dessous ne sont qu'un historique/affichage, jamais
 * l'unique protection d'accès (PART 6).
 */
export function TransmettreClientButton({ kind = "courrier", id, fileName, fileMime, currentType, detectedSociete, transmission, compact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [changingDestinataire, setChangingDestinataire] = useState(false);
  const [societes, setSocietes] = useState<string[] | null>(null);
  const [societe, setSociete] = useState(detectedSociete ?? "");
  const [type, setType] = useState(currentType ?? "");
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<RecipientUser[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notifyByEmail, setNotifyByEmail] = useState(true);

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

  // Recipient picker (PART 5): reloads the active-users list every time the target société
  // changes, preselecting the contact principal.
  useEffect(() => {
    if (!open || !societe) return;
    setRecipients(null);
    fetch(`/api/admin/societes/${encodeURIComponent(societe)}/users`)
      .then((r) => r.json())
      .then((list: RecipientUser[]) => {
        setRecipients(list);
        setSelectedIds(new Set(list.filter((u) => u.isPrincipal).map((u) => u.id)));
      })
      .catch(() => setRecipients([]));
  }, [open, societe]);

  function toggleRecipient(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAllActive() {
    setSelectedIds(new Set((recipients ?? []).map((u) => u.id)));
  }

  async function confirmTransmission() {
    if (!societe) {
      setError("Choisissez une société destinataire.");
      return;
    }
    if (notifyByEmail && selectedIds.size === 0) {
      setError("Sélectionnez au moins un destinataire, ou décochez la notification par e-mail.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const recipientUserIds = Array.from(selectedIds);
      if (kind === "contravention") {
        await transmitContraventionToClientAction(id, societe, { titre: titre || undefined, message: message || undefined, recipientUserIds, notifyByEmail });
      } else {
        await transmitCourrierToClientAction(id, societe, { type, titre: titre || undefined, message: message || undefined, recipientUserIds, notifyByEmail });
      }
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
      if (kind === "contravention") await retirerContraventionDuPortailClientAction(id);
      else await retirerDuPortailClientAction(id);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleResendFailed() {
    setPending(true);
    try {
      if (kind === "contravention") await resendFailedContraventionNotificationsAction(id);
      else await resendFailedCourrierNotificationsAction(id);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const triggerClass = compact
    ? "inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    : "btn-secondary text-xs";

  const canPreview = kind === "courrier" && !!fileName && !!fileMime;
  const failedNotifications = transmission?.notifications?.filter((n) => n.status === "echec") ?? [];

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

                {transmission.notifications && transmission.notifications.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-700"><Users size={13} /> Notifications e-mail</p>
                    <ul className="space-y-1">
                      {transmission.notifications.map((n) => (
                        <li key={n.userId} className="flex items-center justify-between">
                          <span>{n.prenom} {n.nom} <span className="text-slate-400">({n.email})</span></span>
                          {n.status === "envoye" ? (
                            <span className="text-emerald-600">Envoyé</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle size={11} /> Échec</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {failedNotifications.length > 0 && (
                      <button type="button" onClick={handleResendFailed} disabled={pending} className="btn-secondary mt-2 text-xs disabled:opacity-50">
                        <RefreshCcw size={12} /> Renvoyer aux destinataires en échec
                      </button>
                    )}
                  </div>
                )}

                {canPreview && (
                  <DocumentViewerTrigger
                    fileUrl={`/api/courriers/${id}`}
                    downloadUrl={`/api/courriers/${id}?download=1`}
                    fileName={fileName!}
                    fileMime={fileMime!}
                    className="btn-secondary w-full text-xs"
                  >
                    <Eye size={13} /> Visualiser le document
                  </DocumentViewerTrigger>
                )}
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
                {canPreview && (
                  <DocumentViewerTrigger
                    fileUrl={`/api/courriers/${id}`}
                    downloadUrl={`/api/courriers/${id}?download=1`}
                    fileName={fileName!}
                    fileMime={fileMime!}
                    className="btn-secondary w-full text-xs"
                  >
                    <Eye size={13} /> Prévisualiser le document original
                  </DocumentViewerTrigger>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Société destinataire *</span>
                  <select value={societe} onChange={(e) => setSociete(e.target.value)} className="field text-sm">
                    <option value="">— Sélectionner —</option>
                    {(societes ?? []).map((s) => (
                      <option key={s} value={s}>{s}{s === detectedSociete ? " (détectée)" : ""}</option>
                    ))}
                  </select>
                </label>

                {kind === "courrier" && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Catégorie</span>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="field text-sm">
                      {COURRIER_TYPES.filter((t) => t.key !== "client_envoi").map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Titre</span>
                  <input value={titre} onChange={(e) => setTitre(e.target.value)} className="field text-sm" placeholder={fileName} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Message (facultatif)</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="field text-sm" />
                </label>

                {societe && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Users size={13} /> Destinataires (utilisateurs actifs)</span>
                      {(recipients?.length ?? 0) > 0 && (
                        <button type="button" onClick={selectAllActive} className="text-xs font-medium text-brand-600 hover:underline">
                          Sélectionner tous les utilisateurs actifs
                        </button>
                      )}
                    </div>
                    {recipients === null ? (
                      <p className="text-xs text-slate-400">Chargement…</p>
                    ) : recipients.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucun utilisateur actif pour cette société — la transmission au portail reste possible sans notification e-mail.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {recipients.map((u) => (
                          <li key={u.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(u.id)}
                              onChange={() => toggleRecipient(u.id)}
                              disabled={!notifyByEmail}
                              className="h-3.5 w-3.5 rounded border-slate-300"
                            />
                            <span className="min-w-0 flex-1 truncate">{u.prenom} {u.nom} <span className="text-slate-400">({u.email})</span></span>
                            {u.isPrincipal && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-amber-600"><Star size={10} fill="currentColor" /> Principal</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-700">
                      <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                      Notifier par e-mail les destinataires sélectionnés
                    </label>
                  </div>
                )}

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

