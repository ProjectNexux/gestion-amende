import { Building2, FileStack, Inbox, Send, AlertTriangle, CalendarClock, Activity, LayoutGrid, Users, type LucideIcon } from "lucide-react";

/**
 * Purely decorative background for the login page — static/generic placeholder content only,
 * no data fetching, no props, no client-side state. Never renders real société names, documents,
 * amounts or stats: everything here is hardcoded illustrative text ("Société exemple", etc.).
 * `aria-hidden`/`pointer-events-none` throughout since it conveys nothing screen-reader users or
 * mouse/keyboard users need to interact with — the login form is the only real content.
 */
export function LoginShowcaseBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      {/* Deep gradient: bleu nuit -> anthracite -> bleu électrique -> gris clair */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0a0f1c_0%,#151a26_24%,#1c2b4a_48%,#2f5fd6_76%,#e7eaf3_100%)]" />

      {/* Discreet light halos */}
      <div className="animate-login-glow absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-brand-400/30 blur-[120px]" />
      <div className="animate-login-glow absolute right-0 top-1/3 h-[380px] w-[380px] rounded-full bg-sky-300/20 blur-[110px]" style={{ animationDelay: "2s" }} />
      <div className="animate-login-glow absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-brand-200/10 blur-[100px]" style={{ animationDelay: "4s" }} />

      {/* Admin dashboard preview — left, tilted */}
      <div
        className="animate-login-fade-in absolute left-[-6%] top-[12%] hidden w-[420px] -rotate-6 rounded-2xl border border-white/15 bg-white/[0.06] p-4 opacity-45 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md lg:block"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          <LayoutGrid size={13} /> Espace administrateur
        </div>
        <div className="flex gap-3">
          <div className="flex w-8 shrink-0 flex-col items-center gap-2 rounded-lg bg-white/10 py-3">
            {[Building2, Inbox, Send, Users].map((Icon, i) => (
              <div key={i} className="grid h-5 w-5 place-items-center rounded text-white/50">
                <Icon size={12} />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat icon={Inbox} label="Documents reçus" value="—" />
              <MiniStat icon={FileStack} label="À classer" value="3" />
              <MiniStat icon={CalendarClock} label="Échéances" value="2" />
            </div>
            <div className="space-y-1.5 rounded-lg bg-white/10 p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-white/50">Activité récente</div>
              <MiniRow label="Document reçu" tone="bg-sky-300" />
              <MiniRow label="Société exemple" tone="bg-emerald-300" />
              <MiniRow label="Prêt à transmettre" tone="bg-amber-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Client portal preview — right, tilted the other way */}
      <div
        className="animate-login-fade-in absolute right-[-8%] top-[20%] hidden w-[360px] rotate-6 rounded-2xl border border-white/15 bg-white/[0.06] p-4 opacity-40 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md xl:block"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          <Building2 size={13} /> Portail client
        </div>
        <div className="mb-2 rounded-lg bg-white/10 p-2.5 text-[11px] text-white/70">Bonjour, Société exemple</div>
        <div className="space-y-1.5">
          <MiniRow label="Document reçu" tone="bg-sky-300" />
          <MiniRow label="Facture" tone="bg-emerald-300" />
          <MiniRow label="Contravention" tone="bg-amber-300" />
        </div>
      </div>

      {/* Small floating cards — exactly 2 always visible (mobile), progressively more from sm/md/lg/xl.
          Each card's className fully specifies its own display value per breakpoint (never relies
          on a shared default) to avoid Tailwind utility-order conflicts between "hidden"/"flex". */}
      <FloatingCard icon={Inbox} label="Documents reçus" hint="Société exemple" className="left-[6%] top-[8%] flex" delay="0.2s" />
      <FloatingCard icon={FileStack} label="À classer" hint="3 documents à classer" className="right-[8%] top-[10%] flex" delay="0.6s" />
      <FloatingCard icon={Send} label="Prêts à transmettre" hint="Société exemple" className="left-[10%] bottom-[14%] hidden sm:flex" delay="1s" />
      <FloatingCard icon={AlertTriangle} label="Contraventions" hint="Document reçu" className="right-[12%] bottom-[10%] hidden md:flex" delay="1.4s" />
      <FloatingCard icon={CalendarClock} label="Échéances" hint="2 échéances à venir" className="left-[38%] top-[4%] hidden lg:flex" delay="1.8s" />
      <FloatingCard icon={Activity} label="Activité récente" hint="Société exemple" className="right-[30%] bottom-[6%] hidden xl:flex" delay="2.2s" />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-2">
      <Icon size={12} />
      <div className="mt-1 text-sm font-semibold text-white/80">{value}</div>
      <div className="truncate text-[8px] uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}

function MiniRow({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />
      <span className="truncate text-[10px] text-white/60">{label}</span>
    </div>
  );
}

function FloatingCard({
  icon: Icon,
  label,
  hint,
  className,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      className={`animate-login-float animate-login-fade-in absolute z-0 w-40 items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 p-3 opacity-70 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm ${className}`}
      style={{ animationDelay: delay }}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white/80">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-white/85">{label}</div>
        <div className="truncate text-[10px] text-white/50">{hint}</div>
      </div>
    </div>
  );
}
