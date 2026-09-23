import { loginAction } from "@/lib/auth";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PasswordField } from "@/components/ui/PasswordField";
import { LoginShowcaseBackdrop } from "./LoginShowcaseBackdrop";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = params.error === "1";
  const setupDone = params.setup === "1";

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-[#0a0f1c] p-4 py-10">
      <LoginShowcaseBackdrop />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="animate-login-fade-in text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_18px_40px_-20px_rgba(49,88,212,0.8)]">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">Connexion</h1>
          <p className="mt-2 text-sm text-white/70">Gérez, classez et transmettez vos documents en toute sécurité.</p>
        </div>

        {setupDone && (
          <div className="animate-login-fade-in rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-200">
            Votre code d&apos;accès a été créé avec succès. Vous pouvez maintenant vous connecter.
          </div>
        )}

        {error && (
          <div className="animate-login-fade-in rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-center text-sm text-rose-200">
            Nom de société ou code d&apos;accès incorrect.
          </div>
        )}

        <form
          action={loginAction}
          className="animate-login-fade-in space-y-4 rounded-[22px] border border-white/40 bg-white/85 p-6 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom de la société ou e-mail</label>
            <input name="nom" required placeholder="Ex: Transports Atlas ou vous@societe.fr" className="field" autoComplete="username" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Code d&apos;accès ou mot de passe</label>
            <PasswordField name="code" required placeholder="••••••" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">
            Se connecter
          </button>
        </form>

        <div className="animate-login-fade-in space-y-2 text-center">
          <p className="text-xs text-white/60">Accès sécurisé pour les administrateurs et les sociétés clientes.</p>
          <p className="text-xs text-white/40">
            <Link href="/admin/societes" className="font-medium text-white/60 transition hover:text-white/90 hover:underline">
              Administration des sociétés
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

