// backend/src/app-config/app-config.service.ts
// [19/10/2026] v1 — Réglages publics lus par l'application mobile au démarrage : version minimale exigée (mise à jour forcée) et liens des
// boutiques. Tout vient de la table des réglages (page « Paramètres » du back-office) : on peut exiger une mise à jour du jour au
// lendemain, sans republier l'application ni redéployer le serveur.
//   app.min_version        « 1.4.0 » : en dessous, l'application affiche un écran « mise à jour requise ». « 0.0.0 » ou vide = aucune exigence.
//   app.update_url_android lien Google Play de l'application
//   app.update_url_ios     lien App Store de l'application
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isSmsPurposeAllowed, SmsPurpose } from '../integrations/sms/sms-purpose';

export const APP_MIN_VERSION_KEY = 'app.min_version';
export const APP_UPDATE_URL_ANDROID_KEY = 'app.update_url_android';
export const APP_UPDATE_URL_IOS_KEY = 'app.update_url_ios';

export interface PublicAppConfig {
  /** Version minimale exigée, au format « 1.4.0 » ; « 0.0.0 » = aucune exigence. */
  minVersion: string;
  updateUrlAndroid: string | null;
  updateUrlIos: string | null;
  /** Fonctions qui dépendent d'un SMS (coûteux, fermé par défaut — voir sms-purpose.ts) : l'application adapte ses textes. */
  features: {
    /** Les proches d'un conducteur ou d'un client reçoivent un SMS lors d'une alerte SOS. */
    sosSms: boolean;
    /** Le changement de numéro par code SMS est ouvert. */
    phoneChange: boolean;
  };
}

/** Garde seulement une version de la forme 1, 1.2 ou 1.2.3 ; tout le reste (texte libre, injection) devient « 0.0.0 ». */
export function sanitizeVersion(value: unknown): string {
  return typeof value === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(value.trim()) ? value.trim() : '0.0.0';
}

/** N'accepte que des liens https:// (jamais javascript: ou autre schéma). */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https:\/\/[^\s]{3,500}$/.test(trimmed) ? trimmed : null;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(): Promise<PublicAppConfig> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: [APP_MIN_VERSION_KEY, APP_UPDATE_URL_ANDROID_KEY, APP_UPDATE_URL_IOS_KEY] } },
      select: { key: true, value: true },
    });
    const read = (key: string) => rows.find((row) => row.key === key)?.value;
    return {
      minVersion: sanitizeVersion(read(APP_MIN_VERSION_KEY)),
      updateUrlAndroid: sanitizeUrl(read(APP_UPDATE_URL_ANDROID_KEY)),
      updateUrlIos: sanitizeUrl(read(APP_UPDATE_URL_IOS_KEY)),
      features: {
        sosSms: isSmsPurposeAllowed(SmsPurpose.SOS),
        phoneChange: isSmsPurposeAllowed(SmsPurpose.PHONE_CHANGE),
      },
    };
  }
}
