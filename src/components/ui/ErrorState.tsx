import { AlertTriangle, RefreshCw } from "lucide-react";

/** État d'erreur cohérent — remplace les messages d'erreur bruts par une carte claire avec une
 * action de reprise optionnelle. */
export function ErrorState({
  title = "Une erreur est survenue",
  description = "Impossible de charger ces données pour le moment.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" role="alert">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-danger-50 text-danger-500">
        <AlertTriangle size={20} strokeWidth={1.75} />
      </div>
      <p className="mt-1 text-base font-semibold text-slate-800">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-2 text-sm">
          <RefreshCw size={14} /> Réessayer
        </button>
      )}
    </div>
  );
}
