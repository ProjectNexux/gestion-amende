import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { fmtMoney } from "@/lib/utils";

export type ContraventionRow = {
  id: string;
  numDossier: string;
  dateInfraction: string | null;
  natureInfraction: string | null;
  montantAmende: number | null;
  dateLimitePaiement: string | null;
  statutDenonciation: string | null;
  statutPaiement: string | null;
  conducteurNom: string | null;
  vehiculeImmat: string | null;
};

function denoncTone(s: string | null): BadgeTone {
  if (s === "Effectuée") return "success";
  if (s === "Non applicable") return "neutral";
  return "warning";
}
function paiementTone(s: string | null): BadgeTone {
  if (s === "Payé") return "success";
  if (s === "En retard") return "danger";
  if (s === "Contesté") return "info";
  return "warning";
}

export function ContraventionsTab({ contraventions }: { contraventions: ContraventionRow[] }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{contraventions.length} dossier(s) au total</h2>
      {contraventions.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune contravention pour cette société.</p>
      ) : (
        <div className="table-shell overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-left">N° dossier</th>
                <th className="p-3 text-left">Nature</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3 text-left">Échéance</th>
                <th className="p-3 text-left">Conducteur / Véhicule</th>
                <th className="p-3 text-left">Dénonciation</th>
                <th className="p-3 text-left">Paiement</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {contraventions.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="p-3 font-medium text-slate-900">{c.numDossier}</td>
                  <td className="p-3 text-slate-600">{c.natureInfraction ?? "—"}</td>
                  <td className="p-3 text-right font-medium text-slate-900">{c.montantAmende != null ? fmtMoney(c.montantAmende) : "—"}</td>
                  <td className="p-3 text-slate-600">{c.dateLimitePaiement ?? "—"}</td>
                  <td className="p-3 text-slate-600">{[c.conducteurNom, c.vehiculeImmat].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-3"><Badge tone={denoncTone(c.statutDenonciation)}>{c.statutDenonciation ?? "—"}</Badge></td>
                  <td className="p-3"><Badge tone={paiementTone(c.statutPaiement)}>{c.statutPaiement ?? "—"}</Badge></td>
                  <td className="p-3 text-right">
                    <Link href={`/contraventions/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">Ouvrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
