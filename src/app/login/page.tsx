import { loginAction } from "@/lib/auth";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(23,26,33,0.98),_rgba(23,26,33,0.95)_16%,_rgba(243,241,237,1)_52%,_rgba(238,234,228,1)_100%)] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_18px_40px_-20px_rgba(49,88,212,0.8)]">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">Accédez à l&apos;espace de votre société</p>
        </div>

        {setupDone && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-700">
            Votre code d&apos;accès a été créé avec succès. Vous pouvez maintenant vous connecter.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Nom de société ou code d&apos;accès incorrect.
          </div>
        )}

        <form action={loginAction} className="space-y-4 rounded-[22px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom de la société</label>
            <input name="nom" required placeholder="Ex: Transports Atlas" className="field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Code d&apos;accès</label>
            <input name="code" type="password" required placeholder="••••••" className="field" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">
            Se connecter
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          <Link href="/admin/societes" className="font-medium text-slate-600 transition hover:text-slate-800 hover:underline">
            Administration des sociétés
          </Link>
        </p>
      </div>
    </div>
  );
}
