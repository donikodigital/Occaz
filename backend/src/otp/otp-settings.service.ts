// backend/src/otp/otp-settings.service.ts
//
// Réglages des SMS (codes de connexion, de remise, changement de numéro, plafond des SMS de notification), modifiables depuis l'administration
// (Paramètres → « Connexion et SMS », table PlatformSetting) sans redéployer.
//
// Ordre de lecture pour chaque réglage :
//   1. la valeur enregistrée par l'équipe dans l'administration ;
//   2. à défaut, la variable d'environnement historique (OTP_EXPIRY_SECONDS, OTP_REQUEST_LIMIT…) ;
//   3. à défaut, la valeur par défaut ci-dessous.
// Une valeur enregistrée mais invalide (texte à la place d'un nombre, nombre négatif…) est ignorée : on retombe sur 2 puis 3,
// jamais sur une valeur qui désactiverait une protection par erreur.
//
// Aucun cache : un réglage modifié s'applique à la demande suivante, et une lecture de 9 lignes indexées est négligeable
// face à l'envoi d'un SMS.
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const OTP_SETTING_KEYS = {
  expirySeconds: 'otp.expiry_seconds',
  maxAttempts: 'otp.max_attempts',
  requestLimit: 'otp.request_limit',
  requestWindowMinutes: 'otp.request_window_minutes',
  dailyLimitPerPhone: 'otp.daily_limit_per_phone',
  dailyLimitGlobal: 'otp.daily_limit_global',
  handoverSmsDailyLimit: 'otp.handover_sms_daily_limit',
  allowedPhonePrefixes: 'otp.allowed_phone_prefixes',
  phoneChangeCooldownDays: 'auth.phone_change_cooldown_days',
  notificationSmsDailyLimitPerUser: 'sms.notification_daily_limit_per_user',
} as const;

export interface OtpSettings {
  /** Durée de validité d'un code, en secondes. */
  expirySeconds: number;
  /** Essais autorisés par code avant blocage. */
  maxAttempts: number;
  /** Demandes de code autorisées par numéro dans la fenêtre ci-dessous. */
  requestLimit: number;
  requestWindowMinutes: number;
  /** Codes de connexion par numéro et par période de 24 h (0 = illimité). */
  dailyLimitPerPhone: number;
  /** Codes de connexion pour toute la plateforme et par période de 24 h (0 = illimité). */
  dailyLimitGlobal: number;
  /** SMS de remise (prise en charge, dépose, colis) par réservation ou par envoi, pour chaque étape (prise en charge, dépose…) et par période de 24 h (0 = illimité). */
  handoverSmsDailyLimit: number;
  /** Indicatifs acceptés (ex. « +224 »). Liste vide = tous les pays. */
  allowedPhonePrefixes: string[];
  /** Délai entre deux changements de numéro, en jours (0 = aucun délai). */
  phoneChangeCooldownDays: number;
  /** SMS de notification (paiement confirmé, litige…) par utilisateur et par période de 24 h (0 = illimité). Les notifications push ne sont pas concernées. */
  notificationSmsDailyLimitPerUser: number;
}

interface NumericSpec {
  setting: keyof Omit<OtpSettings, 'allowedPhonePrefixes'>;
  env: string;
  fallback: number;
  min: number;
}

const NUMERIC_SPECS: NumericSpec[] = [
  { setting: 'expirySeconds', env: 'OTP_EXPIRY_SECONDS', fallback: 300, min: 30 },
  { setting: 'maxAttempts', env: 'OTP_MAX_ATTEMPTS', fallback: 3, min: 1 },
  { setting: 'requestLimit', env: 'OTP_REQUEST_LIMIT', fallback: 5, min: 1 },
  { setting: 'requestWindowMinutes', env: 'OTP_REQUEST_WINDOW_MINUTES', fallback: 15, min: 1 },
  { setting: 'dailyLimitPerPhone', env: 'OTP_DAILY_LIMIT_PER_PHONE', fallback: 10, min: 0 },
  { setting: 'dailyLimitGlobal', env: 'OTP_DAILY_LIMIT_GLOBAL', fallback: 2000, min: 0 },
  { setting: 'handoverSmsDailyLimit', env: 'OTP_HANDOVER_SMS_DAILY_LIMIT', fallback: 5, min: 0 },
  { setting: 'phoneChangeCooldownDays', env: 'PHONE_CHANGE_COOLDOWN_DAYS', fallback: 30, min: 0 },
  { setting: 'notificationSmsDailyLimitPerUser', env: 'SMS_NOTIFICATION_DAILY_LIMIT_PER_USER', fallback: 10, min: 0 },
];

const PREFIXES_ENV = 'OTP_ALLOWED_PHONE_PREFIXES';

/** Un indicatif valide : « + » puis 1 à 8 chiffres (« +224 », « +22462 » pour un opérateur). */
const PREFIX_PATTERN = /^\+\d{1,8}$/;

/**
 * « +224, 33 ; +221 » → ['+224', '+33', '+221']. Les espaces sont ignorés, le « + » est ajouté s'il manque, les entrées
 * invalides et les doublons sont écartés. « * » (ou texte vide) = tous les pays → liste vide.
 */
export function parsePhonePrefixes(raw: string): string[] {
  const result: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const entry = part.trim();
    if (!entry || entry === '*') continue;
    const prefix = entry.startsWith('+') ? entry : `+${entry}`;
    if (PREFIX_PATTERN.test(prefix) && !result.includes(prefix)) result.push(prefix);
  }
  return result;
}

/** Liste vide = aucun filtre. Le numéro est comparé sans espace. */
export function isPhoneAllowed(phone: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return true;
  const normalized = phone.replace(/\s+/g, '');
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

function fromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

@Injectable()
export class OtpSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<OtpSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(OTP_SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    const stored = (key: string): unknown => rows.find((row) => row.key === key)?.value;

    const result: Record<string, number> = {};
    for (const spec of NUMERIC_SPECS) {
      const fromAdmin = stored(OTP_SETTING_KEYS[spec.setting]);
      const candidates = [typeof fromAdmin === 'number' ? fromAdmin : undefined, fromEnv(spec.env)];
      const valid = candidates.find((value) => value !== undefined && Number.isFinite(value) && value >= spec.min);
      result[spec.setting] = Math.floor(valid ?? spec.fallback);
    }

    const prefixesFromAdmin = stored(OTP_SETTING_KEYS.allowedPhonePrefixes);
    const prefixes = parsePhonePrefixes(
      typeof prefixesFromAdmin === 'string' ? prefixesFromAdmin : (process.env[PREFIXES_ENV] ?? ''),
    );

    return { ...(result as Omit<OtpSettings, 'allowedPhonePrefixes'>), allowedPhonePrefixes: prefixes };
  }

  /** Refuse un numéro dont l'indicatif n'est pas dans la liste autorisée (liste vide = tout est accepté). */
  assertPhoneAllowed(phone: string, settings: OtpSettings): void {
    if (isPhoneAllowed(phone, settings.allowedPhonePrefixes)) return;
    const accepted = settings.allowedPhonePrefixes.join(', ');
    throw new BadRequestException(
      `Ce numéro n'est pas pris en charge pour le moment. Seuls les numéros commençant par ${accepted} sont acceptés.`,
    );
  }
}
