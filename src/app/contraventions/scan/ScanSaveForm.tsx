"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Contravention } from "@prisma/client";
import ContraventionForm from "@/components/ContraventionForm";
import {
  createContraventionFromScanAction,
  type CreateContraventionScanState,
} from "../actions";

type Option = { id: string; label: string };

type Props = {
  index: number;
  initial?: Partial<Contravention> & { rawOcrText?: string | null };
  vehicules: Option[];
  conducteurs: Option[];
  submitLabel?: string;
};

const initialState: CreateContraventionScanState = { ok: false };

export default function ScanSaveForm({ index, initial = {}, vehicules, conducteurs, submitLabel }: Props) {
  const [state, formAction] = useActionState(createContraventionFromScanAction, initialState);

  if (state.ok && state.id) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="font-medium">Amende {index + 1} enregistrée.</div>
        <Link href={`/contraventions/${state.id}`} className="mt-1 inline-block underline">
          Ouvrir la fiche créée
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <ContraventionForm
        action={formAction}
        vehicules={vehicules}
        conducteurs={conducteurs}
        initial={initial}
        submitLabel={submitLabel ?? `Enregistrer l'amende ${index + 1}`}
      />
    </div>
  );
}
