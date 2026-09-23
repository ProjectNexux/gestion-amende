import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isSetupTokenExpired } from "@/lib/societe-setup";
import { PasswordField } from "@/components/ui/PasswordField";
import { setOwnPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

// Same "unguessable capability link" model as /client-setup/[token] and /paiement/[id] — no
// login required, single-use, consumed as soon as the password is set (see actions.ts).
export default async function UserSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  const user = await prisma.user.findUnique({ where: { invitationToken: token }, include: { societe: true } });
  if (!user || isSetupTokenExpired(user.invitationExpiresAt)) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Créez votre mot de passe</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bienvenue <span className="font-medium text-slate-700">{user.prenom} {user.nom}</span> — votre compte sur l&apos;espace client
            de <span className="font-medium text-slate-700">{user.societe.nom}</span>.
          </p>
        </div>

        {error === "length" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Le mot de passe doit contenir au moins 8 caractères.
          </div>
        )}
        {error === "mismatch" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Les deux mots de passe saisis ne correspondent pas.
          </div>
        )}

        <form action={setOwnPasswordAction.bind(null, token)} className="space-y-4 card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <PasswordField name="password" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmez le mot de passe</label>
            <PasswordField name="confirmation" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">
            Créer mon mot de passe
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Ce lien ne pourra être utilisé qu&apos;une seule fois. Votre mot de passe reste toujours confidentiel : personne, pas même
          l&apos;administrateur, ne peut le consulter.
        </p>
      </div>
    </div>
  );
}
