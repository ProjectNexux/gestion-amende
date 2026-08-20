"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle2, FileText, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { parseFine, type ParsedFine } from "@/lib/fine-parser";
import { pdfToCanvases, extractPdfText, pdfFirstPagePreview, preprocessForOcr } from "@/lib/pdf-to-images";
import ScanSaveForm from "./ScanSaveForm";

type Opt = { id: string; label: string };

type ScanResult = {
  id: string;
  fileName: string;
  preview: string | null;
  isPdf: boolean;
  pageCount: number;
  text: string;
  parsed: ParsedFine | null;
  error: string | null;
};

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0);
  return copy;
}

function invertCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = cloneCanvas(canvas);
  const ctx = copy.getContext("2d");
  if (!ctx) return copy;
  const img = ctx.getImageData(0, 0, copy.width, copy.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  return copy;
}

function rotateCanvas(source: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const out = document.createElement("canvas");
  if (degrees === 90 || degrees === 270) {
    out.width = source.height;
    out.height = source.width;
  } else {
    out.width = source.width;
    out.height = source.height;
  }

  const ctx = out.getContext("2d");
  if (!ctx) return cloneCanvas(source);

  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

function upscaleCanvas(source: HTMLCanvasElement, factor = 1.6): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.ceil(source.width * factor);
  out.height = Math.ceil(source.height * factor);
  const ctx = out.getContext("2d");
  if (!ctx) return cloneCanvas(source);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function ocrTextScore(text: string): number {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return 0;
  const alphaNum = (compact.match(/[A-Za-z0-9]/g) ?? []).length;
  return alphaNum;
}

// Score at/above which we stop trying further preprocessing variants — most well-lit scans clear
// this on the very first attempt, so this is what turns "7 sequential OCR passes" into "1" in the
// common case (each fresh tesseract worker + recognition pass previously cost 1-3s on its own).
const GOOD_ENOUGH_SCORE = 80;

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Format d'image non pris en charge. Utilise un JPG, PNG ou PDF.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Impossible de préparer l'image pour l'OCR.");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export default function ScanClient({ vehicules, conducteurs, knownPlates }: { vehicules: Opt[]; conducteurs: Opt[]; knownPlates: string[] }) {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "rendering" | "scanning" | "done" | "error">("idle");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [, startTransition] = useTransition();

  const activeResult = results[selectedIndex] ?? null;

  function reset() {
    setResults([]);
    setSelectedIndex(0);
    setViewerOpen(false);
    setStatus("idle");
    setCurrentFileName("");
    setProgress(0);
    setCurrentPage(0);
    setPageCount(0);
    setErrorMsg("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function createOcrWorker() {
    const { createWorker } = await import("tesseract.js");
    return createWorker("fra+eng", 1, {
      // Absolute URL required: the worker thread's fetch() can't resolve a root-relative path.
      langPath: `${window.location.origin}/tessdata`,
      gzip: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          setProgress(Math.round(m.progress * 100));
        }
      },
      errorHandler: (error: unknown) => {
        setErrorMsg(error instanceof Error ? error.message : String(error));
      },
    });
  }

  // Recognizes with an already-created worker (recreating one per attempt was the main cost —
  // each createWorker() re-initializes the WASM core, which dwarfs the recognition time itself).
  async function recognizeWithWorker(
    worker: Awaited<ReturnType<typeof createOcrWorker>>,
    source: File | HTMLCanvasElement,
    psm: import("tesseract.js").PSM,
  ): Promise<string> {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1" });
    } catch {
      // Certaines versions de tesseract.js ignorent ces paramètres.
    }
    const { data } = await worker.recognize(source);
    return data.text;
  }

  async function ocrCanvasRobust(canvas: HTMLCanvasElement): Promise<string> {
    const { PSM } = await import("tesseract.js");
    const attempts: Array<() => Promise<[HTMLCanvasElement, import("tesseract.js").PSM]>> = [
      async () => [cloneCanvas(canvas), PSM.SINGLE_BLOCK],
      async () => [cloneCanvas(canvas), PSM.AUTO], // mise en page multi-colonnes/tableaux (encadrés ANTAI)
      async () => {
        const enhanced = cloneCanvas(canvas);
        preprocessForOcr(enhanced);
        return [enhanced, PSM.SINGLE_BLOCK];
      },
      async () => {
        const up = upscaleCanvas(canvas);
        preprocessForOcr(up);
        return [up, PSM.SINGLE_BLOCK];
      },
      async () => {
        const r90 = rotateCanvas(canvas, 90);
        preprocessForOcr(r90);
        return [r90, PSM.SINGLE_BLOCK];
      },
      async () => {
        const r270 = rotateCanvas(canvas, 270);
        preprocessForOcr(r270);
        return [r270, PSM.SINGLE_BLOCK];
      },
      async () => {
        const inv = invertCanvas(canvas);
        preprocessForOcr(inv);
        return [inv, PSM.SINGLE_BLOCK];
      },
    ];

    let bestText = "";
    let firstError: Error | null = null;
    const worker = await createOcrWorker();

    try {
      for (const attempt of attempts) {
        try {
          const [source, psm] = await attempt();
          const text = await recognizeWithWorker(worker, source, psm);
          if (ocrTextScore(text) > ocrTextScore(bestText)) {
            bestText = text;
          }
          if (ocrTextScore(bestText) >= GOOD_ENOUGH_SCORE) {
            break; // assez bon : inutile de tester les variantes restantes
          }
        } catch (e) {
          if (!firstError) {
            firstError = e instanceof Error ? e : new Error(String(e));
          }
        }
      }
    } finally {
      try {
        await worker.terminate();
      } catch {
        // ignore terminate failures
      }
    }

    if (ocrTextScore(bestText) > 0) {
      return bestText;
    }

    if (firstError) throw firstError;
    throw new Error("Aucun texte détecté sur le document.");
  }

  async function runOcr(fileList: File[]) {
    if (!fileList.length) return;

    const collected: ScanResult[] = [];
    setErrorMsg("");

    for (let index = 0; index < fileList.length; index++) {
      const file = fileList[index];
      const id = `${Date.now()}-${index}-${file.name}`;
      const isPdf = isPdfFile(file);
      let text = "";
      let preview: string | null = isPdf ? null : URL.createObjectURL(file);
      let pdfPages = 1;

      setCurrentFileName(file.name);
      setProgress(0);
      setCurrentPage(0);
      setPageCount(0);

      try {
        if (isPdf) {
          setStatus("rendering");
          const nativeText = await extractPdfText(file);
          preview = await pdfFirstPagePreview(file).catch(() => null);

          if (nativeText.length > 80) {
            text = nativeText;
            setCurrentPage(1);
            setPageCount(1);
          } else {
            let canvases = await pdfToCanvases(file, { scale: 4, maxPages: 2 });
            pdfPages = canvases.length;
            setStatus("scanning");
            setPageCount(pdfPages);

            if (!preview && canvases[0]) {
              preview = canvases[0].toDataURL("image/png");
            }

            for (let i = 0; i < canvases.length; i++) {
              setCurrentPage(i + 1);
              setProgress(0);
              const pageText = await ocrCanvasRobust(canvases[i]);
              text += (i > 0 ? `\n\n--- PAGE ${i + 1} ---\n\n` : "") + pageText;
            }

            // Si l'OCR reste très pauvre, on retente en résolution plus élevée.
            if (ocrTextScore(text) < 80) {
              const hiResCanvases = await pdfToCanvases(file, { scale: 5, maxPages: 2 });
              if (hiResCanvases.length > 0) {
                canvases = hiResCanvases;
                pdfPages = canvases.length;
                setPageCount(pdfPages);
                let retryText = "";
                for (let i = 0; i < canvases.length; i++) {
                  setCurrentPage(i + 1);
                  setProgress(0);
                  const pageText = await ocrCanvasRobust(canvases[i]);
                  retryText += (i > 0 ? `\n\n--- PAGE ${i + 1} ---\n\n` : "") + pageText;
                }
                if (ocrTextScore(retryText) > ocrTextScore(text)) {
                  text = retryText;
                }
              }
            }
          }

          collected.push({
            id,
            fileName: file.name,
            preview,
            isPdf: true,
            pageCount: pdfPages,
            text,
            parsed: parseFine(text, knownPlates),
            error: null,
          });
        } else {
          setStatus("scanning");
          setCurrentPage(1);
          setPageCount(1);
          const imageCanvas = await fileToCanvas(file);
          if (!preview) preview = imageCanvas.toDataURL("image/png");
          text = await ocrCanvasRobust(imageCanvas);

          collected.push({
            id,
            fileName: file.name,
            preview,
            isPdf: false,
            pageCount: 1,
            text,
            parsed: parseFine(text, knownPlates),
            error: null,
          });
        }
      } catch (e) {
        collected.push({
          id,
          fileName: file.name,
          preview,
          isPdf,
          pageCount: isPdf ? pdfPages : 1,
          text,
          parsed: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    setResults(collected);
    setSelectedIndex(0);

    const successCount = collected.filter((r) => !!r.parsed && !r.error).length;
    const errorCount = collected.filter((r) => !!r.error).length;

    if (successCount === 0 && errorCount > 0) {
      setErrorMsg("Aucun fichier n'a pu être analysé automatiquement. Tu peux compléter chaque amende manuellement ou supprimer celles en erreur.");
    } else if (errorCount > 0) {
      setErrorMsg(`${errorCount} fichier(s) n'ont pas pu être analysés complètement.`);
    }

    setStatus("done");
  }

  function onFiles(filesList: File[] | FileList | null) {
    const list = Array.from(filesList ?? []).filter((f) => f && f.size > 0);
    if (!list.length) return;
    reset();
    setFiles(list);
    startTransition(() => runOcr(list));
  }

  function openViewer(index: number) {
    setSelectedIndex(index);
    setViewerOpen(true);
  }

  function moveViewer(step: number) {
    if (!results.length) return;
    const next = (selectedIndex + step + results.length) % results.length;
    setSelectedIndex(next);
  }

  function removeResult(id: string) {
    setResults((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;

      const next = prev.filter((r) => r.id !== id);

      if (next.length === 0) {
        setSelectedIndex(0);
        setViewerOpen(false);
        setStatus("idle");
        setErrorMsg("");
        return next;
      }

      if (selectedIndex > idx) {
        setSelectedIndex(selectedIndex - 1);
      } else if (selectedIndex >= next.length) {
        setSelectedIndex(next.length - 1);
      }

      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[var(--color-brand)] transition"
        >
          {results.length === 0 && status === "idle" ? (
            <label className="cursor-pointer block">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Upload className="mx-auto mb-3 text-gray-400" size={36} />
              <div className="font-medium">Glissez-déposez ou cliquez pour importer</div>
              <div className="text-xs text-gray-500 mt-1">PNG, JPG, PDF · plusieurs fichiers acceptés</div>
            </label>
          ) : (
            <div className="space-y-3">
              {activeResult?.preview ? (
                <button
                  type="button"
                  onClick={() => openViewer(selectedIndex)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:border-[var(--color-brand)] hover:bg-indigo-50"
                  aria-label="Agrandir l'aperçu du document"
                >
                  <img src={activeResult.preview} alt="aperçu" className="max-h-80 mx-auto rounded shadow-sm object-contain" />
                </button>
              ) : (
                <div className="h-40 grid place-items-center text-gray-400">
                  {status === "idle" ? <Upload size={28} /> : <Loader2 className="animate-spin" size={28} />}
                </div>
              )}

              {files.length > 0 && (
                <div className="text-left text-xs text-gray-600 rounded bg-slate-50 border border-slate-200 p-2">
                  <div className="font-medium text-gray-700 mb-1">Fichiers sélectionnés ({files.length})</div>
                  <ul className="space-y-1 max-h-28 overflow-auto">
                    {(results.length > 0 ? results.map((r) => r.fileName) : files.map((f) => f.name)).map((name, i) => (
                      <li key={`${name}-${i}`} className={selectedIndex === i ? "truncate font-medium text-[var(--color-brand)]" : "truncate"}>
                        • {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 text-xs">
                {activeResult?.preview && (
                  <button type="button" onClick={() => openViewer(selectedIndex)} className="text-[var(--color-brand)] underline">
                    Visualiser l'amende
                  </button>
                )}
                <button type="button" onClick={reset} className="text-gray-600 underline">
                  Changer les fichiers
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm font-semibold mb-3">Reconnaissance OCR</div>

          {status === "idle" && <p className="text-sm text-gray-500">En attente de fichiers…</p>}

          {(status === "rendering" || status === "scanning") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="animate-spin" size={16} />
                Analyse en cours: {currentFileName || "document"}
              </div>
              <div className="text-xs text-gray-500">
                {pageCount > 1 ? `Page ${currentPage}/${pageCount}` : "Traitement du fichier"}
              </div>
              <div className="h-2 bg-gray-100 rounded">
                <div className="h-2 bg-[var(--color-brand)] rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {status === "done" && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={16} />
                {results.filter((r) => r.parsed && !r.error).length} amende(s) analysée(s)
              </div>
              <ul className="space-y-2 text-xs">
                {results.map((r, idx) => (
                  <li key={r.id} className="rounded border border-slate-200 p-2">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedIndex(idx)}
                    >
                      <div className="font-medium text-slate-700">{idx + 1}. {r.fileName}</div>
                      <div className={r.error ? "text-red-600" : "text-emerald-700"}>
                        {r.error ? `Erreur: ${r.error}` : "Analyse prête"}
                      </div>
                      {r.isPdf && r.pageCount > 0 && (
                        <div className="text-gray-500 mt-1 flex items-center gap-1">
                          <FileText size={12} /> {r.pageCount} page{r.pageCount > 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-red-600 space-y-1">
              <div>Erreur lors de l'analyse.</div>
              {errorMsg && <pre className="text-xs bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap">{errorMsg}</pre>}
            </div>
          )}

          {errorMsg && status !== "error" && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold mb-1">Amendes détectées</h2>
            <p className="text-xs text-gray-500">Chaque document est affiché à la suite. Tu peux enregistrer chaque amende séparément.</p>
          </div>

          {results.map((result, index) => (
            <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Amende {index + 1}</div>
                  <div className="text-xs text-gray-500">{result.fileName}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {result.preview && (
                    <button type="button" className="text-[var(--color-brand)] underline" onClick={() => openViewer(index)}>
                      Visualiser l'amende
                    </button>
                  )}
                  {result.isPdf && result.pageCount > 0 && (
                    <span className="text-gray-500 flex items-center gap-1"><FileText size={12} /> {result.pageCount} page{result.pageCount > 1 ? "s" : ""}</span>
                  )}
                  {result.error && (
                    <button
                      type="button"
                      onClick={() => removeResult(result.id)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  )}
                </div>
              </div>

              {result.error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-2">
                  <div className="font-medium">Erreur d'analyse OCR</div>
                  <pre className="text-xs whitespace-pre-wrap">{result.error}</pre>
                  <div className="text-xs text-red-800">
                    Tu peux garder cette amende et la compléter manuellement, ou la supprimer.
                  </div>
                </div>
              )}

              {!result.error && (
                <>
                  {result.parsed && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 size={16} /> Champs extraits
                      </div>
                      <ul className="text-xs grid grid-cols-2 gap-y-1 gap-x-3">
                        <Detected k="N° avis" v={result.parsed.numAvis} />
                        <Detected k="Date" v={result.parsed.dateInfraction} />
                        <Detected k="Heure" v={result.parsed.heureInfraction} />
                        <Detected k="Immat." v={result.parsed.immatriculation} />
                        <Detected k="Montant" v={result.parsed.montantAmende ? `${result.parsed.montantAmende} €` : undefined} />
                        <Detected k="Nature" v={result.parsed.natureInfraction} />
                        <Detected k="Vit. constatée" v={result.parsed.vitesseConstatee?.toString()} />
                        <Detected k="Vit. autorisée" v={result.parsed.vitesseAutorisee?.toString()} />
                      </ul>
                    </div>
                  )}
                </>
              )}

              <ScanSaveForm
                index={index}
                vehicules={vehicules}
                conducteurs={conducteurs}
                initial={{
                      dateReceptionAvis: result.parsed?.dateReceptionAvis,
                  numAvis: result.parsed?.numAvis,
                  dateInfraction: result.parsed?.dateInfraction,
                  heureInfraction: result.parsed?.heureInfraction,
                  natureInfraction: result.parsed?.natureInfraction,
                  lieuInfraction: result.parsed?.lieuInfraction,
                  vitesseConstatee: result.parsed?.vitesseConstatee,
                  vitesseAutorisee: result.parsed?.vitesseAutorisee,
                  montantAmende: result.parsed?.montantAmende,
                  pointsRetires: result.parsed?.pointsRetires,
                  dateLimitePaiement: result.parsed?.dateLimitePaiement,
                  immatriculationOcr: result.parsed?.immatriculation,
                  rawOcrText: result.text || null,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {viewerOpen && activeResult?.preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setViewerOpen(false)}>
          <div
            className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-700">Visualiser l'amende {selectedIndex + 1}/{results.length}</div>
                <div className="text-xs text-slate-500">{activeResult.fileName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => moveViewer(-1)} className="rounded border border-slate-200 p-1 hover:bg-slate-100" aria-label="Document précédent">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => moveViewer(1)} className="rounded border border-slate-200 p-1 hover:bg-slate-100" aria-label="Document suivant">
                  <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => setViewerOpen(false)} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                  Fermer
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-100 p-4">
              <img src={activeResult.preview} alt="Aperçu agrandi du document" className="mx-auto max-w-full rounded-lg shadow-sm" />
            </div>
          </div>
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
