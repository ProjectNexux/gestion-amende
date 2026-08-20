import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const execFileAsync = promisify(execFile);

// Local trained data (see public/tessdata/) — avoids tesseract.js falling back to its default
// CDN download on every worker creation, which is slow and fails without outbound network access.
const TESSDATA_PATH = path.join(process.cwd(), "public", "tessdata");

function log(msg: string) { console.log(`[EMAIL-SCAN][OCR] ${msg}`); }

/**
 * Server-side OCR using tesseract.js (WASM, no system install needed).
 * Handles PDF (native text or image-based) and image files.
 */
export async function serverOcr(fileData: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    return ocrPdf(fileData);
  }
  // JPG/PNG: direct OCR
  return ocrImageBuffer(fileData);
}

async function ocrPdf(pdfData: Buffer): Promise<string> {
  // Step 1: try native text extraction
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(pdfData);
  const doc = await pdfjs.getDocument({ data }).promise;

  let nativeText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return typeof obj.str === "string" ? obj.str : "";
      })
      .join(" ");
    nativeText += (i > 1 ? "\n\n" : "") + pageText;
  }

  // If native text is sufficient (> 80 chars of meaningful content), use it
  const meaningful = nativeText.replace(/\s+/g, "").length;
  if (meaningful > 80) {
    log(`PDF texte natif détecté (${meaningful} chars)`);
    return nativeText;
  }

  // Step 2: PDF is image-based — rasterize pages and OCR them.
  // Rendering via pdfjs+node-canvas is unreliable here (some embedded image
  // encodings make node-canvas throw "Image or Canvas expected", and
  // swapping to @napi-rs/canvas caused a fatal native crash alongside
  // sharp/tesseract.js in this process). `pdftoppm` (poppler-utils) is a
  // battle-tested system binary for this and avoids all of that entirely.
  log(`PDF image détecté, lancement OCR sur ${doc.numPages} page(s)`);
  let fullText = "";

  const tmpDir = await mkdtemp(path.join(tmpdir(), "scan-ocr-"));
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra+eng", 1, { langPath: TESSDATA_PATH, gzip: false, cachePath: TESSDATA_PATH });
  try {
    const pdfPath = path.join(tmpDir, "input.pdf");
    await writeFile(pdfPath, pdfData);

    for (let i = 1; i <= Math.min(doc.numPages, 5); i++) {
      const outPrefix = path.join(tmpDir, `page-${i}`);
      await execFileAsync("pdftoppm", [
        "-png",
        "-singlefile",
        "-r",
        "300",
        "-f",
        String(i),
        "-l",
        String(i),
        pdfPath,
        outPrefix,
      ]);
      const pngBuffer = await readFile(`${outPrefix}.png`);
      const pageText = await ocrImageBuffer(pngBuffer, worker);
      fullText += (i > 1 ? `\n\n--- PAGE ${i} ---\n\n` : "") + pageText;
    }
  } finally {
    await worker.terminate();
    await rm(tmpDir, { recursive: true, force: true });
  }

  return fullText;
}

async function ocrImageBuffer(imgBuffer: Buffer, sharedWorker?: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>): Promise<string> {
  // Preprocess with sharp for better OCR results
  const processed = await sharp(imgBuffer)
    .greyscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();

  const worker =
    sharedWorker ??
    (await (await import("tesseract.js")).createWorker("fra+eng", 1, { langPath: TESSDATA_PATH, gzip: false, cachePath: TESSDATA_PATH }));

  try {
    const { data } = await worker.recognize(processed);
    return data.text;
  } finally {
    if (!sharedWorker) await worker.terminate();
  }
}
