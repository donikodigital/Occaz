// backend/src/integrations/email/email-template.ts
//
// Gabarit HTML des emails de notification — jusqu'ici un simple <p> avec
// le texte brut, sans marque ni mise en forme (voir capture reçue par
// Doniko : "Motif : Annulation trajet" seul, sans contexte). Les clients
// mail supportent mal le CSS moderne (flexbox/grid souvent ignorés, les
// balises <style> parfois retirées) — mise en page par tableau et styles
// en ligne uniquement, sur toute la fonction, même si c'est verbeux.
// Couleurs alignées sur OCEAN (voir mobile/src/theme/ocean.ts et
// web-admin/globals.css) : même identité que l'app et le back-office.

const OCEAN = {
  base: '#0B6BA8',
  deep: '#083A63',
  bright: '#1E9BD7',
  mist: '#EAF5FB',
  line: '#CFE4F2',
};

export interface NotificationEmailContent {
  title: string;
  body: string;
  /** Bouton d'action optionnel (ex. lien vers le litige dans le back-office) — omis si absent, jamais un bouton qui ne mène nulle part. */
  actionUrl?: string;
  actionLabel?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** `\n` du texte brut → <br> — le corps d'une notification est toujours du texte simple, jamais du HTML à faire confiance tel quel. */
function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

export function renderNotificationEmailHtml({ title, body, actionUrl, actionLabel }: NotificationEmailContent): string {
  const button =
    actionUrl && actionLabel
      ? `
        <tr>
          <td style="padding: 8px 0 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-radius: 10px; background-color: ${OCEAN.base};">
                  <a
                    href="${escapeHtml(actionUrl)}"
                    style="display: inline-block; padding: 12px 22px; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;"
                  >
                    ${escapeHtml(actionLabel)}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : '';

  return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #F5F4F1; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F4F1; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 10px rgba(8, 58, 99, 0.08);">
            <tr>
              <td style="background-color: ${OCEAN.base}; background: linear-gradient(135deg, ${OCEAN.bright} 0%, ${OCEAN.base} 55%, ${OCEAN.deep} 100%); padding: 22px 28px;">
                <span style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">OCCAZ</span>
                <br />
                <span style="font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.75);">Transport Partagé</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 18px; font-weight: 700; color: #1a1a1a; padding-bottom: 10px;">
                      ${escapeHtml(title)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; line-height: 22px; color: #4a4a4a;">
                      ${textToHtml(body)}
                    </td>
                  </tr>
                  ${button}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 28px; background-color: ${OCEAN.mist}; border-top: 1px solid ${OCEAN.line};">
                <span style="font-size: 11px; color: #6b7a85;">
                  Cet email a été envoyé automatiquement par OCCAZ — merci de ne pas y répondre.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}