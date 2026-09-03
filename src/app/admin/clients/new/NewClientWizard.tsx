"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Search, AlertTriangle, Check, ArrowLeft, Building2, User as UserIcon, CheckCircle2 } from "lucide-react";
import type { CreateClientState } from "../actions";

type LookupResult = {
  siret: string;
  siren: string;
  companyName: string;
  tradeName: string | null;
  legalForm: string | null;
  nafCode: string | null;
  activityLabel: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  isActive: boolean;
  createdAt: string | null;
  dirigeants: Array<{ nom: string | null; prenom: string | null; fonction: string | null }>;
};

type Step = "siret" | "infos" | "contact" | "review" | "done";

const initialState: CreateClientState = {};

export default function NewClientWizard({ action }: { action: (prev: CreateClientState, fd: FormData) => Promise<CreateClientState> }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("siret");
  const [siret, setSiret] = useState("");
  const [siretLoading, setSiretLoading] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [siren, setSiren] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [nafCode, setNafCode] = useState("");
  const [activityLabel, setActivityLabel] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  const [contactCivilite, setContactCivilite] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [email, setEmail] = useState("");
  const [emailSecondary, setEmailSecondary] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");

  const [dirigeantSuggestions, setDirigeantSuggestions] = useState<LookupResult["dirigeants"]>([]);

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok && state.id) setStep("done");
  }, [state.ok, state.id]);

  async function lookupSiret() {
    setSiretError(null);
    setSiretLoading(true);
    try {
      const res = await fetch("/api/admin/clients/lookup-siret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siret }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSiretError(json.error ?? "Recherche impossible.");
        if (json.retryable) setManualMode(true);
        return;
      }
      const r = json.result as LookupResult;
      setCompanyName(r.companyName ?? "");
      setTradeName(r.tradeName ?? "");
      setSiren(r.siren ?? "");
      setLegalForm(r.legalForm ?? "");
      setVatNumber(r.vatNumber ?? "");
      setNafCode(r.nafCode ?? "");
      setActivityLabel(r.activityLabel ?? "");
      setAddressLine1(r.addressLine1 ?? "");
      setAddressLine2(r.addressLine2 ?? "");
      setPostalCode(r.postalCode ?? "");
      setCity(r.city ?? "");
      setCountry(r.country ?? "France");
      setDirigeantSuggestions(r.dirigeants ?? []);
      setStep("infos");
    } catch {
      setSiretError("La recherche automatique est temporairement indisponible.");
      setManualMode(true);
    } finally {
      setSiretLoading(false);
    }
  }

  function pickDirigeant(d: LookupResult["dirigeants"][number]) {
    if (d.prenom) setContactFirstName(d.prenom);
    if (d.nom) setContactLastName(d.nom);
    if (d.fonction) setContactRole(d.fonction);
  }

  const canGoContact = companyName.trim().length > 0;
  const canReview = contactFirstName.trim() || contactLastName.trim() || email.trim();

  if (step === "done" && state.id) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={22} />
          <h2 className="text-lg font-semibold">Client créé</h2>
        </div>
        <p className="text-sm">
          <span className="font-medium">{companyName}</span> a été ajouté à votre espace.
        </p>
        <ul className="text-sm space-y-1">
          <li>• Compte client : <span className="font-medium">Créé</span></li>
          <li>• Portail client : <span className="font-medium">Actif</span></li>
          <li>• Invitation : <span className="font-medium">À envoyer</span></li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`/admin/clients/${state.id}`} className="btn-primary">Voir la fiche client</Link>
          <Link href="/admin/clients" className="btn-secondary">Retour à la liste</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {step === "siret" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">SIRET de l&apos;entreprise</label>
            <input
              type="text"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              placeholder="Ex : 123 456 789 00012"
              className="field"
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-500">14 chiffres. Les espaces sont facultatifs.</p>
          </div>
          {siretError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>{siretError}</div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setManualMode(true); setStep("infos"); }}
              className="text-sm text-slate-500 hover:underline"
            >
              Saisir manuellement les informations
            </button>
            <button type="button" disabled={siretLoading || !siret.trim()} onClick={lookupSiret} className="btn-primary disabled:opacity-60">
              {siretLoading ? <><Loader2 size={14} className="animate-spin" /> Recherche de l&apos;entreprise…</> : <><Search size={14} /> Rechercher l&apos;entreprise</>}
            </button>
          </div>
        </div>
      )}

      {step === "infos" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-700"><Building2 size={16} /><h2 className="text-sm font-semibold">Informations société</h2></div>
          {manualMode && !companyName && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              La recherche automatique est temporairement indisponible. Vous pouvez compléter les informations manuellement.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom / raison sociale *" value={companyName} onChange={setCompanyName} required />
            <Field label="Nom commercial" value={tradeName} onChange={setTradeName} />
            <Field label="SIRET" value={siret} onChange={setSiret} />
            <Field label="SIREN" value={siren} onChange={setSiren} />
            <Field label="Forme juridique" value={legalForm} onChange={setLegalForm} />
            <Field label="N° TVA intracom." value={vatNumber} onChange={setVatNumber} />
            <Field label="Code NAF" value={nafCode} onChange={setNafCode} />
            <Field label="Activité" value={activityLabel} onChange={setActivityLabel} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <Field label="Adresse" value={addressLine1} onChange={setAddressLine1} />
            <Field label="Complément d'adresse" value={addressLine2} onChange={setAddressLine2} />
            <Field label="Code postal" value={postalCode} onChange={setPostalCode} />
            <Field label="Ville" value={city} onChange={setCity} />
            <Field label="Pays" value={country} onChange={setCountry} />
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep("siret")} className="btn-secondary"><ArrowLeft size={14} /> Précédent</button>
            <button type="button" disabled={!canGoContact} onClick={() => setStep("contact")} className="btn-primary disabled:opacity-60">Continuer</button>
          </div>
        </div>
      )}

      {step === "contact" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-700"><UserIcon size={16} /><h2 className="text-sm font-semibold">Contact et accès</h2></div>

          {dirigeantSuggestions.length > 0 && (contactFirstName === "" && contactLastName === "") && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="mb-2 text-slate-500">Dirigeants trouvés dans le registre officiel — cliquez pour pré-remplir :</div>
              <div className="flex flex-wrap gap-2">
                {dirigeantSuggestions.filter((d) => d.nom || d.prenom).slice(0, 6).map((d, i) => (
                  <button key={i} type="button" onClick={() => pickDirigeant(d)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100">
                    {[d.prenom, d.nom].filter(Boolean).join(" ")}{d.fonction ? ` — ${d.fonction}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Civilité</label>
              <select value={contactCivilite} onChange={(e) => setContactCivilite(e.target.value)} className="field">
                <option value="">—</option>
                <option>M.</option>
                <option>Mme</option>
              </select>
            </div>
            <Field label="Prénom du contact" value={contactFirstName} onChange={setContactFirstName} />
            <Field label="Nom du contact" value={contactLastName} onChange={setContactLastName} />
            <Field label="Fonction" value={contactRole} onChange={setContactRole} />
            <Field label="E-mail principal" value={email} onChange={setEmail} type="email" />
            <Field label="E-mail secondaire" value={emailSecondary} onChange={setEmailSecondary} type="email" />
            <Field label="Téléphone" value={phone} onChange={setPhone} />
            <Field label="Téléphone secondaire" value={phoneSecondary} onChange={setPhoneSecondary} />
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep("infos")} className="btn-secondary"><ArrowLeft size={14} /> Précédent</button>
            <button type="button" disabled={!canReview} onClick={() => setStep("review")} className="btn-primary disabled:opacity-60">Continuer</button>
          </div>
        </div>
      )}

      {step === "review" && (
        <form action={formAction} className="space-y-4">
          {/* All fields as hidden inputs — sent to the server action */}
          <HiddenAll
            values={{
              nom: companyName, tradeName, siret, siren, legalForm, vatNumber, nafCode, activityLabel,
              addressLine1, addressLine2, postalCode, city, country,
              contactCivilite, contactFirstName, contactLastName, contactRole,
              email, emailSecondary, phone, phoneSecondary,
            }}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-700"><Check size={16} /><h2 className="text-sm font-semibold">Vérifiez et créez le client</h2></div>
            <Line k="Société" v={tradeName ? `${companyName} (${tradeName})` : companyName} />
            <Line k="SIRET" v={siret || "—"} />
            <Line k="SIREN" v={siren || "—"} />
            <Line k="Forme juridique" v={legalForm || "—"} />
            <Line k="Adresse" v={[addressLine1, addressLine2, [postalCode, city].filter(Boolean).join(" "), country].filter(Boolean).join(", ") || "—"} />
            <Line k="Responsable" v={[contactCivilite, contactFirstName, contactLastName].filter(Boolean).join(" ") || "—"} />
            <Line k="Fonction" v={contactRole || "—"} />
            <Line k="E-mail" v={email || "—"} />
            <Line k="Téléphone" v={phone || "—"} />
          </div>

          {state.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {state.error}
              {state.id && (
                <>
                  {" "}
                  <Link href={`/admin/clients/${state.id}`} className="underline">Voir la fiche client existante</Link>
                </>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep("contact")} className="btn-secondary"><ArrowLeft size={14} /> Précédent</button>
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? <><Loader2 size={14} className="animate-spin" /> Création…</> : "Créer le client"}
            </button>
          </div>
          <div className="text-right">
            <button type="button" onClick={() => router.push("/admin/clients")} className="text-xs text-slate-500 hover:underline">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "siret", label: "Entreprise" },
    { key: "infos", label: "Informations" },
    { key: "contact", label: "Contact" },
    { key: "review", label: "Accès" },
  ];
  const index = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-3 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={"grid h-6 w-6 place-items-center rounded-full font-semibold " + (i <= index ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
            {i + 1}
          </span>
          <span className={i <= index ? "font-medium text-slate-800" : "text-slate-400"}>{s.label}</span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <div className="text-slate-500">{k}</div>
      <div className="text-slate-800 font-medium">{v}</div>
    </div>
  );
}

function HiddenAll({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}
