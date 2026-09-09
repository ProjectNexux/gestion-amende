import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { classifyDocument } from "@/lib/document-classifier";

const execFileAsync = promisify(execFile);

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MAX_FILE_SIZE = parseInt(process.env.SCAN_EMAIL_MAX_SIZE_MB ?? "25", 10) * 1024 * 1024;
// Ignore images < 50Ko (signatures, logos)
const MIN_IMAGE_SIZE = 50 * 1024;
const PDF_SPLIT_ENABLED = process.env.SCAN_PDF_SPLIT_ENABLED !== "false";
const PDF_SPLIT_MIN_PAGES = Math.max(2, parseInt(process.env.SCAN_PDF_SPLIT_MIN_PAGES ?? "3", 10));
const PDF_SPLIT_MAX_PAGES_PER_CHUNK = Math.max(1, parseInt(process.env.SCAN_PDF_SPLIT_MAX_PAGES_PER_CHUNK ?? "2", 10));
const PDF_SPLIT_MAX_CHUNKS = Math.max(2, parseInt(process.env.SCAN_PDF_SPLIT_MAX_CHUNKS ?? "12", 10));

function log(msg: string) { console.log(`[EMAIL-SCAN] ${msg}`); }
function logError(msg: string) { console.error(`[EMAIL-SCAN] ${msg}`); }

type Attachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  splitFromPage?: number;
  splitToPage?: number;
  splitIndex?: number;
  splitTotal?: number;
};

type PageRange = { from: number; to: number };

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 200);
}

function fileHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function detectMimeFromBytes(data: Buffer): string | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) return "application/pdf";
  return null;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function meaningfulLength(text: string): number {
  return text.replace(/\s+/g, "").length;
}

function getTextHead(text: string, max = 280): string {
  return normalizeText(text).slice(0, max);
}

const NEW_DOC_HEADER_HINTS = [
  /avis\s+de\s+contravention/i,
  /mise\s+en\s+demeure/i,
  /facture\s+n[°ºo]?/i,
  /certificat\s+d[''’]immatriculation/i,
  /carte\s+nationale\s+d[''’]identit[ée]/i,
  /permis\s+de\s+conduire/i,
  /d[ée]claration\s+de\s+sinistre/i,
  /objet\s*:/i,
];

const CONTINUATION_HINTS = [
  /^page\s*\d+\s*[/\\-]\s*\d+/i,
  /\bannexe\b/i,
  /\bsuite\b/i,
  /\bverso\b/i,
];

function hasNewDocumentHeader(text: string): boolean {
  const head = getTextHead(text, 220);
  return NEW_DOC_HEADER_HINTS.some((re) => re.test(head));
}

function looksLikeContinuation(text: string): boolean {
  const head = getTextHead(text, 140);
  return CONTINUATION_HINTS.some((re) => re.test(head));
}

function shouldStartNewChunk(previousPageText: string, currentPageText: string): boolean {
  const prevMeaningful = meaningfulLength(previousPageText);
  const currMeaningful = meaningfulLength(currentPageText);

  if (currMeaningful < 60) return false;
  if (looksLikeContinuation(currentPageText)) return false;

  const prevType = classifyDocument(previousPageText).type;
  const currType = classifyDocument(currentPageText).type;
  const typeBreak = prevType !== "inconnu" && currType !== "inconnu" && prevType !== currType;
  const headerBreak = hasNewDocumentHeader(currentPageText);

  return (typeBreak && headerBreak) || (headerBreak && prevMeaningful >= 120);
}

function computePdfRanges(pageTexts: string[]): PageRange[] {
  if (pageTexts.length < PDF_SPLIT_MIN_PAGES) return [{ from: 1, to: pageTexts.length }];

  const ranges: PageRange[] = [];
  let start = 1;

  for (let page = 2; page <= pageTexts.length; page += 1) {
    const previous = pageTexts[page - 2] ?? "";
    const current = pageTexts[page - 1] ?? "";
    const currentChunkSize = page - start;
    const forceSplitBySize = currentChunkSize >= PDF_SPLIT_MAX_PAGES_PER_CHUNK;
    const detectedBoundary = shouldStartNewChunk(previous, current);

    if (forceSplitBySize || detectedBoundary) {
      ranges.push({ from: start, to: page - 1 });
      start = page;
    }
  }

  ranges.push({ from: start, to: pageTexts.length });
  return ranges;
}

async function extractPdfPagesText(pdfData: Buffer): Promise<string[] | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfData) }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: unknown) => {
          const obj = item as Record<string, unknown>;
          return typeof obj.str === "string" ? obj.str : "";
        })
        .join(" ");
      pages.push(text);
    }

    return pages;
  } catch {
    return null;
  }
}

