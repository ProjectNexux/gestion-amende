import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </Link>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </header>
  );
}

export function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue} required={required} className="field" />
    </label>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</div>
      <div className="mt-0.5 text-slate-800">{v}</div>
    </div>
  );
}

export function humanizeAction(a: string): string {
  const map: Record<string, string> = {
    creation: "Client créé",
    invitation_envoyee: "Invitation envoyée",
    compte_active: "Compte activé",
    connexion: "Connexion",
    code_regenere: "Lien d'accès régénéré",
    informations_modifiees: "Informations modifiées",
    desactivation: "Compte désactivé",
    reactivation: "Compte réactivé",
    archivage: "Société archivée",
    desarchivage: "Société désarchivée",
    utilisateur_active: "Utilisateur activé",
    utilisateur_desactive: "Utilisateur désactivé",
    utilisateur_supprime: "Utilisateur supprimé",
    document_transmis: "Document transmis au client",
    document_retire: "Document retiré du portail client",
  };
  return map[a] ?? a;
}
