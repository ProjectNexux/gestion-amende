"use client";

type Pdfjs = typeof import("pdfjs-dist");

let cached: Pdfjs | null = null;

async function loadPdfjs(): Promise<Pdfjs> {
  if (cached) return cached;
  const pdfjs = (await import("pdfjs-dist")) as Pdfjs;
  // Worker copié dans /public au postinstall (scripts/copy-pdf-worker.mjs)
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  cached = pdfjs;
  return pdfjs;
}

function findSequence(data: Uint8Array, seq: number[], fromEnd = false): number {
  if (seq.length === 0 || data.length < seq.length) return -1;
  if (!fromEnd) {
    for (let i = 0; i <= data.length - seq.length; i++) {
      let ok = true;
      for (let j = 0; j < seq.length; j++) {
        if (data[i + j] !== seq[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
    return -1;
  }

  for (let i = data.length - seq.length; i >= 0; i--) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) {
      if (data[i + j] !== seq[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function sanitizePdfBytes(input: Uint8Array): Uint8Array {
  const header = [0x25, 0x50, 0x44, 0x46]; // %PDF
  const eof = [0x25, 0x25, 0x45, 0x4f, 0x46]; // %%EOF

  const start = findSequence(input, header);
  if (start === -1) return input;

  const eofIndex = findSequence(input, eof, true);
  if (eofIndex === -1 || eofIndex < start) {
    return input.slice(start);
  }

  const endExclusive = Math.min(input.length, eofIndex + eof.length);
  return input.slice(start, endExclusive);
}

/**
 * Pré-traite un canvas pour booster la précision OCR :
 * - Niveaux de gris
 * - Binarisation adaptative (seuil d'Otsu simplifié → moyenne)
 */
export function preprocessForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  const grays = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    grays[j] = g;
    sum += g;
  }
  const mean = sum / grays.length;
  const threshold = Math.max(120, Math.min(200, mean * 0.95));
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = grays[j] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function openPdf(file: File) {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const raw = new Uint8Array(buf);

  const openWith = (data: Uint8Array) =>
    pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
    }).promise;

  try {
    return await openWith(raw);
  } catch (error) {
    const cleaned = sanitizePdfBytes(raw);
    const changed = cleaned.length !== raw.length || cleaned[0] !== raw[0];
    if (!changed) throw error;
    return openWith(cleaned);
  }
}

/** Extrait le texte natif d'un PDF (rapide). Retourne "" si PDF scanné. */
export async function extractPdfText(file: File, maxPages?: number): Promise<string> {
  const pdf = await openPdf(file);
  let out = "";
  const totalPages = maxPages ? Math.min(pdf.numPages, Math.max(1, maxPages)) : pdf.numPages;
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    out += (i > 1 ? "\n\n--- PAGE " + i + " ---\n\n" : "") + pageText;
  }
  await pdf.destroy();
  return out.trim();
}

/** Rend chaque page en canvas (pour OCR). */
export async function pdfToCanvases(
  file: File,
  options: { scale?: number; maxPages?: number } = {},
): Promise<HTMLCanvasElement[]> {
  const { scale = 2, maxPages } = options;
  const pdf = await openPdf(file);
  const canvases: HTMLCanvasElement[] = [];
  const totalPages = maxPages ? Math.min(pdf.numPages, Math.max(1, maxPages)) : pdf.numPages;
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
    canvases.push(canvas);
  }
  await pdf.destroy();
  return canvases;
}

/** Rend uniquement la 1ère page en data URL (aperçu). */
export async function pdfFirstPagePreview(file: File, scale = 1.2): Promise<string | null> {
  const pdf = await openPdf(file);
  if (pdf.numPages === 0) return null;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
  const url = canvas.toDataURL("image/png");
  await pdf.destroy();
  return url;
}
