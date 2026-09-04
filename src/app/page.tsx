import { prisma } from "@/lib/prisma";
import { fmtMoney, fmtMoneyCents, fmtDateTime, humanizeFileName } from "@/lib/utils";
import Link from "next/link";
import {
  AlertTriangle,
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
import { requireSociete, isAdminSession, getUserId } from "@/lib/auth";
import { Badge, documentTypeTone, type BadgeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { OverviewBlock, type OverviewStat } from "@/components/dashboard/OverviewBlock";
import { PriorityPanel, type PriorityItem } from "@/components/dashboard/PriorityPanel";
import { WeeklyActivityChart, type DayActivity } from "@/components/dashboard/WeeklyActivityChart";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/CategoryDonut";
import { DeadlineList, type DeadlineItem } from "@/components/dashboard/DeadlineList";
import { ActivityList, type ActivityEntry } from "@/components/dashboard/ActivityList";
import { EmptyState as DashboardEmptyState } from "@/components/dashboard/EmptyState";
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

type ActivityBucket = { label: string; recus: number; traites: number };

function buildDailyBuckets(dates: { date: Date; traiteAt?: Date }[], days: number): ActivityBucket[] {
  const buckets: ActivityBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const recus = dates.filter((d) => d.date >= day && d.date < next).length;
    const traites = dates.filter((d) => d.traiteAt && d.traiteAt >= day && d.traiteAt < next).length;
    buckets.push({ label: day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), recus, traites });
  }
  return buckets;
}

function buildMonthlyBuckets(dates: { date: Date; traiteAt?: Date }[], months: number): ActivityBucket[] {
  const buckets: ActivityBucket[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const recus = dates.filter((d) => d.date >= monthStart && d.date < monthEnd).length;
    const traites = dates.filter((d) => d.traiteAt && d.traiteAt >= monthStart && d.traiteAt < monthEnd).length;
    buckets.push({ label: monthStart.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), recus, traites });
  }
  return buckets;
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
  /** Action concrète attendue de l'utilisateur pour ce dossier — jamais un simple statut. */
  action?: string;
  href: string | null;
  viewer?: { fileUrl: string; downloadUrl: string; fileName: string; fileMime: string };
};

