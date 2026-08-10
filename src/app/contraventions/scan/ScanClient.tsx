"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle2, FileText } from "lucide-react";
import ContraventionForm from "@/components/ContraventionForm";
import { createContraventionAction } from "../actions";
import { parseFine, type ParsedFine } from "@/lib/fine-parser";
import { pdfToCanvases, extractPdfText, pdfFirstPagePreview, preprocessForOcr } from "@/lib/pdf-to-images";

type Opt = { id: string; label: string };

export default function ScanClient({ vehicules, conducteurs, knownPlates }: { vehicules: Opt[]; conducteurs: Opt[]; knownPlates: string[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "rendering" | "scanning" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedFine | null>(null);
  const [overrideImmat, setOverrideImmat] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reset() {
    setPreview(null);
    setIsPdf(false);
    setPageCount(0);
    setCurrentPage(0);
    setProgress(0);
    setText("");
    setParsed(null);
    setOverrideImmat(null);
    setErrorMsg("");
    setStatus("idle");
  }

  async function ocrSource(source: File | HTMLCanvasElement): Promise<string> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["fra", "eng"], 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
      },
    });
    const { data } = await worker.recognize(source);
    await worker.terminate();
    return data.text;
  }

  async function runOcr(f: File) {
    try {
      let fullText = "";

      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        setIsPdf(true);
        setStatus("rendering");

        // 1) tentative : texte natif (PDF non scanné → instantané + précis)
        const nativeText = await extractPdfText(f);
        const previewUrl = await pdfFirstPagePreview(f).catch(() => null);
        if (previewUrl) setPreview(previewUrl);

        if (nativeText.length > 80) {
          // PDF texte : pas besoin d'OCR
          setPageCount(1);
          setCurrentPage(1);
          fullText = nativeText;
        } else {
          // PDF scanné → OCR page par page (haute résolution + binarisation)
          const canvases = await pdfToCanvases(f, 4);
          setPageCount(canvases.length);
          if (!previewUrl && canvases[0]) setPreview(canvases[0].toDataURL("image/png"));

          setStatus("scanning");
          for (let i = 0; i < canvases.length; i++) {
            setCurrentPage(i + 1);
            setProgress(0);
            preprocessForOcr(canvases[i]);
            const pageText = await ocrSource(canvases[i]);
            fullText += (i > 0 ? "\n\n--- PAGE " + (i + 1) + " ---\n\n" : "") + pageText;
          }
        }
      } else {
        setIsPdf(false);
        setPreview(URL.createObjectURL(f));
        setPageCount(1);
        setCurrentPage(1);
        setStatus("scanning");
        fullText = await ocrSource(f);
      }

      setText(fullText);
      setParsed(parseFine(fullText, knownPlates));
      setStatus("done");
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  function onFile(f: File | null) {
    if (!f) return;
    reset();
    startTransition(() => runOcr(f));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
          className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[var(--color-brand)] transition"
        >
          {!preview && status === "idle" ? (
            <label className="cursor-pointer block">
              <input
                type="file"
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <Upload className="mx-auto mb-3 text-gray-400" size={36} />
              <div className="font-medium">Glissez-déposez ou cliquez pour importer</div>
              <div className="text-xs text-gray-500 mt-1">PNG, JPG, PDF · le fichier reste sur votre machine</div>
            </label>
          ) : (
            <div className="space-y-3">
              {preview ? (
                <img src={preview} alt="aperçu" className="max-h-80 mx-auto rounded shadow" />
              ) : (
                <div className="h-40 grid place-items-center text-gray-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              )}
              {isPdf && pageCount > 0 && (
                <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <FileText size={12} /> PDF — {pageCount} page{pageCount > 1 ? "s" : ""}
                </div>
              )}
              <button onClick={reset} className="text-xs text-gray-600 underline">
                Changer de fichier
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm font-semibold mb-3">Reconnaissance OCR</div>
          {status === "idle" && <p className="text-sm text-gray-500">En attente d'un fichier…</p>}
          {status === "rendering" && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Loader2 className="animate-spin" size={16} /> Rendu du PDF en cours…
            </div>
          )}
          {status === "scanning" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="animate-spin" size={16} />
                Analyse {isPdf && pageCount > 1 ? `page ${currentPage}/${pageCount}` : "en cours"}… {progress}%
              </div>
              <div className="h-2 bg-gray-100 rounded">
                <div className="h-2 bg-[var(--color-brand)] rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500">Le premier scan télécharge le modèle FR (~10 Mo), c'est normal que ce soit plus long.</p>
            </div>
          )}
          {status === "done" && parsed && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={16} /> Champs extraits {isPdf && pageCount > 1 ? `(${pageCount} pages)` : ""}
              </div>
              <ul className="text-xs grid grid-cols-2 gap-y-1 gap-x-3">
                <Detected k="N° avis" v={parsed.numAvis} />
                <Detected k="Date" v={parsed.dateInfraction} />
                <Detected k="Heure" v={parsed.heureInfraction} />
                <Detected k="Immat." v={parsed.immatriculation} />
                <Detected k="Montant" v={parsed.montantAmende ? `${parsed.montantAmende} €` : undefined} />
                <Detected k="Nature" v={parsed.natureInfraction} />
                <Detected k="Vit. constatée" v={parsed.vitesseConstatee?.toString()} />
                <Detected k="Vit. autorisée" v={parsed.vitesseAutorisee?.toString()} />
              </ul>

              {parsed.immatriculationSuggestions && parsed.immatriculationSuggestions.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                  <div className="text-amber-900">
                    Plaque détectée : <b>{parsed.immatriculationRaw}</b> — aucune correspondance fiable dans la flotte.
                    Suggestions les plus proches :
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {parsed.immatriculationSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setOverrideImmat(s)}
                        className={
                          "px-2 py-1 rounded border font-mono " +
                          (overrideImmat === s
                            ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                            : "bg-white border-amber-300 hover:bg-amber-100")
                        }
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOverrideImmat(parsed.immatriculationRaw ?? null)}
                      className={
                        "px-2 py-1 rounded border font-mono " +
                        (!overrideImmat || overrideImmat === parsed.immatriculationRaw
                          ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                          : "bg-white border-gray-300 hover:bg-gray-50")
                      }
                    >
                      Garder “{parsed.immatriculationRaw}”
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="text-sm text-red-600 space-y-1">
              <div>Erreur lors de l'analyse.</div>
              {errorMsg && <pre className="text-xs bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap">{errorMsg}</pre>}
            </div>
          )}
        </div>
      </div>

      {(status === "done" || status === "idle") && (
        <div className="bg-white border border-gray-200 rounded-lg p-1">
          <div className="p-5">
            <h2 className="font-semibold mb-1">Vérifier &amp; enregistrer</h2>
            <p className="text-xs text-gray-500 mb-4">Modifiez si nécessaire les champs détectés, puis créez le dossier.</p>
          </div>
          <ContraventionForm
            key={overrideImmat ?? parsed?.immatriculation ?? "none"}
            action={createContraventionAction}
            vehicules={vehicules}
            conducteurs={conducteurs}
            initial={{
              numAvis: parsed?.numAvis,
              dateInfraction: parsed?.dateInfraction,
              heureInfraction: parsed?.heureInfraction,
              natureInfraction: parsed?.natureInfraction,
              lieuInfraction: parsed?.lieuInfraction,
              vitesseConstatee: parsed?.vitesseConstatee,
              vitesseAutorisee: parsed?.vitesseAutorisee,
              montantAmende: parsed?.montantAmende,
              pointsRetires: parsed?.pointsRetires,
              dateLimitePaiement: parsed?.dateLimitePaiement,
              immatriculationOcr: overrideImmat ?? parsed?.immatriculation,
              rawOcrText: text || null,
            }}
            submitLabel="Créer le dossier"
          />
        </div>
      )}
    </div>
  );
}

function Detected({ k, v }: { k: string; v?: string | null }) {
  return (
    <li>
      <span className="text-gray-500">{k} :</span>{" "}
      <span className={v ? "font-medium" : "text-gray-400"}>{v ?? "—"}</span>
    </li>
  );
}
