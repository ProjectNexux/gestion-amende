import { Car, FileText, FileWarning, Mail, Users } from "lucide-react";
import { fmtDateTime, fmtMoney } from "@/lib/utils";
import { KV, StatCard, humanizeAction } from "../shared";

type Audit = { id: string; action: string; details: string | null; acteur: string | null; createdAt: Date };

export function OverviewTab({
  societeId,
  email,
  phone,
  addressLine1,
  postalCode,
  city,
  contactName,
  lastLogin,
  createdAt,
  nDocuments,
  nContraventions,
  nContraventionsATraiter,
  nVehicules,
  nConducteurs,
  montantEnAttente,
  recentAudits,
}: {
  societeId: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  contactName: string;
  lastLogin: Date | null;
  createdAt: Date;
  nDocuments: number;
  nContraventions: number;
  nContraventionsATraiter: number;
  nVehicules: number;
  nConducteurs: number;
  montantEnAttente: number;
  recentAudits: Audit[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Mail} label="Documents" value={nDocuments} href={`/admin/clients/${societeId}?tab=documents`} />
        <StatCard icon={FileWarning} label="Contraventions" value={nContraventions} href={`/admin/clients/${societeId}?tab=contraventions`} />
        <StatCard icon={Car} label="Véhicules" value={nVehicules} href={`/admin/clients/${societeId}?tab=documents`} />
        <StatCard icon={Users} label="Conducteurs" value={nConducteurs} href={`/admin/clients/${societeId}?tab=utilisateurs`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Coordonnées</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <KV k="Contact principal" v={contactName || "—"} />
            <KV k="E-mail" v={email ?? "—"} />
            <KV k="Téléphone" v={phone ?? "—"} />
            <KV k="Adresse" v={[addressLine1, postalCode, city].filter(Boolean).join(", ") || "—"} />
            <KV k="Créé le" v={fmtDateTime(createdAt)} />
            <KV k="Dernière connexion" v={lastLogin ? fmtDateTime(lastLogin) : "Jamais connecté"} />
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-medium">{nContraventionsATraiter}</span> dossier(s) à traiter ·{" "}
            <span className="font-medium">{fmtMoney(montantEnAttente)}</span> en attente de règlement
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Actions récentes</h2>
          {recentAudits.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun événement pour le moment.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recentAudits.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <FileText size={14} className="mt-0.5 shrink-0 text-brand-500" />
                  <div>
                    <div className="font-medium text-slate-800">{humanizeAction(a.action)}</div>
                    {a.details && <div className="text-xs text-slate-500">{a.details}</div>}
                    <div className="text-[11px] text-slate-400">{a.acteur ? `${a.acteur} — ` : ""}{fmtDateTime(a.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
