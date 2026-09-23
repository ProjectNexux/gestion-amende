"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markDenonciationAction, markPaymentAction, addObservationAction, toggleVisibleClientAction, deleteContraventionAction } from "../actions";
import { ChevronDown, ExternalLink } from "lucide-react";

type ActionButtonProps = {
  id: string;
  currentDenonciation?: string | null;
  currentPaiement?: string | null;
  visibleClient?: boolean;
};

export function DetailActions({ id, currentDenonciation, currentPaiement, visibleClient }: ActionButtonProps) {
  const router = useRouter();
  const [expandDenonciation, setExpandDenonciation] = useState(false);
  const [expandPaiement, setExpandPaiement] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce dossier ?")) return;
    await deleteContraventionAction(id);
    router.push("/contraventions");
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    await addObservationAction(id, noteText);
    setNoteText("");
    setShowNoteForm(false);
  }

  async function handleDenonciation(statut: string) {
    await markDenonciationAction(id, statut);
    setExpandDenonciation(false);
  }

  async function handlePaiement(statut: string) {
    await markPaymentAction(id, statut);
    setExpandPaiement(false);
  }

  async function handleToggleVisible() {
    await toggleVisibleClientAction(id, !visibleClient);
  }

  return (
    <div className="space-y-4">
      {/* Dénonciation */}
      <div className="card p-4">
        <button
          onClick={() => setExpandDenonciation(!expandDenonciation)}
          className="w-full flex items-center justify-between font-semibold text-sm text-slate-900 hover:text-brand-700"
        >
          <span>Dénonciation: {currentDenonciation}</span>
          <ChevronDown size={18} className={`transition-transform ${expandDenonciation ? "rotate-180" : ""}`} />
        </button>
        {expandDenonciation && (
          <div className="mt-3 space-y-2 pt-3 border-t flex flex-wrap gap-2">
            <button
              onClick={() => handleDenonciation("À effectuer")}
              className="btn-secondary text-xs"
            >
              À effectuer
            </button>
            <button
              onClick={() => handleDenonciation("Effectuée")}
              className="btn-secondary text-xs"
            >
              Effectuée
            </button>
            <button
              onClick={() => handleDenonciation("Non applicable")}
              className="btn-secondary text-xs"
            >
              Non applicable
            </button>
          </div>
        )}
      </div>

      {/* Paiement */}
      <div className="card p-4">
        <button
          onClick={() => setExpandPaiement(!expandPaiement)}
          className="w-full flex items-center justify-between font-semibold text-sm text-slate-900 hover:text-brand-700"
        >
          <span>Paiement: {currentPaiement}</span>
          <ChevronDown size={18} className={`transition-transform ${expandPaiement ? "rotate-180" : ""}`} />
        </button>
        {expandPaiement && (
          <div className="mt-3 space-y-2 pt-3 border-t flex flex-wrap gap-2">
            <button
              onClick={() => handlePaiement("En attente")}
              className="btn-secondary text-xs"
            >
              En attente
            </button>
            <button
              onClick={() => handlePaiement("Payé")}
              className="btn-secondary text-xs"
            >
              Payé
            </button>
            <button
              onClick={() => handlePaiement("En retard")}
              className="btn-secondary text-xs"
            >
              En retard
            </button>
            <button
              onClick={() => handlePaiement("Contesté")}
              className="btn-secondary text-xs"
            >
              Contesté
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="card p-4">
        {!showNoteForm ? (
          <button
            onClick={() => setShowNoteForm(true)}
            className="w-full text-left font-semibold text-sm text-slate-900 hover:text-brand-700"
          >
            + Ajouter une note
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Votre note..."
              className="field w-full"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="btn-primary text-xs disabled:opacity-50"
              >
                Ajouter
              </button>
              <button
                onClick={() => {
                  setShowNoteForm(false);
                  setNoteText("");
                }}
                className="btn-secondary text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client visibility */}
      <div className="card p-4">
        <button
          onClick={handleToggleVisible}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            visibleClient
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${visibleClient ? "bg-emerald-500" : "bg-slate-400"}`} />
          {visibleClient ? "Visible par le client" : "Masqué au client"}
        </button>
      </div>

      {/* ANTAI Link */}
      <div className="card p-4">
        <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand-700 font-medium text-sm hover:underline">
          <ExternalLink size={16} /> Site officiel ANTAI
        </a>
      </div>

      <button onClick={handleDelete} className="btn-danger w-full text-sm">
        Supprimer le dossier
      </button>
    </div>
  );
}
