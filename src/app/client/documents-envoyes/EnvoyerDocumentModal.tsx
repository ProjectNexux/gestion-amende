"use client";

import { useActionState, useRef, useState } from "react";
import { UploadCloud, Send, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { envoyerDocumentAction, type EnvoyerDocumentState } from "./actions";

const initialState: EnvoyerDocumentState = { ok: false };

export function EnvoyerDocumentButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        <Send size={15} /> Envoyer un document
      </button>
      {open && <EnvoyerDocumentModal onClose={() => setOpen(false)} />}
    </>
  );
}

function EnvoyerDocumentModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(envoyerDocumentAction, initialState);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFiles(files: FileList | null) {
    if (files && files[0]) setFileName(files[0].name);
  }

  if (state.ok) {
    return (
      <Modal open onClose={onClose} title="Document envoyé">
        <div className="flex flex-col items-center gap-3 px-1 py-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={26} />
          </div>
          <p className="text-sm font-medium text-slate-800">Votre document a bien été envoyé à notre équipe.</p>
          <p className="text-xs text-slate-500">Vous le retrouverez dans « Documents envoyés » avec son statut de traitement.</p>
          <button type="button" onClick={onClose} className="btn-primary mt-2">Fermer</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Envoyer un document">
      <form ref={formRef} action={formAction} className="space-y-4 p-5">
        {state.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Titre / objet *</span>
          <input id="titre" name="titre" required className="field" placeholder="Ex : Justificatif de paiement" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Type de document</span>
            <input id="typeDocument" name="typeDocument" className="field" placeholder="Ex : Facture, courrier..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Référence</span>
            <input id="reference" name="reference" className="field" placeholder="Optionnel" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
          <textarea id="message" name="message" rows={3} className="field" placeholder="Un mot pour notre équipe (optionnel)" />
        </label>

        <div
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0] && fileInputRef.current) {
              fileInputRef.current.files = e.dataTransfer.files;
              handleFiles(e.dataTransfer.files);
            }
          }}
        >
          <UploadCloud size={26} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-700">{fileName ?? "Cliquez ou glissez un fichier ici"}</p>
          <p className="text-xs text-slate-400">PDF, JPG ou PNG — 15 Mo max</p>
          <input
            ref={fileInputRef}
            type="file"
            name="fichier"
            required
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
            {pending ? "Envoi en cours…" : "Envoyer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
