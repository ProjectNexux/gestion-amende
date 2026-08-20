import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const dotClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

/** Maps existing business status strings (statutPaiement / statutDenonciation) to a badge tone. */
export function statusTone(status: string | null | undefined): BadgeTone {
  if (status === "Payé" || status === "Effectuée") return "success";
  if (status === "En retard") return "danger";
  if (status === "À effectuer" || status === "En attente") return "warning";
  return "neutral";
}
