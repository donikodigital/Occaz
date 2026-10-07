// backend/src/common/utils/otp.util.ts
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/**
 * OTP à 6 chiffres. Seul le hash est jamais persisté (OtpCode.code) —
 * conformément à la règle d'or du cahier des charges : le code n'est
 * jamais lisible ni régénérable côté conducteur/serveur applicatif, seul
 * le service qui l'a émis peut le vérifier par comparaison de hash.
 */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Hash du code : HMAC-SHA256 avec le secret OTP_HASH_PEPPER (obligatoire au
 * démarrage, voir env.validation.ts). Un code à 6 chiffres n'a que 1 000 000
 * de valeurs : avec un simple SHA-256 sans secret, quiconque lit la base
 * retrouve n'importe quel code en une fraction de seconde. Avec le secret, le
 * hash seul ne suffit plus.
 *
 * Le secret est lu à chaque appel (et non figé au chargement du module) : il
 * est ainsi toujours celui de l'environnement courant, tests compris.
 */
export function hashOtpCode(code: string): string {
  return createHmac('sha256', process.env.OTP_HASH_PEPPER ?? '')
    .update(code)
    .digest('hex');
}

/** Comparaison à temps constant : la durée du calcul ne révèle rien sur le hash attendu. */
export function verifyOtpCode(code: string, hash: string): boolean {
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(hashOtpCode(code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Numéro masqué pour les journaux : « +224620000001 » → « +224•••0001 ». Un numéro n'a rien à faire en clair dans un log. */
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return '•••';
  return `${phone.slice(0, 4)}•••${phone.slice(-4)}`;
}
