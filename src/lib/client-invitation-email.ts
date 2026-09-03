import { sendMail } from "@/lib/mailer";

/**
 * Sends the "Bienvenue" invitation e-mail: contains the client's own dedicated one-time link to
 * create their access code (see /client-setup/[token]). Server-side only. Never includes a
 * plaintext password or code — the setup link IS the credential.
 */
export async function sendClientInvitationEmail(opts: {
  to: string;
  societeName: string;
  setupUrl: string;
  contactFirstName?: string | null;
}) {
  const greeting = opts.contactFirstName?.trim() ? `Bonjour ${opts.contactFirstName.trim()},` : "Bonjour,";
  const brand = process.env.NEXT_PUBLIC_APP_NAME ?? "ScanAppAmendes";
  const loginUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app").replace(/\/$/, "") + "/login";

  const text = [
    greeting,
    "",
    `Votre espace client ${brand} pour la société « ${opts.societeName} » est prêt.`,
    "",
    "Pour finaliser votre accès, cliquez sur le lien ci-dessous et choisissez votre code d'accès personnel :",
    opts.setupUrl,
    "",
    "Ce lien est personnel et ne peut être utilisé qu'une seule fois.",
    "Après avoir défini votre code, vous pourrez vous connecter à tout moment sur :",
    loginUrl,
    "",
    "Depuis votre espace client, vous pourrez consulter vos documents, vos contraventions et transmettre des pièces à notre équipe.",
    "",
    "Cordialement,",
    `L'équipe ${brand}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <p style="font-size: 15px;">${greeting}</p>
      <p style="font-size: 15px;">Votre espace client <strong>${brand}</strong> pour la société <strong>${escapeHtml(opts.societeName)}</strong> est prêt.</p>
      <p style="font-size: 15px;">Pour finaliser votre accès, cliquez sur le bouton ci-dessous et choisissez votre code d'accès personnel :</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${opts.setupUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Créer mon code d'accès</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Ce lien est personnel et ne peut être utilisé qu'une seule fois.<br />
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
      <a href="${opts.setupUrl}" style="color: #2563eb; word-break: break-all;">${opts.setupUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #64748b;">Après avoir défini votre code, vous pourrez vous connecter à tout moment sur :<br />
      <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
      <p style="font-size: 13px; color: #94a3b8;">Cordialement,<br />L'équipe ${brand}</p>
    </div>
  `.trim();

  return sendMail({
    to: [opts.to],
    subject: `Votre accès à ${brand} — ${opts.societeName}`,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
