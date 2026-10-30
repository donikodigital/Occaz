// backend/src/integrations/translating-providers.ts
// [30/10/2026] v1 — Traduit le texte des SMS, e-mails et notifications push dans la langue de leur destinataire juste avant l'envoi
// (voir i18n/language-context.ts). Le texte reste écrit en français dans le code ; un texte sans traduction part en français.
// L'envoi lui-même s'exécute dans la même langue : le gabarit d'e-mail traduit ainsi ses phrases fixes (pied de page…).
import { currentLanguage, runWithLanguage } from '../i18n/language-context';
import { translateText } from '../i18n/server-text';
import type { EmailAction, EmailAttachment, EmailProvider } from './email/email-provider.interface';
import type { PushOptions, PushProvider } from './push/push-provider.interface';
import type { SmsProvider } from './sms/sms-provider.interface';
import type { SmsPurpose } from './sms/sms-purpose';

export class TranslatingSmsProvider implements SmsProvider {
  constructor(private readonly inner: SmsProvider) {}

  send(toPhone: string, message: string, purpose?: SmsPurpose): Promise<void> {
    const language = currentLanguage();
    return runWithLanguage(language, () => this.inner.send(toPhone, translateText(message, language), purpose));
  }
}

export class TranslatingEmailProvider implements EmailProvider {
  constructor(private readonly inner: EmailProvider) {}

  send(toEmail: string, subject: string, body: string, action?: EmailAction, attachments?: EmailAttachment[]): Promise<void> {
    const language = currentLanguage();
    return runWithLanguage(language, () =>
      this.inner.send(
        toEmail,
        translateText(subject, language),
        translateText(body, language),
        action ? { ...action, label: translateText(action.label, language) } : undefined,
        attachments,
      ),
    );
  }
}

export class TranslatingPushProvider implements PushProvider {
  constructor(private readonly inner: PushProvider) {}

  send(pushTokens: string[], title: string, body: string, data?: Record<string, unknown>, options?: PushOptions): Promise<void> {
    const language = currentLanguage();
    return this.inner.send(pushTokens, translateText(title, language), translateText(body, language), data, options);
  }
}
