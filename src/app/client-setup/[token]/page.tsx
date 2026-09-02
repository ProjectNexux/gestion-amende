import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isSetupTokenExpired } from "@/lib/societe-setup";
import { setOwnAccessCodeAction } from "./actions";

export const dynamic = "force-dynamic";

// Deliberately no login requirement — this is the self-service "create your own access code"
// link shared with a client, exactly like the /paiement/[id] capability link (unguessable token,
// same security model). Single-use: consumed as soon as the code is set (see actions.ts).
export default async function ClientSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  const societe = await prisma.societe.findUnique({ where: { codeAccesSetupToken: token } });
  if (!societe || isSetupTokenExpired(societe.codeAccesSetupExpiresAt)) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Créer votre code d&apos;accès</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bienvenue <span className="font-medium text-slate-700">{societe.nom}</span> — choisissez le code d&apos;accès que vous utiliserez pour vous connecter.
          </p>
        </div>

        {error === "length" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Le code d&apos;accès doit contenir au moins 6 caractères.
          </div>
        )}
        {error === "mismatch" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Les deux codes saisis ne correspondent pas.
          </div>
        )}

        <form action={setOwnAccessCodeAction.bind(null, token)} className="space-y-4 card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nouveau code d&apos;accès</label>
            <input name="code" type="password" required minLength={6} placeholder="••••••" className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmez le code d&apos;accès</label>
            <input name="confirmation" type="password" required minLength={6} placeholder="••••••" className="field" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">
            Créer mon code d&apos;accès
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Ce lien ne pourra être utilisé qu&apos;une seule fois. Conservez votre code d&apos;accès en lieu sûr.
        </p>
      </div>
    </div>
  );
}
