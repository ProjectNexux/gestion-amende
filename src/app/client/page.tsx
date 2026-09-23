import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import { requireSociete } from "@/lib/auth";
import {
  FileWarning,
  Mail,
  MailOpen,
  Send,
  Wallet,
  AlertTriangle,
  CalendarClock,
  Bell,
  ArrowRight,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { courrierTypeLabel, COURRIER_LIST_SELECT } from "@/lib/courriers";
import { EnvoyerDocumentButton } from "./documents-envoyes/EnvoyerDocumentModal";

export const dynamic = "force-dynamic";

// Contact déjà configuré dans l'application — jamais de fausse interface de messagerie tant
// qu'aucune n'existe réellement.
const SUPPORT_EMAIL = "contact@gestion-amendes.local";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone: "teal" | "amber" | "rose" | "slate";
  href: string;
}) {
  const toneClasses: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${toneClasses[tone]}`}>
        <Icon size={17} />
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </Link>
  );
}

export default async function ClientDashboardPage() {
  const societe = await requireSociete();
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Espace client (2026-08-24, refonte 2026-09-23): strict double filter — société AND
  // visibleClient — a dossier never appears here just because it belongs to this société.
  const [contraventions, courriers, envoyes] = await Promise.all([
    prisma.contravention.findMany({ where: { societe, visibleClient: true }, orderBy: { createdAt: "desc" } }),
    prisma.courrier.findMany({ where: { societe, visibleClient: true, type: { not: "client_envoi" } }, orderBy: { receivedAt: "desc" }, select: COURRIER_LIST_SELECT }),
    prisma.courrier.count({ where: { societe, source: "CLIENT" } }),
  ]);

  const isCourrierRead = (c: (typeof courriers)[number]) => (c.data as { isRead?: boolean } | null)?.isRead === true;
  const documentsNonLus = courriers.filter((c) => !isCourrierRead(c));

  const aTraiter = contraventions.filter((c) => c.statutDenonciation !== "Effectuée" && c.statutPaiement !== "Payé");
  const contraventionsNonReglees = contraventions.filter((c) => c.statutPaiement !== "Payé");
  const montantRestant = contraventionsNonReglees.reduce((sum, c) => sum + (c.montantAmende ?? 0), 0);
  const dossiersEnRetard = contraventionsNonReglees.filter((c) => {
    const echeance = parseFrDate(c.dateLimitePaiement);
    return !!echeance && echeance.getTime() < now.getTime();
  });

  const nouveauxDocuments = [
    ...contraventions.filter((c) => new Date(c.createdAt) >= since),
    ...courriers.filter((c) => new Date(c.receivedAt) >= since),
  ].length;

  // ---- Actions demandées par l'administrateur : dossiers non réglés + mises en demeure non traitées ----
  type ActionItem = { id: string; label: string; action: string; retardJours?: number; href: string };
  const actionsAEffectuer: ActionItem[] = contraventionsNonReglees.map((c) => {
    const echeance = parseFrDate(c.dateLimitePaiement);
    const overdue = !!echeance && echeance.getTime() < now.getTime();
    const retardJours = overdue ? Math.round((now.getTime() - echeance!.getTime()) / 86400000) : undefined;
    return { id: c.id, label: c.numDossier, action: "Confirmer le paiement", retardJours, href: `/client/contraventions/${c.id}` };
  });
  for (const item of courriers) {
    if (item.type !== "mise_en_demeure") continue;
    const data = item.data as { statut?: string } | null;
    const statut = data && typeof data === "object" ? data.statut : undefined;
    if (statut && statut !== "Traité" && statut !== "Archivé") {
      actionsAEffectuer.push({ id: item.id, label: item.fileName, action: "Consulter un document important", href: "/client/courriers" });
    }
  }

  // ---- Prochaines échéances : uniquement les dates futures ----
  const prochaines = contraventionsNonReglees
    .map((c) => ({ c, date: parseFrDate(c.dateLimitePaiement) }))
    .filter((x): x is { c: (typeof contraventions)[number]; date: Date } => !!x.date && x.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  // ---- Activité récente : flux unifié contraventions + courriers, trié par date ----
  const activite = [
    ...contraventions.map((c) => ({
      id: `c-${c.id}`,
      label: c.numDossier,
      detail: c.statutPaiement === "Payé" ? "Paiement enregistré" : "Contravention transmise",
      date: c.updatedAt,
      href: `/client/contraventions/${c.id}`,
    })),
    ...courriers.map((c) => ({
      id: `d-${c.id}`,
      label: c.fileName,
      detail: `${courrierTypeLabel(c.type)} reçu(e)`,
      date: c.receivedAt,
      href: "/client/courriers",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const documentsRecents = [
    ...contraventions.map((c) => ({
      id: c.id,
      kind: "contravention" as const,
      label: c.numDossier,
      sousLabel: c.natureInfraction ?? "Contravention",
      statut: c.statutPaiement,
      echeance: c.dateLimitePaiement,
      date: c.createdAt,
      href: `/client/contraventions/${c.id}`,
    })),
    ...courriers.map((c) => ({
      id: c.id,
      kind: "courrier" as const,
      label: c.fileName,
      sousLabel: courrierTypeLabel(c.type),
      statut: null as string | null,
      echeance: null as string | null,
      date: c.receivedAt,
      href: `/client/courriers`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[20px] bg-gradient-to-br from-teal-600 to-slate-900 p-6 text-white shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-200">Portail société</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Bonjour {societe},</h1>
          <p className="mt-1 text-sm text-teal-50/90">
            Retrouvez vos documents, vos contraventions et les actions qui nécessitent votre attention.
          </p>
        </div>
        <div className="flex items-center self-start">
          <EnvoyerDocumentButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile icon={Mail} label="Documents reçus" value={courriers.length} tone="teal" href="/client/courriers" />
        <KpiTile icon={MailOpen} label="Non lus" value={documentsNonLus.length} tone={documentsNonLus.length > 0 ? "amber" : "slate"} href="/client/courriers" />
        <KpiTile icon={FileWarning} label="Contraventions à traiter" value={aTraiter.length} tone={aTraiter.length > 0 ? "amber" : "slate"} href="/client/contraventions" />
        <KpiTile icon={Wallet} label="Paiements en attente" value={fmtMoney(montantRestant)} tone={montantRestant > 0 ? "amber" : "slate"} href="/client/contraventions?view=paiement_attente" />
        <KpiTile icon={AlertTriangle} label="Dossiers en retard" value={dossiersEnRetard.length} tone={dossiersEnRetard.length > 0 ? "rose" : "slate"} href="/client/contraventions?view=en_retard" />
        <KpiTile icon={Send} label="Documents envoyés" value={envoyes} tone="slate" href="/client/documents-envoyes" />
      </div>

      {actionsAEffectuer.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">Actions demandées par l&apos;administrateur</h2>
          <ul className="divide-y divide-amber-100">
            {actionsAEffectuer.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-sm transition hover:bg-white/60">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{item.label}</div>
                    <div className="truncate text-xs font-medium text-teal-700">→ {item.action}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.retardJours != null && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">En retard de {item.retardJours} j</span>
                    )}
                    <ArrowRight size={14} className="text-slate-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Documents récents</h2>
            {documentsRecents.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="Aucun document reçu pour le moment."
                description="Les documents transmis par notre équipe apparaîtront ici."
                action={{ label: "Envoyer un document", href: "/client/documents-envoyes" }}
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {documentsRecents.map((d) => (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link href={d.href} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-sm transition hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{d.label}</div>
                        <div className="text-xs text-slate-400">
                          {d.sousLabel}
                          {d.echeance && <span> · Échéance {d.echeance}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {d.statut && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{d.statut}</span>}
                        <ArrowRight size={14} className="text-slate-300" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Activité récente</h2>
            {activite.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune activité pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {activite.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm transition hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{a.label}</div>
                        <div className="text-xs text-slate-400">{a.detail}</div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(a.date).toLocaleDateString("fr-FR")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Bell size={15} className="text-teal-600" /> Notifications</h2>
            {nouveauxDocuments === 0 ? (
              <p className="text-sm text-slate-500">Aucune notification récente.</p>
            ) : (
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-teal-700">{nouveauxDocuments}</span> nouveau(x) document(s) au cours des 3 derniers jours.
              </p>
            )}
          </div>

          {prochaines.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarClock size={15} className="text-teal-600" /> Prochaines échéances</h2>
              <ul className="space-y-2">
                {prochaines.map(({ c, date }) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <Link href={`/client/contraventions/${c.id}`} className="font-medium text-slate-700 hover:underline">
                      {c.numDossier}
                    </Link>
                    <span className="text-slate-500">{date.toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-card">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-500/20 text-teal-300">
              <MessageCircle size={20} />
            </div>
            <h3 className="mt-3 text-base font-semibold">Un accompagnement réactif</h3>
            <p className="mt-1 text-sm text-slate-300">
              Consultez le guide ou contactez notre équipe pour toute question.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/client/aide" className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-teal-400">
                Assistance et guide
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15">
                Nous contacter
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
