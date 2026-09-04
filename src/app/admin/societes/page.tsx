import { prisma } from "@/lib/prisma";
import { createSocieteAction, deleteSocieteAction, generateSetupLinkAction } from "./actions";
import Link from "next/link";
import { isAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";

export const dynamic = "force-dynamic";

export default async function AdminSocietesPage() {
  // Security audit finding (2026-08-24): this page previously had NO auth check at all — any
  // visitor, logged in or not, could view every société's plaintext codeAcces and create/delete
  // sociétés. Now gated to admin sessions only, same convention as the rest of the app.
  if (!(await isAdminSession())) redirect("/login");

  const societes = await prisma.societe.findMany({ orderBy: { nom: "asc" } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 transition hover:text-brand-800">
            <span aria-hidden="true">←</span> Retour
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Administration</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Sociétés</h1>
          </div>
          <p className="text-sm text-slate-500">Créez et gérez les comptes société</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-card">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Total</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{societes.length}</div>
        </div>
      </header>

      <form action={createSocieteAction} className="space-y-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Nouvelle société</h2>
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            Création
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="nom" required placeholder="Nom de la société" className="field" />
          <input name="codeAcces" placeholder="Code d'accès (facultatif)" className="field" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-slate-500">
            Laissez le code d&apos;accès vide pour générer un lien à envoyer au client : il pourra alors créer lui-même son propre code d&apos;accès.
          </p>
          <button type="submit" className="btn-primary">Créer</button>
        </div>
      </form>

      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Code d&apos;accès</th>
              <th className="p-3 text-left">Date de création</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {societes.map((s) => {
              const pendingSetup = !!s.codeAccesSetupToken;
              const expired = pendingSetup && isSetupTokenExpired(s.codeAccesSetupExpiresAt);
              const setupUrl = pendingSetup && s.codeAccesSetupToken ? buildSetupUrl(appUrl, s.codeAccesSetupToken) : null;
              return (
                <tr key={s.id} className="table-row align-top">
                  <td className="p-3 font-medium text-slate-900">{s.nom}</td>
                  <td className="p-3 font-mono text-xs text-slate-600">
                    {pendingSetup ? (
                      <div className="space-y-1.5">
                        <div className={expired ? "text-amber-700" : "text-slate-500"}>
                          {expired ? "Lien de création expiré" : "En attente — le client crée son code"}
                        </div>
                        {!expired && setupUrl && (
                          <div className="max-w-[260px] break-all font-mono text-[11px] text-brand-700">{setupUrl}</div>
                        )}
                        <form action={generateSetupLinkAction.bind(null, s.id)}>
                          <button className="text-[11px] font-medium text-brand-700 hover:underline">
                            {expired ? "Générer un nouveau lien" : "Régénérer le lien"}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">{s.codeAcces}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{s.createdAt.toLocaleDateString("fr-FR")}</td>
                  <td className="p-3 text-right">
                    <form action={deleteSocieteAction.bind(null, s.id)}>
                      <button className="text-xs font-medium text-rose-700 transition hover:text-rose-800">Supprimer</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {societes.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucune société créée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

