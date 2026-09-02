"use client";

import { useActionState, useState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { changerCodeAccesAction, type ChangerCodeState } from "./actions";

const initialState: ChangerCodeState = { ok: false };

export function ChangerCodeAccesForm() {
  const [state, formAction, pending] = useActionState(changerCodeAccesAction, initialState);
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 size={16} /> Votre code d&apos;accès a été mis à jour.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <KeyRound size={15} /> Modifier mon code d&apos;accès
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {state.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">{state.error}</div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Code actuel</span>
        <input type="password" name="codeActuel" required className="field" autoComplete="current-password" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Nouveau code (6 caractères minimum)</span>
        <input type="password" name="nouveauCode" required minLength={6} className="field" autoComplete="new-password" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Confirmer le nouveau code</span>
        <input type="password" name="confirmation" required minLength={6} className="field" autoComplete="new-password" />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
