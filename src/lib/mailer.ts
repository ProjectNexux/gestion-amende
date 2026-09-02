/**
 * Outgoing SMTP mailer — reuses the same Gmail account already configured for IMAP polling
 * (EMAIL_USER / EMAIL_PASSWORD in .env), just against Gmail's SMTP endpoint instead of IMAP.
 * Credentials are read from process.env only; never hardcoded, never logged.
 */

function log(msg: string) { console.log(`[MAILER] ${msg}`); }

export type MailAttachment = { filename: string; content: Buffer; contentType: string };

export type SendMailResult = { messageId: string };

async function createTransport() {
  const { createTransport: create } = await import("nodemailer");
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = parseInt((process.env.SMTP_PORT ?? "465").trim(), 10);
  const secure = (process.env.SMTP_SECURE ?? "true").trim() !== "false";
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASSWORD?.trim();

  if (!user || !pass) {
    throw new Error("Configuration SMTP manquante (EMAIL_USER / EMAIL_PASSWORD non définis).");
  }

  return create({ host, port, secure, auth: { user, pass } });
}

/** Sends one e-mail to all `to` recipients at once (single message, all addressees visible). Server-side only. */
export async function sendMail(opts: {
  to: string[];
  subject: string;
  text: string;
  attachment: MailAttachment;
}): Promise<SendMailResult> {
  if (opts.to.length === 0) throw new Error("Aucun destinataire configuré.");

  const transport = await createTransport();
  const from = process.env.EMAIL_USER?.trim();

  const info = await transport.sendMail({
    from,
    to: opts.to.join(", "),
    subject: opts.subject,
    text: opts.text,
    attachments: [{ filename: opts.attachment.filename, content: opts.attachment.content, contentType: opts.attachment.contentType }],
  });

  log(`Envoyé à ${opts.to.length} destinataire(s), messageId=${info.messageId}`);
  return { messageId: info.messageId };
}
