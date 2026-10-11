// backend/src/common/utils/mask.util.ts
/** « thierno@gmail.com » → « t•••o@gmail.com » : montre à la personne où part le code sans exposer l'adresse entière. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '•••';
  if (local.length <= 2) return `${local.charAt(0)}•••@${domain}`;
  return `${local.charAt(0)}•••${local.charAt(local.length - 1)}@${domain}`;
}
