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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Connexion</h1>
          <p className="mt-1 text-sm text-slate-500">Accédez à l&apos;espace de votre société</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Nom de société ou code d&apos;accès incorrect.
          </div>
        )}

        <form action={loginAction} className="space-y-4 card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de la société</label>
            <input name="nom" required placeholder="Ex: Transports Atlas" className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Code d&apos;accès</label>
            <input name="code" type="password" required placeholder="••••••" className="field" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">
            Se connecter
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          <Link href="/admin/societes" className="hover:underline">Administration des sociétés</Link>
        </p>
      </div>
    </div>
  );
}
