import { prisma } from "@/lib/prisma";
import { requireSociete, getUserId } from "@/lib/auth";
import { UserCircle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { ChangerCodeAccesForm } from "./ChangerCodeAccesForm";

export const dynamic = "force-dynamic";

export default async function ClientProfilPage() {
  const societe = await requireSociete();
  const userId = await getUserId();
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Mon profil" description="Vos informations de compte et vos accès." />

      <Card>
        <CardContent className="flex items-center gap-3 !pt-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
            <UserCircle size={22} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{societe}</div>
            <div className="text-xs text-slate-500">Compte client</div>
          </div>
        </CardContent>
        <div className="border-t border-slate-100 px-5 py-4">
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Société</dt><dd className="font-medium text-slate-900">{societe}</dd></div>
            {user?.email && <div className="flex justify-between"><dt className="text-slate-500">Identifiant</dt><dd className="font-medium text-slate-900">{user.email}</dd></div>}
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand-600" /> Sécurité et accès</CardTitle>
          <CardDescription>
            Le code d&apos;accès de votre société est un identifiant partagé — il n&apos;est jamais affiché en clair ici, par mesure de
            sécurité. Vous pouvez le modifier à tout moment ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangerCodeAccesForm />
        </CardContent>
      </Card>

      <form action="/api/logout" method="POST">
        <button className="btn-secondary">Déconnexion</button>
      </form>
    </div>
  );
}
