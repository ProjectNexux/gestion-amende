import { prisma } from "@/lib/prisma";
import { fmtMoney, fmtMoneyCents, fmtDateTime } from "@/lib/utils";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ClockAlert,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  FileWarning,
  IdCard,
  Mail,
  MoreHorizontal,
  Scale,
  ScanLine,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { WeeklyActivityChart, type DayActivity } from "@/components/dashboard/WeeklyActivityChart";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/CategoryDonut";
import { DeadlineList, type DeadlineItem } from "@/components/dashboard/DeadlineList";
import { ActivityList, type ActivityEntry } from "@/components/dashboard/ActivityList";
import {
  getMiseEnDemeureData,
  getPubData,
  getRetardPaiementData,
  resteAPayer,
  getImmatriculation,
} from "@/lib/courriers";

export const dynamic = "force-dynamic";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// One row of the unified "Derniers documents reçus" table, built from every real document source
// in the app (contraventions + every Courrier type). No fabricated fields — only what each model
// actually stores.
type UnifiedDoc = {
  id: string;
  typeLabel: string;
  label: string;
  societe: string;
  date: Date;
  traiteAt?: Date; // best-effort real timestamp for when the item became "traité" (used by the 7-day chart only)
  echeance: Date | null;
  statutLabel: string;
  statutTone: BadgeTone;
  traite: boolean;
  urgent: boolean;
  href: string | null;
  viewer?: { fileUrl: string; downloadUrl: string; fileName: string; fileMime: string };
};

const DEADLINE_ICONS: Record<string, LucideIcon> = {
  Contravention: FileWarning,
  "Mise en demeure": Scale,
  "Retard de paiement": ClockAlert,
};

