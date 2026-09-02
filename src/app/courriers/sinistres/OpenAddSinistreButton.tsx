"use client";

/** Clicks the real "+ Ajouter un sinistre" trigger (in AddSinistrePanel) and scrolls it into view. */
export function OpenAddSinistreButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        const btn = document.getElementById("add-sinistre-trigger");
        btn?.scrollIntoView({ behavior: "smooth", block: "center" });
        btn?.click();
      }}
      className="inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
    >
      {children}
    </button>
  );
}
