// backend/src/common/utils/test-mode.util.ts
//
// Mode test — désactivé par défaut, à n'activer QUE le temps des essais (jamais avec de vrais utilisateurs sur le site public).
// Il ne concerne que les numéros listés dans AUTH_TEST_PHONE_NUMBERS : tout autre numéro suit le parcours normal, sans exception.
// Pour un numéro de test : aucun SMS ni e-mail n'est envoyé, tous les codes valent 000000, et 000000 ouvre aussi la connexion
// par mot de passe (le compte n'a pas besoin d'en avoir un).

/** Code unique des numéros de test, pour les codes reçus comme pour le mot de passe. */
export const TEST_CODE = '000000';

export function isTestPhone(phone: string | null | undefined): boolean {
  if (!phone || process.env.AUTH_TEST_MODE_ENABLED !== 'true') return false;
  const testPhones = (process.env.AUTH_TEST_PHONE_NUMBERS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return testPhones.includes(phone);
}
