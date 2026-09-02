"use client";

import { CLIENT_ENVOI_STATUTS } from "@/lib/courriers";

export function StatutSelect({
  id,
  defaultValue,
  action,
}: {
  id: string;
  defaultValue: string;
  action: (id: string, statut: string) => Promise<void>;
}) {
  return (
    <form
      action={async (fd) => {
        await action(id, fd.get("statut") as string);
      }}
    >
      <select
        name="statut"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field !w-auto !py-1 text-xs"
      >
        {CLIENT_ENVOI_STATUTS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
