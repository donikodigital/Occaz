// backend/src/integrations/sms/routing-sms.provider.ts
// [18/10/2026] v1 — Choisit le fournisseur SMS selon l'indicatif du numéro : la Guinée (+224) passe par Orange (une fraction du prix d'un
// agrégateur international), tous les autres pays par le fournisseur international (Infobip, TextBee…).
import { Injectable } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

export interface SmsRoute {
  /** Indicatif avec « + », par exemple « +224 ». */
  prefix: string;
  provider: SmsProvider;
}

/** Garde uniquement « + » et les chiffres : « +224 622-34-32-34 » -> « +224622343234 ». Le préfixe « 00 » devient « + ». */
export function toE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
}

@Injectable()
export class CountryRoutingSmsProvider implements SmsProvider {
  constructor(
    private readonly routes: SmsRoute[],
    private readonly fallback: SmsProvider,
  ) {}

  /** Le fournisseur qui enverra à ce numéro (exposé pour les tests). */
  providerFor(phone: string): SmsProvider {
    const number = toE164(phone);
    return this.routes.find((route) => number.startsWith(route.prefix))?.provider ?? this.fallback;
  }

  send(toPhone: string, message: string): Promise<void> {
    return this.providerFor(toPhone).send(toPhone, message);
  }
}
