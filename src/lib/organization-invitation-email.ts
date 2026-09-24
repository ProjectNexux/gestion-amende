import { sendMail } from "@/lib/mailer";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Invitation e-mail sent to a new organization member (owner/admin/collaborator) — distinct from
 * user-invitation-email.ts (client-portal accounts) and client-invitation-email.ts (société-wide
 * code d'accès). Never includes a plaintext password — the setup link IS the credential. */
export async function sendOrganizationInvitationEmail(opts: {
  to: string;
  organizationName: string;
  setupUrl: string;
  prenom?: string | null;
  orgRole: string;
}) {
  const greeting = opts.prenom?.trim() ? `Bonjour ${opts.prenom.trim()},` : "Bonjour,";
  const brand = process.env.NEXT_PUBLIC_APP_NAME ?? "ScanAppAmendes";
  const roleLabel = opts.orgRole === "owner" ? "propriétaire" : opts.orgRole === "admin" ? "administrateur" : "collaborateur";

  const text = [
    greeting,
    "",
    `Vous avez été invité(e) à rejoindre l'organisation « ${opts.organizationName} » sur ${brand}, en tant que ${roleLabel}.`,
    "",
    "Pour créer votre mot de passe et accéder à votre espace, cliquez sur le lien ci-dessous :",
    opts.setupUrl,
    "",
    "Ce lien est personnel, à usage unique, et expire après quelques jours.",
    "",
    "Cordialement,",
    `L'équipe ${brand}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <p style="font-size: 15px;">${greeting}</p>
      <p style="font-size: 15px;">Vous avez été invité(e) à rejoindre l'organisation « ${escapeHtml(opts.organizationName)} » sur ${brand}, en tant que <strong>${roleLabel}</strong>.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${opts.setupUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Créer mon mot de passe</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Ce lien est personnel et à usage unique.<br />
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
      <a href="${opts.setupUrl}" style="color: #2563eb; word-break: break-all;">${opts.setupUrl}</a></p>
    </div>`;

  await sendMail({ to: [opts.to], subject: `Invitation à rejoindre ${opts.organizationName} sur ${brand}`, text, html });
}
