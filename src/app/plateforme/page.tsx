import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSuperAdminSession } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

export default async function PlateformePage() {
  if (!(await isSuperAdminSession())) redirect("/login");

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { societes: true, members: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Plateforme</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Organisations</h1>
          <p className="mt-1 text-sm text-slate-500">{organizations.length} organisation(s) gestionnaire(s) sur la plateforme.</p>
        </div>
        <Link href="/plateforme/nouvelle-organisation" className="btn-primary">
          <Plus size={16} /> Créer une organisation
        </Link>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {organizations.map((org) => (
          <div key={org.id} className="flex items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Building2 size={18} />
              </div>
              <div>
                <p className="font-medium text-slate-900">{org.name}</p>
                <p className="text-xs text-slate-500">{org._count.societes} société(s) cliente(s) — {org._count.members} membre(s)</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