export default async function DashboardPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const where = isAdmin ? {} : { societe };

  const [contraventions, courriers, recentScans] = await Promise.all([
    prisma.contravention.findMany({ where, include: { vehicule: true, conducteur: true }, orderBy: { createdAt: "desc" } }),
    prisma.courrier.findMany({ where, orderBy: { receivedAt: "desc" } }),
    prisma.emailScan.findMany({ where, orderBy: { receivedAt: "desc" }, take: 8 }),
  ]);

  const retardCourrierIds = courriers.filter((c) => c.type === "retard_paiement").map((c) => c.id);
  const paiementsReussis = retardCourrierIds.length
    ? await prisma.paiement.findMany({
        where: { linkedType: "retard_paiement", linkedId: { in: retardCourrierIds }, statut: "reussi" },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  const isEcheanceProche = (c: (typeof contraventions)[number]) => {
    if (c.statutDenonciation === "Effectuée") return false;
    const date = parseFrDate(c.dateInfraction);
    if (!date) return false;
    const diff = (Date.now() - date.getTime()) / 86400000;
    return diff >= 30 && diff < 45;
  };
  const isEnRetard = (c: (typeof contraventions)[number]) => {
    if (c.statutPaiement === "Payé") return false;
    const date = parseFrDate(c.dateLimitePaiement);
    if (!date) return false;
    return date.getTime() < Date.now();
  };

  // Purely presentational: derive a single display status per contravention from existing fields.
  function displayStatus(c: (typeof contraventions)[number]): { label: string; tone: BadgeTone } {
    const isNew = (Date.now() - new Date(c.createdAt).getTime()) / 86400000 <= 3;
    if (c.statutPaiement === "Payé") return { label: "Payé", tone: "success" };
    if (isEnRetard(c)) return { label: "En retard", tone: "danger" };
    if (isNew && c.statutDenonciation !== "Effectuée") return { label: "Nouveau", tone: "info" };
    if (c.statutDenonciation !== "Effectuée") return { label: "À traiter", tone: "warning" };
    if (c.statutPaiement === "En attente") return { label: "En attente", tone: "warning" };
    return { label: c.statutPaiement ?? "—", tone: "neutral" };
  }

  // ---- Build the unified document list (single source of truth for KPIs, chart, table) ----
  const docs: UnifiedDoc[] = [];

  for (const c of contraventions) {
    const s = displayStatus(c);
    const traite = c.statutDenonciation === "Effectuée";
    docs.push({
      id: c.id,
      typeLabel: "Contravention",
      label: c.natureInfraction ?? c.numDossier,
      societe: c.societe,
      date: c.createdAt,
      traiteAt: traite ? parseFrDate(c.dateDenonciation) ?? c.updatedAt : undefined,
      echeance: parseFrDate(c.dateLimitePaiement),
      statutLabel: s.label,
      statutTone: s.tone,
      traite,
      urgent: isEnRetard(c) || isEcheanceProche(c),
      href: `/contraventions/${c.id}`,
    });
  }

  for (const item of courriers) {
    const viewer = { fileUrl: `/api/courriers/${item.id}`, downloadUrl: `/api/courriers/${item.id}?download=1`, fileName: item.fileName, fileMime: item.fileMime };

    if (item.type === "mise_en_demeure") {
      const d = getMiseEnDemeureData(item.data);
      const statut = d.statut as string | undefined;
      const echeance = parseFrDate(d.echeance ?? null);
      const traite = statut === "Traité" || statut === "Archivé";
      const overdue = !!echeance && echeance.getTime() < Date.now() && !traite;
      docs.push({
        id: item.id,
        typeLabel: "Mise en demeure",
        label: d.motif ?? d.reference ?? d.expediteur ?? "Mise en demeure",
        societe: item.societe,
        date: item.receivedAt,
        traiteAt: traite ? item.updatedAt : undefined,
        echeance,
        statutLabel: statut ?? "Nouveau",
        statutTone: traite ? "success" : statut === "À traiter" || statut === "À vérifier" ? "warning" : "info",
        traite,
        urgent: !traite && (overdue || (!!echeance && (echeance.getTime() - Date.now()) / 86400000 <= 3)),
        href: `/courriers/mise-en-demeure/${item.id}`,
        viewer,
      });
    } else if (item.type === "retard_paiement") {
      const d = getRetardPaiementData(item.data);
      const reste = resteAPayer(d);
      const echeance = parseFrDate(d.dateEcheance ?? null);
      const traite = d.statutPaiement === "Payé" || d.statutPaiement === "Remboursé";
      const overdue = !!echeance && echeance.getTime() < Date.now() && reste > 0;
      docs.push({
        id: item.id,
        typeLabel: "Retard de paiement",
        label: d.debiteur ?? d.reference ?? "Retard de paiement",
        societe: d.beneficiaire ?? item.societe,
        date: item.receivedAt,
        traiteAt: traite ? item.updatedAt : undefined,
        echeance,
        statutLabel: d.statutPaiement ?? "Non payé",
        statutTone: traite ? "success" : d.statutPaiement === "Échec de paiement" ? "danger" : reste > 0 ? "warning" : "neutral",
        traite,
        urgent: !traite && (overdue || d.statutPaiement === "Échec de paiement"),
        href: `/courriers/retards-paiement/${item.id}`,
        viewer,
      });
    } else if (item.type === "certificat_immatriculation") {
      docs.push({
        id: item.id,
        typeLabel: "Certificat d'immatriculation",
        label: getImmatriculation(item.data) || "Certificat",
        societe: item.societe,
        date: item.receivedAt,
        traiteAt: item.receivedAt,
        echeance: null,
        statutLabel: "Archivé",
        statutTone: "success",
        traite: true,
        urgent: false,
        href: `/courriers/certificats-immatriculation/${item.id}`,
        viewer,
      });
    } else if (item.type === "pub") {
      const d = getPubData(item.data);
      docs.push({
        id: item.id,
        typeLabel: "Pub",
        label: d.expediteur ?? "Publicité",
        societe: item.societe,
        date: item.receivedAt,
        traiteAt: item.receivedAt,
        echeance: null,
        statutLabel: d.conserve ? "Conservé" : "Suppression auto",
        statutTone: d.conserve ? "success" : "neutral",
        traite: true,
        urgent: false,
        href: null,
        viewer,
      });
    }
  }

  docs.sort((a, b) => b.date.getTime() - a.date.getTime());

  // ---- KPIs ----
  const now = new Date();
  const totalDocuments = docs.length;
  const traitesCount = docs.filter((d) => d.traite).length;
  const aTraiterCount = totalDocuments - traitesCount;
  const urgentsCount = docs.filter((d) => d.urgent).length;
  const docsThisMonth = docs.filter((d) => d.date.getFullYear() === now.getFullYear() && d.date.getMonth() === now.getMonth()).length;

  const montantContraventionsEnAttente = contraventions
    .filter((c) => c.statutPaiement !== "Payé")
    .reduce((acc, c) => acc + (c.montantAmende ?? 0), 0);
  const montantRetardsEnAttente =
    courriers
      .filter((c) => c.type === "retard_paiement")
      .reduce((acc, c) => acc + resteAPayer(getRetardPaiementData(c.data)), 0) / 100;
  const montantEnAttente = montantContraventionsEnAttente + montantRetardsEnAttente;
  const dossiersNonSoldes = docs.filter((d) => !d.traite).length;

  // ---- Activité des 7 derniers jours ----
  const weeklyActivity: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const recus = docs.filter((d) => d.date >= day && d.date < next).length;
    const traites = docs.filter((d) => d.traiteAt && d.traiteAt >= day && d.traiteAt < next).length;
    weeklyActivity.push({ label: day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), recus, traites });
  }

  // ---- Répartition par catégorie ----
  const categories: CategorySlice[] = [
    { label: "Contraventions", value: docs.filter((d) => d.typeLabel === "Contravention").length, color: "#3b82f6" },
    { label: "Mises en demeure", value: docs.filter((d) => d.typeLabel === "Mise en demeure").length, color: "#f43f5e" },
    { label: "Retards de paiement", value: docs.filter((d) => d.typeLabel === "Retard de paiement").length, color: "#f59e0b" },
    { label: "Certificats d'immatriculation", value: docs.filter((d) => d.typeLabel === "Certificat d'immatriculation").length, color: "#14b8a6" },
    { label: "Sinistres", value: 0, color: "#8b5cf6" },
    { label: "Pub", value: docs.filter((d) => d.typeLabel === "Pub").length, color: "#94a3b8" },
  ];

  // ---- Échéances proches ----
  const deadlineItems: DeadlineItem[] = docs
    .filter((d) => d.echeance && !d.traite)
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
    .slice(0, 6)
    .map((d) => ({
      icon: DEADLINE_ICONS[d.typeLabel] ?? Clock,
      title: d.typeLabel,
      subtitle: `${d.label} — ${d.societe}`,
      date: d.echeance!,
      href: d.href ?? "/courriers",
    }));

  // ---- Activité récente ----
  const activity: ActivityEntry[] = [];
  for (const scan of recentScans) {
    activity.push({ icon: ScanLine, tone: "brand", label: "Nouveau scan reçu", meta: scan.fileName, date: scan.receivedAt });
    if (scan.processedAt && (scan.status === "analyzed" || scan.status === "created")) {
      activity.push({ icon: FileCheck2, tone: "success", label: "Document traité", meta: scan.fileName, date: scan.processedAt });
    }
  }
  for (const c of contraventions) {
    if (c.conducteurId && c.conducteur) {
      activity.push({ icon: UserCheck, tone: "brand", label: "Conducteur associé", meta: c.numDossier, date: c.createdAt });
    }
    if (c.statutPaiement === "Payé") {
      activity.push({ icon: Wallet, tone: "violet", label: "Paiement enregistré", meta: c.numDossier, date: parseFrDate(c.datePaiement) ?? c.updatedAt });
    }
  }
  for (const item of courriers) {
    if (item.type === "certificat_immatriculation") {
      activity.push({ icon: IdCard, tone: "brand", label: "Certificat ajouté", meta: getImmatriculation(item.data) || item.fileName, date: item.receivedAt });
      continue;
    }
    const labelByType: Record<string, string> = {
      mise_en_demeure: "Mise en demeure reçue",
      retard_paiement: "Retard de paiement ajouté",
      pub: "Document classé Pub",
    };
    activity.push({ icon: Mail, tone: "brand", label: labelByType[item.type] ?? "Nouveau courrier reçu", meta: item.fileName, date: item.receivedAt });
    if (item.type === "mise_en_demeure") {
      const d = getMiseEnDemeureData(item.data);
      const statut = d.statut as string | undefined;
      if ((statut === "Traité" || statut === "Archivé") && item.updatedAt.getTime() !== item.createdAt.getTime()) {
        activity.push({ icon: FileCheck2, tone: "success", label: "Statut modifié — Mise en demeure traitée", meta: d.motif ?? item.fileName, date: item.updatedAt });
      }
    }
  }
  for (const p of paiementsReussis) {
    activity.push({ icon: Wallet, tone: "violet", label: "Paiement enregistré", meta: `${fmtMoneyCents(p.montant)} — ${p.societe}`, date: p.updatedAt });
  }
  activity.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivity = activity.slice(0, 7);

  const derniersDocuments = docs.slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre activité, de vos documents et de vos échéances."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={urgentsCount > 0 ? "/contraventions?view=retards" : "#"}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
              title="Notifications"
            >
              <Bell size={18} />
              {urgentsCount > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
                  {urgentsCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {societe.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="max-w-[140px] truncate text-[13px] font-semibold text-slate-800">{societe}</div>
                <div className="truncate text-[11px] text-slate-400">{isAdmin ? "Administrateur" : "Membre"}</div>
              </div>
            </div>
            <Link href="/contraventions/scan" className={buttonVariants({ variant: "primary" })}>
              <FilePlus2 size={16} />
              Nouveau document
            </Link>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={FileText} tone="brand" label="Total documents" value={totalDocuments} hint={docsThisMonth > 0 ? `+${docsThisMonth} ce mois` : undefined} />
        <KpiCard
          icon={CheckCircle2}
          tone="success"
          label="Traités"
          value={traitesCount}
          hint={totalDocuments > 0 ? `${Math.round((traitesCount / totalDocuments) * 100)}% du total` : undefined}
        />
        <KpiCard
          icon={Clock}
          tone="warning"
          label="À traiter"
          value={aTraiterCount}
          hint={urgentsCount > 0 ? `+${urgentsCount} urgent${urgentsCount > 1 ? "s" : ""}` : undefined}
        />
        <KpiCard icon={AlertTriangle} tone="danger" label="Urgents" value={urgentsCount} hint={urgentsCount > 0 ? "Action requise" : "Aucune action requise"} />
        <KpiCard
          icon={Wallet}
          tone="violet"
          label="Montant en attente"
          value={fmtMoney(montantEnAttente)}
          hint={dossiersNonSoldes > 0 ? `${dossiersNonSoldes} dossier${dossiersNonSoldes > 1 ? "s" : ""} non soldé${dossiersNonSoldes > 1 ? "s" : ""}` : undefined}
        />
      </div>

      {/* Analytics row */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Activité des 7 derniers jours" className="xl:col-span-2">
          <WeeklyActivityChart data={weeklyActivity} />
        </SectionCard>
        <SectionCard title="Répartition par catégorie">
          <CategoryDonut segments={categories} total={totalDocuments} />
        </SectionCard>
        <SectionCard title="Échéances proches" action={{ label: "Tout voir", href: "/courriers" }}>
          <DeadlineList items={deadlineItems} />
        </SectionCard>
      </div>

      {/* Documents + activity row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Derniers documents reçus" action={{ label: "Voir tous les courriers", href: "/courriers" }} className="xl:col-span-2" bodyClassName="p-0 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <thead className="bg-slate-50/80 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 pl-5 text-left">Document</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Société/Client</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Échéance</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {derniersDocuments.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-3 pl-5">
                      {d.href ? (
                        <Link href={d.href} className="font-medium text-slate-800 hover:underline">{d.label}</Link>
                      ) : (
                        <span className="font-medium text-slate-800">{d.label}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge tone="neutral">{d.typeLabel}</Badge>
                    </td>
                    <td className="p-3 text-slate-600">{d.societe}</td>
                    <td className="p-3 text-slate-600">{fmtDateTime(d.date)}</td>
                    <td className="p-3 text-slate-600">
                      {d.echeance ? d.echeance.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                    </td>
                    <td className="p-3">
                      <Badge tone={d.statutTone}>{d.statutLabel}</Badge>
                    </td>
                    <td className="p-3 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.viewer && (
                          <DocumentViewerTrigger
                            fileUrl={d.viewer.fileUrl}
                            downloadUrl={d.viewer.downloadUrl}
                            fileName={d.viewer.fileName}
                            fileMime={d.viewer.fileMime}
                            title="Visualiser"
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Eye size={15} />
                          </DocumentViewerTrigger>
                        )}
                        {d.viewer && (
                          <a
                            href={d.viewer.downloadUrl}
                            title="Télécharger"
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Download size={15} />
                          </a>
                        )}
                        {d.href && (
                          <details className="group relative inline-block text-left">
                            <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
                              <MoreHorizontal size={16} />
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-card-hover">
                              <Link href={d.href} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Voir la fiche</Link>
                            </div>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {derniersDocuments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Aucun document. <Link href="/contraventions/scan" className="text-blue-600 underline">Scanner la première contravention</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Activité récente">
          <ActivityList items={recentActivity} />
        </SectionCard>
      </div>
    </div>
  );
}

