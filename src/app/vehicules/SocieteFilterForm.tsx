"use client";

export default function SocieteFilterForm({ societes, current }: { societes: string[]; current: string | null }) {
  return (
    <form className="flex items-center gap-2 text-sm">
      <label htmlFor="societe-filter" className="text-slate-500">Filtrer par société :</label>
      <select
        id="societe-filter"
        name="societe"
        defaultValue={current ?? ""}
        className="field !w-auto"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Toutes les sociétés</option>
        {societes.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {current && (
        <span className="text-xs text-slate-400">→ « Exporter Excel » n&apos;exportera que {current}</span>
      )}
    </form>
  );
}
