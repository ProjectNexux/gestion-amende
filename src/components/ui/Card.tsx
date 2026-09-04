import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-[14px] border border-slate-200 bg-white shadow-card", className)}>{children}</div>;
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center justify-between gap-4 px-5 pb-0 pt-5", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("text-base font-semibold tracking-[-0.02em] text-slate-900", className)}>{children}</h2>;
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("mt-1 text-sm text-slate-500", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pb-5 pt-4", className)}>{children}</div>;
}
