"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps a non-redirecting server action in a form-like element, but invokes it directly and
 * force-refreshes the route afterward (`router.refresh()`). Needed because plain `<form
 * action={serverAction}>` was leaving the page showing stale data after a successful mutation
 * (e.g. "Activer"/"Désactiver" appeared to do nothing until a manual page reload) — the action
 * itself + its `revalidatePath()` calls were running correctly server-side, but the already
 * client-rendered page never re-fetched. Do NOT use this for actions that call `redirect()`
 * internally (e.g. delete/update) — those already navigate away and refresh naturally; wrapping
 * them here would swallow the redirect as a thrown error instead of following it.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={pending}>
      {children}
    </form>
  );
}
