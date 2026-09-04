import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import { requireSociete } from "@/lib/auth";
import { FileWarning, Mail, Send, ListChecks, ArrowRight, ShieldCheck, MessageCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { courrierTypeLabel } from "@/lib/courriers";
import { EnvoyerDocumentButton } from "./documents-envoyes/EnvoyerDocumentModal";

export const dynamic = "force-dynamic";

// Contact déjà configuré dans l'application (repris de la carte "Besoin d'aide ?" de la sidebar
// cliente) — jamais de fausse interface de messagerie tant qu'aucune n'existe réellement.
const SUPPORT_EMAIL = "contact@gestion-amendes.local";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

export default async function ClientDashboardPage() {
  const societe = await requireSociete();
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Espace client (2026-08-24): strict double filter — société AND visibleClient — a dossier
  // never appears here just because it belongs to this société.
  const [contraventions, courriers, envoyes] = await Promise.all([
    prisma.contravention.findMany({ where: { societe, visibleClient: true }, orderBy: { createdAt: "desc" } }),
    prisma.courrier.findMany({ where: { societe, visibleClient: true, type: { not: "client_envoi" } }, orderBy: { receivedAt: "desc" } }),
    prisma.courrier.count({ where: { societe, source: "CLIENT" } }),
  ]);

  const aTraiter = contraventions.filter((c) => c.statutDenonciation !== "Effectuée" && c.statutPaiement !== "Payé");
  const nouveauxDocuments = [
    ...contraventions.filter((c) => new Date(c.createdAt) >= since),
    ...courriers.filter((c) => new Date(c.receivedAt) >= since),
  ].length;

  // "Total des contraventions visibles non marquées comme réglées" — jamais les masquées,
  // supprimées, non transmises ou déjà réglées (déjà garanti par le filtre visibleClient ci-dessus).
  const contraventionsNonReglees = contraventions.filter((c) => c.statutPaiement !== "Payé");
  const montantRestant = contraventionsNonReglees.reduce((sum, c) => sum + (c.montantAmende ?? 0), 0);

  // ---- Actions à effectuer : dossiers non réglés, avec une action concrète + les retards ----
  type ActionItem = { id: string; label: string; action: string; retardJours?: number; href: string };
  const actionsAEffectuer: ActionItem[] = contraventionsNonReglees.map((c) => {
    const echeance = parseFrDate(c.dateLimitePaiement);
    const overdue = !!echeance && echeance.getTime() < now.getTime();
    const retardJours = overdue ? Math.round((now.getTime() - echeance!.getTime()) / 86400000) : undefined;
    return {
      id: c.id,
      label: c.numDossier,
      action: "Confirmer le paiement",
      retardJours,
      href: `/client/contraventions/${c.id}`,
    };
  });
  // Documents reçus qui attendent encore une lecture/réponse (mise en demeure non traitée).
  for (const item of courriers) {
    if (item.type !== "mise_en_demeure") continue;
    const data = item.data as { statut?: string } | null;
    const statut = data && typeof data === "object" ? data.statut : undefined;
    if (statut && statut !== "Traité" && statut !== "Archivé") {
      actionsAEffectuer.push({ id: item.id, label: item.fileName, action: "Consulter un document important", href: "/client/courriers" });
    }
  }

  // ---- Prochaines échéances : uniquement les dates futures, jamais un retard ancien ----
  const prochaines = contraventionsNonReglees
    .map((c) => ({ c, date: parseFrDate(c.dateLimitePaiement) }))
    .filter((x): x is { c: (typeof contraventions)[number]; date: Date } => !!x.date && x.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

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
      <div className="flex flex-col gap-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Espace client</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Bonjour {societe},</h1>
          <p className="mt-1 text-base font-medium text-slate-700">Bienvenue dans votre espace client.</p>
          <p className="mt-1 text-sm text-slate-500">
            Consultez les documents transmis par notre équipe et les actions qui nécessitent votre attention.
          </p>
        </div>
        <div className="flex items-center self-start">
          <EnvoyerDocumentButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Mail size={17} />} label="Nouveaux documents" value={nouveauxDocuments} hint="3 derniers jours" tone="info" href="/client/courriers" />
        <StatCard icon={<ListChecks size={17} />} label="Documents à traiter" value={aTraiter.length} tone={aTraiter.length > 0 ? "warning" : "success"} href="/client/contraventions?filtre=a_traiter" />
        <StatCard icon={<Send size={17} />} label="Documents envoyés" value={envoyes} tone="neutral" href="/client/documents-envoyes" />
        <StatCard
          icon={<FileWarning size={17} />}
          label="Montant restant à régler"
          value={fmtMoney(montantRestant)}
          hint="Contraventions visibles non réglées"
          tone={montantRestant > 0 ? "danger" : "success"}
          href="/client/contraventions?filtre=a_traiter"
        />
      </div>

      {actionsAEffectuer.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Actions à effectuer</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {actionsAEffectuer.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center justify-between gap-3 rounded-[10px] px-1 py-3 text-sm transition hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{item.label}</div>
                      <div className="truncate text-xs font-medium text-brand-700">→ {item.action}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.retardJours != null && (
                        <Badge tone="danger">En retard de {item.retardJours} j</Badge>
                      )}
                      <ArrowRight size={14} className="text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Documents récents</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <Link href={d.href} className="flex items-center justify-between gap-3 rounded-[10px] px-1 py-3 text-sm transition hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{d.label}</div>
                        <div className="text-xs text-slate-400">
                          {d.sousLabel}
                          {d.echeance && <span> · Échéance {d.echeance}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {d.statut && <Badge tone={statusTone(d.statut)}>{d.statut}</Badge>}
                        <span className="hidden text-xs font-medium text-brand-700 sm:inline">Consulter</span>
                        <ArrowRight size={14} className="text-slate-300" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {prochaines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prochaines échéances</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          <div className="rounded-[16px] border border-brand-100 bg-brand-700 p-5 text-white shadow-card">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <ShieldCheck size={20} />
            </div>
            <h3 className="mt-3 text-base font-semibold">Un accompagnement réactif</h3>
            <p className="mt-1 text-sm text-brand-50/90">
              Notre équipe reste à votre écoute pour toute question ou demande de précision.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
            >
              <MessageCircle size={14} /> Contacter notre équipe
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