const DEADLINE_ICONS: Record<string, LucideIcon> = {
  Contravention: FileWarning,
  "Mise en demeure": Scale,
  "Retard de paiement": ClockAlert,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const where = isAdmin ? {} : { societe };

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawPeriod = Array.isArray(resolvedSearchParams.periode) ? resolvedSearchParams.periode[0] : resolvedSearchParams.periode;
  const periode = rawPeriod === "30" || rawPeriod === "365" ? rawPeriod : "7";

  const userId = await getUserId();
  const currentUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  // "Admin"/"Compte" are placeholder prénoms auto-assigned at first login (see ensureUserForSociete) —
  // treated as "no real prénom set" so we never greet someone by a fabricated name.
  const prenom = currentUser?.prenom && !["Admin", "Compte"].includes(currentUser.prenom) ? currentUser.prenom : null;

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

  function actionAttendueContravention(c: (typeof contraventions)[number]): string {
    if (!c.conducteurId) return "Identifier le conducteur";
    if (!c.natureInfraction || !c.montantAmende) return "Compléter les informations manquantes";
    if (c.statutDenonciation !== "Effectuée") return "Transmettre le document au client";
    if (c.statutPaiement !== "Payé") return "Effectuer ou confirmer le paiement";
    return "Classer le document";
  }

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
      action: actionAttendueContravention(c),
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
        action: traite
          ? undefined
          : statut === "À vérifier" || (!d.motif && !d.reference)
            ? "Vérifier les informations extraites"
            : "Transmettre le document au client",
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
        action: traite ? undefined : "Effectuer ou confirmer le paiement",
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

  // ---- Activité documentaire (période sélectionnable 7j / 30j / 12 mois) ----
  const weeklyActivity: DayActivity[] =
    periode === "365" ? buildMonthlyBuckets(docs, 12) : buildDailyBuckets(docs, periode === "30" ? 30 : 7);

  // ---- Répartition par catégorie ---- (colors matched to Badge's documentTypeTone palette)
  const categories: CategorySlice[] = [
    { label: "Contraventions", value: docs.filter((d) => d.typeLabel === "Contravention").length, color: "#6366f1" },
    { label: "Mises en demeure", value: docs.filter((d) => d.typeLabel === "Mise en demeure").length, color: "#f76a55" },
    { label: "Retards de paiement", value: docs.filter((d) => d.typeLabel === "Retard de paiement").length, color: "#f97316" },
    { label: "Certificats d'immatriculation", value: docs.filter((d) => d.typeLabel === "Certificat d'immatriculation").length, color: "#14b8a6" },
    { label: "Sinistres", value: 0, color: "#8b5cf6" },
    { label: "Pub", value: docs.filter((d) => d.typeLabel === "Pub").length, color: "#94a3b8" },
  ];

  // ---- Échéances : deux blocs distincts, jamais mélangés (§4 du cahier des charges) ----
  const futureDeadlines: DeadlineItem[] = docs
    .filter((d) => d.echeance && !d.traite && d.echeance.getTime() >= now.getTime())
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
    .slice(0, 6)
    .map((d) => ({
      icon: DEADLINE_ICONS[d.typeLabel] ?? Clock,
      title: d.typeLabel,
      subtitle: `${d.label} — ${d.societe}`,
      date: d.echeance!,
      href: d.href ?? "/courriers",
    }));

  const overdueDeadlines: DeadlineItem[] = docs
    .filter((d) => d.echeance && !d.traite && d.echeance.getTime() < now.getTime())
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
    activity.push({
      icon: ScanLine,
      tone: "brand",
      label: humanizeFileName(scan.fileName),
      meta: scan.fileName,
      societe: scan.societe,
      date: scan.receivedAt,
    });
    if (scan.processedAt && (scan.status === "analyzed" || scan.status === "created")) {
      activity.push({
        icon: FileCheck2,
        tone: "success",
        label: `${humanizeFileName(scan.fileName)} — traité`,
        meta: scan.fileName,
        societe: scan.societe,
        date: scan.processedAt,
      });
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

  // "À traiter aujourd'hui" — reuses the exact same `urgent` flag already computed per-document
  // above (contraventions en retard/échéance proche, mises en demeure/retards de paiement en
  // retard...), just reshaped into the row format this panel expects. No new data, no fabrication.
  const priorityItems: PriorityItem[] = docs
    .filter((d) => d.urgent)
    .slice(0, 6)
    .map((d) => {
      const overdue = !!d.echeance && d.echeance.getTime() < Date.now();
      return {
        icon: DEADLINE_ICONS[d.typeLabel] ?? AlertTriangle,
        tone: d.statutTone === "danger" || overdue ? "danger" : "warning",
        title: d.typeLabel,
        subtitle: d.label,
        societe: d.societe,
        action: d.action,
        meta: d.echeance
          ? overdue
            ? `En retard de ${Math.round((Date.now() - d.echeance.getTime()) / 86400000)} j`
            : d.echeance.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
          : undefined,
        href: d.href ?? "/courriers",
      };
    });

  const overviewStats: OverviewStat[] = [
    { icon: FileText, tone: "brand", value: totalDocuments, label: "Documents reçus", hint: docsThisMonth > 0 ? `+${docsThisMonth} ce mois` : undefined, href: "/courriers" },
    { icon: Clock, tone: "warning", value: aTraiterCount, label: "Documents à traiter", hint: `${traitesCount} traité${traitesCount > 1 ? "s" : ""}`, href: "/contraventions?view=denonciations" },
    { icon: AlertTriangle, tone: "danger", value: urgentsCount, label: "Dossiers urgents", hint: urgentsCount > 0 ? "Action requise" : "Aucune action requise", href: "/contraventions?view=retards" },
    {
      icon: Wallet,
      tone: "violet",
      value: fmtMoney(montantEnAttente),
      label: "Montant total à régulariser",
      hint: `Contraventions + retards de paiement non soldés${dossiersNonSoldes > 0 ? ` (${dossiersNonSoldes} dossier${dossiersNonSoldes > 1 ? "s" : ""})` : ""}`,
      href: "/contraventions?view=paiements",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-[13px] font-medium text-slate-400">{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</p>
        <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-slate-900">
          Voici les éléments qui nécessitent votre attention aujourd&apos;hui.
        </h1>
      </div>

      {/* Asymmetric two-column body: colonne principale (synthèse, activité, documents) à
          gauche, colonne secondaire (urgences, répartition, échéances, activité récente) à
          droite — un seul flux vertical par colonne plutôt que des rangées de cartes identiques. */}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <OverviewBlock stats={overviewStats} />

          <SectionCard
            title="Activité documentaire"
            description={periode === "365" ? "Sur les 12 derniers mois" : `Sur les ${periode} derniers jours`}
            tint="muted"
          >
            <div className="mb-2 flex items-center justify-end gap-1">
              {([
                { key: "7", label: "7 jours" },
                { key: "30", label: "30 jours" },
                { key: "365", label: "12 mois" },
              ] as const).map((opt) => (
                <Link
                  key={opt.key}
                  href={opt.key === "7" ? "/" : `/?periode=${opt.key}`}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition ${
                    periode === opt.key ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
            <WeeklyActivityChart data={weeklyActivity} />
          </SectionCard>

          <SectionCard title="Documents récents" action={{ label: "Voir tous les documents", href: "/courriers" }} bodyClassName="p-0 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-[13px]">
                <thead className="table-head">
                  <tr>
                    <th className="p-3 pl-5 text-left">Document</th>
                    <th className="p-3 text-left">Catégorie</th>
                    <th className="p-3 text-left">Société</th>
                    <th className="p-3 text-left">Date de réception</th>
                    <th className="p-3 text-left">Statut</th>
                    <th className="p-3 pr-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {derniersDocuments.map((d) => (
                    <tr key={d.id} className="transition-colors duration-100 hover:bg-blue-50/40">
                      <td className="p-3 pl-5">
                        {d.href ? (
                          <Link href={d.href} title={d.label} className="block max-w-[220px] truncate font-medium text-slate-800 hover:underline">{d.label}</Link>
                        ) : (
                          <span title={d.label} className="block max-w-[220px] truncate font-medium text-slate-800">{d.label}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge tone={documentTypeTone(d.typeLabel)}>{d.typeLabel}</Badge>
                      </td>
                      <td className="p-3 text-slate-600">{d.societe}</td>
                      <td className="p-3 whitespace-nowrap text-slate-600">{fmtDateTime(d.date)}</td>
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
                                <Link href={d.href} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Ouvrir le dossier</Link>
                              </div>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {derniersDocuments.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <DashboardEmptyState
                          icon={FilePlus2}
                          title="Aucun document pour le moment"
                          description="Scannez votre première contravention pour voir apparaître les documents ici."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5 xl:col-span-1">
          <PriorityPanel items={priorityItems} title="À traiter aujourd'hui" />

          <SectionCard title="Répartition des documents">
            <CategoryDonut segments={categories} total={totalDocuments} />
          </SectionCard>

          <SectionCard title="Dossiers en retard" action={{ label: "Tout voir", href: "/courriers" }}>
            <DeadlineList items={overdueDeadlines} />
          </SectionCard>

          <SectionCard title="Prochaines échéances" action={{ label: "Tout voir", href: "/courriers" }}>
            <DeadlineList items={futureDeadlines} />
          </SectionCard>

          <SectionCard title="Activité récente">
            <ActivityList items={recentActivity} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

