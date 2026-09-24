import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PasswordField } from "@/components/ui/PasswordField";
import { acceptOrganizationInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

// Same "unguessable capability link" model as /client-setup/[token] and /user-setup/[token] — no
// login required, single-use, consumed as soon as the account is created (see actions.ts).
export default async function OrganisationSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  const invitation = await prisma.organizationInvitation.findUnique({ where: { token }, include: { organization: true } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Rejoindre {invitation.organization.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez votre compte administrateur pour <span className="font-medium text-slate-700">{invitation.email}</span>.
          </p>
        </div>

        {error === "name" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">Prénom et nom sont requis.</div>
        )}
        {error === "length" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">Le mot de passe doit contenir au moins 8 caractères.</div>
        )}
        {error === "mismatch" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">Les deux mots de passe saisis ne correspondent pas.</div>
        )}

        <form action={acceptOrganizationInvitationAction.bind(null, token)} className="space-y-4 card p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Prénom</label>
              <input name="prenom" required className="field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
              <input name="nom" required className="field" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <PasswordField name="password" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmez le mot de passe</label>
            <PasswordField name="confirmation" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">Créer mon compte</button>
        </form>
      </div>
    </div>
  );
}
