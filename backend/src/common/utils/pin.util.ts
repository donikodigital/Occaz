// backend/src/common/utils/pin.util.ts
//
// Mot de passe des clients et des conducteurs : exactement 6 chiffres.
//
// Un code à 6 chiffres n'a que 1 000 000 de valeurs : deux protections le rendent acceptable.
//  1. Le verrouillage temporaire après plusieurs erreurs (voir AccountAuthService) : on ne peut pas les essayer toutes en ligne.
//  2. Un secret serveur (OTP_HASH_PEPPER) entre dans l'empreinte avant bcrypt : si la base fuit seule, les mots de passe ne
//     peuvent pas être retrouvés hors ligne en un instant.
// On refuse en plus les codes les plus devinables (000000, 123456, 121212…).
import { createHmac } from 'crypto';

export const PIN_LENGTH = 6;
const PIN_PATTERN = /^\d{6}$/;

export function isPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_PATTERN.test(pin);
}

/** Message à montrer quand le code est trop facile à deviner, `null` s'il est acceptable. */
export function pinWeakness(pin: string): string | null {
  const digits = pin.split('').map(Number);

  const allSame = digits.every((digit) => digit === digits[0]);
  const steps = digits.slice(1).map((digit, index) => digit - digits[index]!);
  const ascending = steps.every((step) => step === 1);
  const descending = steps.every((step) => step === -1);
  // 121212, 123123 : une courte séquence répétée.
  const repeatsTwo = pin.slice(0, 2).repeat(3) === pin;
  const repeatsThree = pin.slice(0, 3).repeat(2) === pin;

  if (allSame || ascending || descending || repeatsTwo || repeatsThree) {
    return 'Ce code est trop facile à deviner (par exemple 123456 ou 111111). Choisissez-en un autre.';
  }
  return null;
}

/** Empreinte salée par le secret serveur, à passer ensuite à bcrypt. Jamais stockée telle quelle. */
export function pinDigest(pin: string): string {
  return createHmac('sha256', process.env.OTP_HASH_PEPPER ?? '')
    .update(`pin:${pin}`)
    .digest('hex');
}
