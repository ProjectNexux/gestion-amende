import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, documentTypeTone } from "@/components/ui/Badge";
import { courrierTypeLabel } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { Star, FileWarning, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientFavorisPage() {
  const societe = await requireSociete();

  const favoris = await prisma.favori.findMany({ where: { societe }, orderBy: { createdAt: "desc" } });
  const courrierIds = favoris.filter((f) => f.itemType === "courrier").map((f) => f.itemId);
  const contraventionIds = favoris.filter((f) => f.itemType === "contravention").map((f) => f.itemId);

  // Toujours re-filtré par société + visibleClient — un favori ne peut jamais faire fuiter un
  // document d'une autre société, même si son id a été mémorisé avant un retrait d'accès.
  const [courriers, contraventions] = await Promise.all([
    courrierIds.length
      ? prisma.courrier.findMany({ where: { id: { in: courrierIds }, societe, visibleClient: true } })
      : Promise.resolve([]),
    contraventionIds.length
      ? prisma.contravention.findMany({ where: { id: { in: contraventionIds }, societe, visibleClient: true } })
      : Promise.resolve([]),
  ]);

  const items = [
    ...courriers.map((c) => ({
      id: c.id,
      kind: "courrier" as const,
      label: c.fileName,
      sousLabel: courrierTypeLabel(c.type),
      date: c.receivedAt,
      href: "/client/courriers",
    })),
    ...contraventions.map((c) => ({
      id: c.id,
      kind: "contravention" as const,
      label: c.numDossier,
      sousLabel: c.natureInfraction ?? "Contravention",
      date: c.createdAt,
      href: `/client/contraventions/${c.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      <PageHeader title="Favoris" description="Vos documents et contraventions marqués comme favoris pour un accès rapide." />

      {items.length === 0 ? (
        <EmptyState icon={Star} title="Aucun favori pour le moment" description="Ajoutez un document ou une contravention à vos favoris depuis « Mes documents » ou « Mes contraventions »." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Nom</th>
                <th className="p-3 text-left">Ajouté le</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    {item.kind === "courrier" ? (
                      <Badge tone={documentTypeTone(item.sousLabel)}><Mail size={11} className="mr-1 inline" />{item.sousLabel}</Badge>
                    ) : (
                      <Badge tone="warning"><FileWarning size={11} className="mr-1 inline" />Contravention</Badge>
                    )}
                  </td>
                  <td className="max-w-xs truncate p-3 font-medium text-slate-800">{item.label}</td>
                  <td className="p-3 text-slate-500">{fmtDateTime(item.date)}</td>
                  <td className="p-3 text-right">
                    <Link href={item.href} className="text-xs font-medium text-teal-700 hover:underline">
                      Ouvrir <Star size={12} className="ml-1 inline fill-amber-400 text-amber-500" />
                    </Link>
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
