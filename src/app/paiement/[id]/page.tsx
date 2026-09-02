import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { fmtMoneyCents, fmtDateTime } from "@/lib/utils";
import { simulerPaiement, verifierStatutStripe } from "./actions";

export const dynamic = "force-dynamic";

// Deliberately no login requirement — this is the page shared as a "lien de paiement" with an
// external debtor, exactly like a real hosted payment page. Its id is an unguessable cuid, the
// same security model as a Stripe Checkout Session URL.
export default async function PaiementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paiement = await prisma.paiement.findUnique({ where: { id } });
  if (!paiement) notFound();

  const isFinal = paiement.statut !== "en_attente";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {paiement.provider === "mock"
            ? "Mode simulation (sandbox) — aucune carte n'est demandée, aucun argent réel ne circule."
            : "Mode test Stripe — aucun paiement réel n'est débité."}
        </div>

        <div>
          <h1 className="text-lg font-semibold text-slate-900">Paiement à {paiement.societe}</h1>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fmtMoneyCents(paiement.montant)}</p>
          <p className="text-xs text-slate-400">Référence : {paiement.id}</p>
        </div>

        {isFinal ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Statut :{" "}
              <span className={paiement.statut === "reussi" ? "text-emerald-600" : "text-rose-600"}>
                {paiement.statut === "reussi" ? "Paiement accepté" : paiement.statut === "echec" ? "Paiement refusé" : "Paiement abandonné"}
              </span>
            </p>
            <p className="text-xs text-slate-400">{fmtDateTime(paiement.updatedAt)}</p>
          </div>
        ) : paiement.provider === "mock" ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Choisissez le résultat à simuler :</p>
            <form action={simulerPaiement.bind(null, paiement.id, "reussi")}>
              <button className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                Simuler un paiement réussi
              </button>
            </form>
            <form action={simulerPaiement.bind(null, paiement.id, "echec")}>
              <button className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                Simuler un paiement refusé
              </button>
            </form>
            <form action={simulerPaiement.bind(null, paiement.id, "abandonne")}>
              <button className="btn-secondary w-full">
                Simuler une erreur technique / abandon
              </button>
            </form>
          </div>
        ) : (
          <form action={verifierStatutStripe.bind(null, paiement.id)}>
            <button className="w-full rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
              Vérifier le statut auprès de Stripe
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
