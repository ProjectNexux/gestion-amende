"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Scan,
  X,
} from "lucide-react";

// Standalone pdf.js loader (kept separate from src/lib/pdf-to-images.ts, which is OCR-only).
type Pdfjs = typeof import("pdfjs-dist");
let cachedPdfjs: Pdfjs | null = null;
async function loadPdfjs(): Promise<Pdfjs> {
  if (cachedPdfjs) return cachedPdfjs;
  const pdfjs = (await import("pdfjs-dist")) as Pdfjs;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  cachedPdfjs = pdfjs;
  return pdfjs;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

export function DocumentViewerModal({
  open,
  onClose,
  fileUrl,
  downloadUrl,
  fileName,
  fileMime,
  expanded,
  onToggleExpand,
}: {
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  downloadUrl: string;
  fileName: string;
  fileMime: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const isImage = fileMime.startsWith("image/");
  const isPdf = !isImage && (fileMime === "application/pdf" || /\.pdf$/i.test(fileName));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // pdf.js proxies are intentionally untyped here (same relaxed typing used in pdf-to-images.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  const [scale, setScale] = useState<number | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  // Reset viewer state each time a different document is opened.
  useEffect(() => {
    if (!open) return;
    setScale(null);
    setPageNum(1);
    setPageSize(null);
    setNaturalSize(null);
    setError(null);
    setLoading(true);
    setPdfReady(false);
  }, [open, fileUrl]);

  // Load the PDF document (via the existing secured route) once per open document.
  useEffect(() => {
    if (!open || !isPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const res = await fetch(fileUrl, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Impossible de charger le document.");
        const buf = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        setPdfReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur de chargement du document.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy?.();
      pdfDocRef.current = null;
      setPdfReady(false);
    };
  }, [open, isPdf, fileUrl]);

  const fitToWindow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const availW = Math.max(container.clientWidth - 48, 100);
    const availH = Math.max(container.clientHeight - 48, 100);
    if (isPdf && pageSize) {
      setScale(clampZoom(Math.min(availW / pageSize.w, availH / pageSize.h)));
    } else if (isImage && naturalSize) {
      setScale(clampZoom(Math.min(availW / naturalSize.w, availH / naturalSize.h)));
    }
  }, [isPdf, isImage, pageSize, naturalSize]);

  // Render the current PDF page whenever the page or the zoom level changes.
  useEffect(() => {
    if (!open || !isPdf || !pdfReady || !pdfDocRef.current) return;
    let cancelled = false;
    (async () => {
      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      setPageSize({ w: unscaled.width, h: unscaled.height });

      const effectiveScale = scale ?? Math.min(
        Math.max((containerRef.current?.clientWidth ?? 800) - 48, 100) / unscaled.width,
        Math.max((containerRef.current?.clientHeight ?? 600) - 48, 100) / unscaled.height
      );
      if (scale === null) setScale(clampZoom(effectiveScale));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: clampZoom(effectiveScale) * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      renderTaskRef.current?.cancel?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const task = page.render({ canvasContext: ctx, viewport, canvas } as any);
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        // Render cancelled by a newer page/zoom change — safe to ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isPdf, pdfReady, pageNum, scale]);

  // Auto-fit images once their natural size is known (PDFs auto-fit inside the render effect above).
  useEffect(() => {
    if (!open || !isImage || !naturalSize || scale !== null) return;
    fitToWindow();
  }, [open, isImage, naturalSize, scale, fitToWindow]);

  // Ctrl+wheel to zoom — attached natively so preventDefault reliably blocks the browser zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((s) => clampZoom((s ?? 1) + (e.deltaY < 0 ? 0.1 : -0.1)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [open]);

  if (!open) return null;

  const zoomPercent = Math.round((scale ?? 1) * 100);
  const canZoom = isPdf || isImage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]">
      <div
        className={`flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-popover transition-all animate-[modalIn_150ms_ease-out] ${
          expanded ? "fixed inset-4" : "max-w-5xl h-[85vh]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900">{fileName}</h4>
            {isPdf && <p className="text-xs text-slate-500">Page {pageNum} / {numPages}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <ExternalLink size={13} /> Nouvel onglet
            </a>
            <button
              onClick={onToggleExpand}
              aria-label={expanded ? "Réduire" : "Agrandir"}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={!isPdf || pageNum <= 1}
              aria-label="Page précédente"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[72px] text-center text-xs font-medium text-slate-600">
              Page {pageNum} / {numPages}
            </span>
            <button
              onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
              disabled={!isPdf || pageNum >= numPages}
              aria-label="Page suivante"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale((s) => clampZoom((s ?? 1) - ZOOM_STEP))}
              disabled={!canZoom}
              aria-label="Réduire le zoom"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => setScale(1)}
              disabled={!canZoom}
              title="Réinitialiser (100 %)"
              className="min-w-[52px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {canZoom ? `${zoomPercent} %` : "—"}
            </button>
            <button
              onClick={() => setScale((s) => clampZoom((s ?? 1) + ZOOM_STEP))}
              disabled={!canZoom}
              aria-label="Agrandir le zoom"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={fitToWindow}
              disabled={!canZoom}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Scan size={14} /> Ajuster
            </button>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
            >
              <Download size={14} /> Télécharger
            </a>
          </div>
        </div>

        <div
          ref={containerRef}
          onDoubleClick={fitToWindow}
          className="flex-1 overflow-auto bg-slate-100"
        >
          <div className="relative flex min-h-full min-w-full items-center justify-center p-6">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : isPdf ? (
              <canvas ref={canvasRef} className="rounded-lg bg-white shadow-sm" />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl}
                alt={fileName}
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                  setLoading(false);
                }}
                style={naturalSize ? { width: naturalSize.w * (scale ?? 1), height: naturalSize.h * (scale ?? 1) } : undefined}
                className="select-none rounded-lg bg-white shadow-sm"
              />
            ) : (
              <iframe src={fileUrl} title={fileName} className="h-[70vh] w-full rounded-lg border-0 bg-white" />
            )}
            {loading && !error && <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">Chargement du document…</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
