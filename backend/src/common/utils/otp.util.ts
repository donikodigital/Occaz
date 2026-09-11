// backend/src/common/utils/otp.util.ts
import { createHash, randomInt } from 'crypto';

/**
 * OTP à 6 chiffres. Seul le hash est jamais persisté (OtpCode.code) —
 * conformément à la règle d'or du cahier des charges : le code n'est
 * jamais lisible ni régénérable côté chauffeur/serveur applicatif, seul
 * le service qui l'a émis peut le vérifier par comparaison de hash.
 */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function verifyOtpCode(code: string, hash: string): boolean {
  return hashOtpCode(code) === hash;
}
