import { loginAction } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = params.error === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg">A</div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Connexion</h1>
          <p className="mt-1 text-sm text-slate-500">Accédez à l&apos;espace de votre société</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
            Nom de société ou code d&apos;accès incorrect.
          </div>
        )}

        <form action={loginAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de la société</label>
            <input name="nom" required placeholder="Ex: Transports Atlas" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Code d&apos;accès</label>
            <input name="code" type="password" required placeholder="••••••" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">
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
