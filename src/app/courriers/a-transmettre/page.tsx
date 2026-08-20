import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { courrierTypeLabel, getMiseEnDemeureData } from "@/lib/courriers";
import { deriveTransmissionStatut } from "@/lib/transmission";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Path back to a courrier's own fiche, per type — mirrors the same map used by /courriers.
const DETAIL_PATH: Record<string, (id: string) => string> = {
  mise_en_demeure: (id) => `/courriers/mise-en-demeure/${id}`,
};

function statutTone(statut: string): BadgeTone {
  if (statut === "Prêt à envoyer" || statut === "Envoyé") return "success";
  if (statut === "Erreur d'envoi") return "danger";
  return "warning"; // À vérifier, À transmettre
}

export default async function ATransmettrePage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const [items, societes] = await Promise.all([
    prisma.courrier.findMany({
      where: isAdmin ? {} : { societe },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.societe.findMany({ select: { nom: true, emailTransmission: true } }),
  ]);

  const emailBySociete = new Map(societes.map((s) => [s.nom, s.emailTransmission]));

  const rows = items
    .map((item) => ({ item, d: getMiseEnDemeureData(item.data) }))
    .filter(({ d }) => !!d.transmission)
    .map(({ item, d }) => {
      const email = d.transmission?.clientDetecte ? emailBySociete.get(d.transmission.clientDetecte) ?? null : null;
      return { item, d, email, statut: deriveTransmissionStatut(d.transmission, email) };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">À transmettre</h1>
        <p className="text-sm text-slate-500">{rows.length} courrier(s) en attente de validation humaine avant transmission au client</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Organisme</th>
              <th className="p-3 text-left">Client détecté</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Référence</th>
              <th className="p-3 text-left">E-mail</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, d, email, statut }) => {
              const href = DETAIL_PATH[item.type]?.(item.id) ?? "/courriers";
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3">{d.transmission?.organisme ?? "—"}</td>
                  <td className="p-3">{d.transmission?.clientDetecte ?? "—"}</td>
                  <td className="p-3">{courrierTypeLabel(item.type)}</td>
                  <td className="p-3 font-mono text-xs">{d.reference ?? "—"}</td>
                  <td className="p-3">{email ?? "—"}</td>
                  <td className="p-3"><Badge tone={statutTone(statut)}>{statut}</Badge></td>
                  <td className="p-3 text-right">
                    <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">Vérifier</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">Aucun courrier en attente de transmission.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
