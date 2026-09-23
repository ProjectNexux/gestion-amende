import { sendMail } from "@/lib/mailer";

/**
 * Per-user invitation e-mail (2026-09-23) — mirrors client-invitation-email.ts's tone/shape but
 * targets one individual person's own portal account instead of the société-wide code d'accès.
 * Never includes a plaintext password — the setup link IS the credential.
 */
export async function sendUserInvitationEmail(opts: {
  to: string;
  societeName: string;
  setupUrl: string;
  prenom?: string | null;
  isReset?: boolean;
}) {
  const greeting = opts.prenom?.trim() ? `Bonjour ${opts.prenom.trim()},` : "Bonjour,";
  const brand = process.env.NEXT_PUBLIC_APP_NAME ?? "ScanAppAmendes";
  const loginUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app").replace(/\/$/, "") + "/login";
  const action = opts.isReset ? "réinitialiser votre mot de passe" : "créer votre mot de passe";
  const buttonLabel = opts.isReset ? "Réinitialiser mon mot de passe" : "Créer mon mot de passe";
  const intro = opts.isReset
    ? `Une réinitialisation de mot de passe a été demandée pour votre compte sur l'espace client « ${opts.societeName} ».`
    : `Votre accès individuel à l'espace client « ${opts.societeName} » est prêt.`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `Pour ${action}, cliquez sur le lien ci-dessous :`,
    opts.setupUrl,
    "",
    "Ce lien est personnel, à usage unique, et expire après quelques jours.",
    `Vous pourrez ensuite vous connecter à tout moment sur : ${loginUrl}`,
    "",
    "Cordialement,",
    `L'équipe ${brand}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <p style="font-size: 15px;">${greeting}</p>
      <p style="font-size: 15px;">${escapeHtml(intro)}</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${opts.setupUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">${buttonLabel}</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Ce lien est personnel et à usage unique.<br />
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
      <a href="${opts.setupUrl}" style="color: #2563eb; word-break: break-all;">${opts.setupUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #64748b;">Vous pourrez ensuite vous connecter à tout moment sur :<br />
      <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
      <p style="font-size: 13px; color: #94a3b8;">Cordialement,<br />L'équipe ${brand}</p>
    </div>
  `.trim();

  return sendMail({
    to: [opts.to],
    subject: opts.isReset ? `Réinitialisation de votre mot de passe — ${opts.societeName}` : `Votre accès à ${brand} — ${opts.societeName}`,
    text,
    html,
  });
}

/**
 * "Transmission au client" notification — sent individually to each selected recipient (never a
 * single e-mail with multiple `to` addresses, so recipients never see each other's addresses).
 * Deliberately NEVER links directly to the file — only to /login, requiring authentication.
 */
export async function sendDocumentTransmissionEmail(opts: {
  to: string;
  prenom?: string | null;
  societeName: string;
  titre: string;
  message?: string | null;
}) {
  const greeting = opts.prenom?.trim() ? `Bonjour ${opts.prenom.trim()},` : "Bonjour,";
  const brand = process.env.NEXT_PUBLIC_APP_NAME ?? "ScanAppAmendes";
  const loginUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app").replace(/\/$/, "") + "/login";

  const text = [
    greeting,
    "",
    `Un nouveau document a été transmis à « ${opts.societeName} » : ${opts.titre}.`,
    opts.message ? `\nMessage : ${opts.message}` : "",
    "",
    `Connectez-vous à votre espace client pour le consulter et le télécharger : ${loginUrl}`,
    "",
    "Cordialement,",
    `L'équipe ${brand}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <p style="font-size: 15px;">${greeting}</p>
      <p style="font-size: 15px;">Un nouveau document a été transmis à <strong>${escapeHtml(opts.societeName)}</strong> : <strong>${escapeHtml(opts.titre)}</strong>.</p>
      ${opts.message ? `<p style="font-size: 14px; color: #334155; background:#f8fafc; border-radius:8px; padding:10px 14px;">${escapeHtml(opts.message)}</p>` : ""}
      <p style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Consulter le document</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Une authentification est nécessaire pour accéder au document — ce lien mène uniquement à la page de connexion.</p>
      <p style="font-size: 13px; color: #94a3b8;">Cordialement,<br />L'équipe ${brand}</p>
    </div>
  `.trim();

  return sendMail({
    to: [opts.to],
    subject: `Nouveau document transmis — ${opts.titre}`,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
