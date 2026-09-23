"use client";

import { useRef, useState, useTransition } from "react";
import { IdCard, Car, UploadCloud, Eye, CheckCircle2 } from "lucide-react";
import type { Conducteur } from "@prisma/client";
import { clientUploadPermisAction, clientUploadCniAction } from "./identite-actions";

type Props = {
  conducteur: Conducteur & {
    permisRectoNom?: string | null;
    permisVersoNom?: string | null;
    cniRectoNom?: string | null;
    cniVersoNom?: string | null;
  };
  contraventionId: string;
};

/** Deux mini-formulaires (permis / pièce d'identité recto-verso) uploadés directement par le
 * client pour le conducteur associé à cette contravention. Toujours scopé société côté serveur
 * (`clientUploadPermisAction`/`clientUploadCniAction`). */
export function IdentiteUploadForms({ conducteur, contraventionId }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <UploadBlock
        icon={Car}
        title="Permis de conduire"
        rectoName={conducteur.permisRectoNom}
        versoName={conducteur.permisVersoNom}
        viewBase={`/api/conducteurs/${conducteur.id}/permis`}
        action={clientUploadPermisAction.bind(null, conducteur.id, contraventionId)}
        rectoField="permisRecto"
        versoField="permisVerso"
      />
      <UploadBlock
        icon={IdCard}
        title="Pièce d'identité (recto-verso)"
        rectoName={conducteur.cniRectoNom}
        versoName={conducteur.cniVersoNom}
        viewBase={`/api/conducteurs/${conducteur.id}/identite`}
        action={clientUploadCniAction.bind(null, conducteur.id, contraventionId)}
        rectoField="cniRecto"
        versoField="cniVerso"
      />
    </div>
  );
}

function UploadBlock({
  icon: Icon,
  title,
  rectoName,
  versoName,
  viewBase,
  action,
  rectoField,
  versoField,
}: {
  icon: typeof Car;
  title: string;
  rectoName?: string | null;
  versoName?: string | null;
  viewBase: string;
  action: (fd: FormData) => Promise<void>;
  rectoField: string;
  versoField: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon size={15} className="text-teal-600" /> {title}</h3>

      {(rectoName || versoName) && (
        <ul className="mb-3 space-y-1.5 text-xs">
          {rectoName && (
            <li className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Recto : {rectoName}</span>
              <a href={`${viewBase}/recto`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline"><Eye size={12} className="inline" /></a>
            </li>
          )}
          {versoName && (
            <li className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Verso : {versoName}</span>
              <a href={`${viewBase}/verso`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline"><Eye size={12} className="inline" /></a>
            </li>
          )}
        </ul>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            await action(fd);
            setDone(true);
            formRef.current?.reset();
          });
        }}
        className="space-y-2"
      >
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-xs text-slate-600 hover:border-teal-400">
          <UploadCloud size={13} /> {rectoName ? "Remplacer le recto" : "Ajouter le recto"}
          <input type="file" name={rectoField} accept="application/pdf,image/jpeg,image/jpg,image/png" className="hidden" onChange={() => setDone(false)} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-xs text-slate-600 hover:border-teal-400">
          <UploadCloud size={13} /> {versoName ? "Remplacer le verso" : "Ajouter le verso"}
          <input type="file" name={versoField} accept="application/pdf,image/jpeg,image/jpg,image/png" className="hidden" onChange={() => setDone(false)} />
        </label>
        <button type="submit" disabled={pending} className="btn-secondary w-full text-xs disabled:opacity-60">
          {pending ? "Envoi en cours…" : done ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
