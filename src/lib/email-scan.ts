import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MAX_FILE_SIZE = parseInt(process.env.SCAN_EMAIL_MAX_SIZE_MB ?? "25", 10) * 1024 * 1024;
// Ignore images < 50Ko (signatures, logos)
const MIN_IMAGE_SIZE = 50 * 1024;

function log(msg: string) { console.log(`[EMAIL-SCAN] ${msg}`); }
function logError(msg: string) { console.error(`[EMAIL-SCAN] ${msg}`); }

type Attachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

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

  for (const att of attachments) {
    const realMime = detectMimeFromBytes(att.content);
    const effectiveMime = realMime ?? att.contentType;

    if (!ALLOWED_MIMES.has(effectiveMime)) {
      log(`Pièce jointe ignorée (type non autorisé): ${att.filename} [${effectiveMime}]`);
      continue;
    }

    // Filter out small images (signatures, logos in email footers)
    if (effectiveMime.startsWith("image/") && att.content.length < MIN_IMAGE_SIZE) {
      log(`Image ignorée (trop petite, probablement signature/logo): ${att.filename} [${att.content.length} octets]`);
      continue;
    }

    if (att.content.length > MAX_FILE_SIZE) {
      const msg = `${att.filename}: taille trop grande (${Math.round(att.content.length / 1024 / 1024)}Mo)`;
      logError(msg);
      errors.push(msg);
      continue;
    }

    const hash = fileHash(att.content);

    const existing = await prisma.emailScan.findFirst({
      where: { OR: [{ fileHash: hash }, { messageId }] },
    });

    if (existing) {
      log(`Doublon détecté (hash ou messageId): ${att.filename}`);
      skipped++;
      continue;
    }

    await prisma.emailScan.create({
      data: {
        societe,
        messageId: `${messageId}-${hash.slice(0, 8)}`,
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

    log(`PDF récupéré: ${att.filename} (${Math.round(att.content.length / 1024)}Ko) — société: ${societe}`);
    imported++;
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
