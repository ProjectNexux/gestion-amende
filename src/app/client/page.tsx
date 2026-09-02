import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import { requireSociete } from "@/lib/auth";
import { FileWarning, Mail, Send, ListChecks, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { courrierTypeLabel } from "@/lib/courriers";
import { EnvoyerDocumentButton } from "./documents-envoyes/EnvoyerDocumentModal";

export const dynamic = "force-dynamic";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

export default async function ClientDashboardPage() {
  const societe = await requireSociete();
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

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

  const montantRestant = contraventions.filter((c) => c.statutPaiement !== "Payé").reduce((sum, c) => sum + (c.montantAmende ?? 0), 0);

  const prochaines = contraventions
    .map((c) => ({ c, date: parseFrDate(c.dateLimitePaiement) }))
    .filter((x): x is { c: (typeof contraventions)[number]; date: Date } => !!x.date && x.c.statutPaiement !== "Payé")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const documentsRecents = [
    ...contraventions.map((c) => ({
      id: c.id,
      kind: "contravention" as const,
      label: c.numDossier,
      sousLabel: c.natureInfraction ?? "Contravention",
      statut: c.statutPaiement,
      date: c.createdAt,
      href: `/client/contraventions/${c.id}`,
    })),
    ...courriers.map((c) => ({
      id: c.id,
      kind: "courrier" as const,
      label: c.fileName,
      sousLabel: courrierTypeLabel(c.type),
      statut: null as string | null,
      date: c.receivedAt,
      href: `/client/courriers`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Bonjour, bienvenue dans votre espace {societe}</h1>
        <p className="mt-1 text-sm text-slate-500">Voici un aperçu des documents que notre équipe partage avec vous.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Mail size={17} />} label="Documents disponibles" value={contraventions.length + courriers.length} tone="brand" />
        <StatCard icon={<Clock size={17} />} label="Nouveaux documents" value={nouveauxDocuments} hint="3 derniers jours" tone="info" />
        <StatCard icon={<FileWarning size={17} />} label="Contraventions" value={contraventions.length} tone="neutral" href="/client/contraventions" />
        <StatCard icon={<Send size={17} />} label="Documents envoyés" value={envoyes} tone="neutral" href="/client/documents-envoyes" />
        <StatCard icon={<ListChecks size={17} />} label="À traiter" value={aTraiter.length} tone={aTraiter.length > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Documents récents</CardTitle>
          </CardHeader>
          <CardContent>
            {documentsRecents.length === 0 ? (
              <EmptyState icon={Mail} title="Aucun document partagé pour le moment" description="Les documents partagés par notre équipe apparaîtront ici." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {documentsRecents.map((d) => (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link href={d.href} className="flex items-center justify-between gap-3 py-3 text-sm transition hover:opacity-80">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{d.label}</div>
                        <div className="text-xs text-slate-400">{d.sousLabel}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {d.statut && <Badge tone={statusTone(d.statut)}>{d.statut}</Badge>}
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
          <Card>
            <CardHeader>
              <CardTitle>Montant restant dû</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{fmtMoney(montantRestant)}</p>
              <p className="mt-1 text-xs text-slate-400">Somme des montants non soldés parmi vos contraventions visibles.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prochaines échéances</CardTitle>
            </CardHeader>
            <CardContent>
              {prochaines.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune échéance à venir.</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {aTraiter.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>À traiter</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {aTraiter.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/client/contraventions/${c.id}`} className="flex items-center justify-between gap-3 py-3 text-sm transition hover:opacity-80">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{c.numDossier}</div>
                      <div className="truncate text-xs text-slate-400">{c.natureInfraction ?? "—"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={statusTone(c.statutPaiement)}>{c.statutPaiement ?? "—"}</Badge>
                      <ArrowRight size={14} className="text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {contraventions.length === 0 && courriers.length === 0 && (
        <EmptyState
          icon={FileWarning}
          title="Aucun document partagé pour le moment"
          description="Les documents que notre équipe partage avec vous apparaîtront ici."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col justify-between gap-4 lg:col-span-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Envoyer un document à notre équipe</h2>
            <p className="mt-1 text-sm text-slate-500">Transmettez-nous un document en quelques clics, il sera traité rapidement.</p>
          </div>
          <EnvoyerDocumentButton />
        </Card>

        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-navy-900 p-5 text-white shadow-card">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <ShieldCheck size={20} />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Un accompagnement réactif</h3>
          <p className="mt-1 text-xs text-white/80">
            Notre équipe reste à votre écoute pour toute question ou demande de précision.
          </p>
        </div>
      </div>
    </div>
  );
}
