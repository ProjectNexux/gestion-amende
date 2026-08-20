"use client";

import { useActionState } from "react";
import { genererLienPaiement } from "./actions";

type LinkState = { paiementId: string; url: string; qrCode: string } | null;

export default function GenerateLinkForm({ courrierId, resteEuros }: { courrierId: string; resteEuros: string }) {
  const [state, formAction, pending] = useActionState<LinkState, FormData>(async (_prev, formData) => {
    const result = await genererLienPaiement(courrierId, formData);
    return result ?? null;
  }, null);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Montant (€)</label>
          <input name="montant" defaultValue={resteEuros} className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button
          disabled={pending}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? "Génération…" : "Générer un lien de paiement"}
        </button>
      </form>

      {state && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Lien de paiement (à copier et transmettre vous-même)</p>
          <div className="mt-1 flex items-center gap-2">
            <input
              readOnly
              value={state.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.url)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Copier
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qrCode} alt="QR code de paiement" className="mt-3 h-32 w-32 rounded-md border border-slate-200 bg-white p-1" />
        </div>
      )}
    </div>
  );
}