function withPartSuffix(filename: string, index: number, total: number, from: number, to: number): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  const padIndex = String(index).padStart(2, "0");
  const safeRange = from === to ? `p${from}` : `p${from}-${to}`;
  return `${base}_part-${padIndex}-sur-${total}_${safeRange}${ext || ".pdf"}`;
}

async function buildPdfChunks(pdfData: Buffer, ranges: PageRange[], originalName: string): Promise<Attachment[]> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "scan-split-"));
  const inputPath = path.join(tmpDir, "input.pdf");
  await writeFile(inputPath, pdfData);

  try {
    const result: Attachment[] = [];
    const total = ranges.length;

    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i];
      const index = i + 1;

      if (range.from === range.to) {
        const singlePrefix = path.join(tmpDir, `single-${index}`);
        await execFileAsync("pdfseparate", ["-f", String(range.from), "-l", String(range.to), inputPath, `${singlePrefix}-%d.pdf`]);
        const pagePath = `${singlePrefix}-${range.from}.pdf`;
        result.push({
          filename: withPartSuffix(originalName, index, total, range.from, range.to),
          contentType: "application/pdf",
          content: await readFile(pagePath),
          splitFromPage: range.from,
          splitToPage: range.to,
          splitIndex: index,
          splitTotal: total,
        });
        continue;
      }

      const multiPrefix = path.join(tmpDir, `multi-${index}`);
      await execFileAsync("pdfseparate", ["-f", String(range.from), "-l", String(range.to), inputPath, `${multiPrefix}-%d.pdf`]);
      const pageFiles = [];
      for (let p = range.from; p <= range.to; p += 1) {
        pageFiles.push(`${multiPrefix}-${p}.pdf`);
      }
      const mergedPath = path.join(tmpDir, `chunk-${index}.pdf`);
      await execFileAsync("pdfunite", [...pageFiles, mergedPath]);

      result.push({
        filename: withPartSuffix(originalName, index, total, range.from, range.to),
        contentType: "application/pdf",
        content: await readFile(mergedPath),
        splitFromPage: range.from,
        splitToPage: range.to,
        splitIndex: index,
        splitTotal: total,
      });
    }

    return result;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function splitPdfAttachment(att: Attachment): Promise<Attachment[] | null> {
  if (!PDF_SPLIT_ENABLED) return null;
  const pageTexts = await extractPdfPagesText(att.content);
  if (!pageTexts || pageTexts.length < PDF_SPLIT_MIN_PAGES) return null;

  const ranges = computePdfRanges(pageTexts);
  if (ranges.length <= 1) return null;
  if (ranges.length > PDF_SPLIT_MAX_CHUNKS) {
    log(`Découpage ignoré (${ranges.length} blocs > limite ${PDF_SPLIT_MAX_CHUNKS}): ${att.filename}`);
    return null;
  }

  try {
    return await buildPdfChunks(att.content, ranges, att.filename || "scan.pdf");
  } catch (e) {
    logError(`Découpage PDF échoué (${att.filename}), fallback document unique: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function resolveSociete(toAddress: string): string {
  const local = toAddress.split("@")[0] ?? "";
  const match = local.match(/^scan[+\-](.+)$/i);
  if (match && match[1]) return match[1];
  return process.env.SCAN_DEFAULT_SOCIETE ?? "Societe principale";
}

export async function processEmailAttachments(opts: {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  attachments: Attachment[];
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { messageId, from, to, subject, attachments } = opts;
  const societe = resolveSociete(to);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  async function importOneAttachment(att: Attachment) {
    const realMime = detectMimeFromBytes(att.content);
    const effectiveMime = realMime ?? att.contentType;

    if (!ALLOWED_MIMES.has(effectiveMime)) {
      log(`Pièce jointe ignorée (type non autorisé): ${att.filename} [${effectiveMime}]`);
      return;
    }

    if (effectiveMime.startsWith("image/") && att.content.length < MIN_IMAGE_SIZE) {
      log(`Image ignorée (trop petite, probablement signature/logo): ${att.filename} [${att.content.length} octets]`);
      return;
    }

    if (att.content.length > MAX_FILE_SIZE) {
      const msg = `${att.filename}: taille trop grande (${Math.round(att.content.length / 1024 / 1024)}Mo)`;
      logError(msg);
      errors.push(msg);
      return;
    }

    const hash = fileHash(att.content);
    const splitPart = att.splitFromPage && att.splitToPage ? `-p${att.splitFromPage}-${att.splitToPage}` : "";
    const messageKey = `${messageId}${splitPart}-${hash.slice(0, 8)}`;

    const existing = await prisma.emailScan.findFirst({
      where: { OR: [{ fileHash: hash }, { messageId: messageKey }] },
    });

    if (existing) {
      log(`Doublon détecté (hash ou messageId): ${att.filename}`);
      skipped += 1;
      return;
    }

    await prisma.emailScan.create({
      data: {
        societe,
        messageId: messageKey,
        fromAddress: from,
        subject,
        fileName: sanitizeFilename(att.filename || "scan"),
        fileHash: hash,
        fileMime: effectiveMime,
        fileSize: att.content.length,
        fileData: att.content,
        status: "received",
      },
    });

    const splitLabel = att.splitFromPage && att.splitToPage
      ? ` [pages ${att.splitFromPage}${att.splitFromPage === att.splitToPage ? "" : `-${att.splitToPage}`}]`
      : "";
    log(`Document récupéré: ${att.filename}${splitLabel} (${Math.round(att.content.length / 1024)}Ko) — société: ${societe}`);
    imported += 1;
  }

  for (const att of attachments) {
    const realMime = detectMimeFromBytes(att.content);
    const effectiveMime = realMime ?? att.contentType;

    if (effectiveMime === "application/pdf") {
      const split = await splitPdfAttachment(att);
      if (split && split.length > 1) {
        log(`PDF multi-pages découpé en ${split.length} bloc(s): ${att.filename}`);
        for (const part of split) {
          await importOneAttachment(part);
        }
        continue;
      }
    }

    await importOneAttachment(att);
  }

  return { imported, skipped, errors };
}

export async function fetchEmailsViaImap(): Promise<{ processed: number; errors: string[] }> {
  // .env values can carry stray leading/trailing whitespace (e.g. accidental
  // trailing space after pasting an app password) — trim defensively so a
  // hidden whitespace character never breaks IMAP auth silently.
  const host = process.env.EMAIL_HOST?.trim();
  const port = parseInt((process.env.EMAIL_PORT ?? "993").trim(), 10);
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASSWORD?.trim();
  const secure = process.env.EMAIL_SECURE?.trim() !== "false";

  if (!host || !user || !pass) {
    return { processed: 0, errors: ["Variables EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD manquantes"] };
  }

  const { ImapFlow } = await import("imapflow");
  const mailparser = await import("mailparser");
  const simpleParser = mailparser.simpleParser;

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  // ImapFlow emits socket-level errors (timeouts, DNS issues) as async 'error'
  // events; without a listener Node treats them as uncaughtException and can
  // crash the dev server. The outer try/catch already reports connection
  // failures, so just swallow/log here to keep the poll cycle resilient.
  client.on("error", (e) => {
    logError(`Erreur socket IMAP: ${e instanceof Error ? e.message : String(e)}`);
  });

  let processed = 0;
  const errors: string[] = [];

  try {
    await client.connect();
    log(`Connexion IMAP réussie: ${host}`);
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Only fetch unseen messages — fetching "1:*" would re-download the
      // full source (including attachments) of every already-processed
      // message on every single poll cycle, wasting bandwidth and time.
      // IMPORTANT: ImapFlow forbids running IMAP commands (like
      // messageFlagsAdd) while still iterating a fetch() generator — doing
      // so deadlocks the connection until the socket timeout fires. So we
      // fully drain the fetch generator into an array first, then issue
      // flag updates afterwards, once the FETCH command has completed.
      const fetched = [];
      for await (const msg of client.fetch(
        { seen: false },
        { envelope: true, source: true, flags: true }
      )) {
        fetched.push(msg);
      }

      for (const msg of fetched) {
        if (msg.flags?.has("\\Seen")) continue;

        try {
          const source = msg.source;
          if (!source) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = await (simpleParser as any)(source);
          const messageId = parsed.messageId ?? `imap-${msg.uid}`;
          const from = typeof parsed.from?.text === "string" ? parsed.from.text : "";
          const to = typeof parsed.to === "object" && parsed.to && "text" in parsed.to ? (parsed.to as { text: string }).text : (process.env.EMAIL_USER ?? "");
          const subject = parsed.subject ?? "";

          log(`Nouvel e-mail reçu de: ${from} — sujet: "${subject}"`);

          const attachments: Attachment[] = (parsed.attachments ?? []).map((a: { filename?: string; contentType: string; content: Buffer }) => ({
            filename: a.filename ?? "attachment",
            contentType: a.contentType,
            content: a.content,
          }));

          if (attachments.length === 0) {
            log(`E-mail sans pièce jointe exploitable, ignoré`);
          } else {
            const result = await processEmailAttachments({
              messageId,
              from,
              to,
              subject,
              attachments,
            });
            processed += result.imported;
            errors.push(...result.errors);
          }

          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
        } catch (e) {
          const errMsg = `Message UID ${msg.uid}: ${e instanceof Error ? e.message : String(e)}`;
          logError(errMsg);
          errors.push(errMsg);
        }
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    const errMsg = `Erreur connexion IMAP: ${e instanceof Error ? e.message : String(e)}`;
    logError(errMsg);
    errors.push(errMsg);
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }

  log(`Polling terminé: ${processed} document(s) importé(s)`);
  return { processed, errors };
}
