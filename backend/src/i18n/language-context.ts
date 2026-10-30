// backend/src/i18n/language-context.ts
// [30/10/2026] v1 — « Dans quelle langue écrire ? » disponible partout sans la passer de fonction en fonction.
//
// Pendant une requête, la langue est celle de l'application (en-tête X-App-Language) ou, à défaut, celle du compte connecté : voir
// LanguageInterceptor. Les canaux d'envoi (SMS, e-mail, push) et les PDF traduisent leurs textes dans cette langue. Quand le texte
// est destiné à QUELQU'UN D'AUTRE que la personne qui fait la requête (notification à un conducteur déclenchée par un client), l'appelant
// fixe la langue du destinataire avec runWithLanguage. Hors requête (tâches planifiées), c'est le français, sauf si l'appelant la fixe.
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppLanguage, DEFAULT_LANGUAGE, parseLanguage } from './language';

interface LanguageStore {
  language: AppLanguage;
}

const storage = new AsyncLocalStorage<LanguageStore>();

/** Exécute `work` en écrivant dans `language` (le destinataire du texte). */
export function runWithLanguage<T>(language: AppLanguage | string | null | undefined, work: () => T): T {
  return storage.run({ language: parseLanguage(language) ?? DEFAULT_LANGUAGE }, work);
}

/** Langue dans laquelle écrire en ce moment (français hors contexte). */
export function currentLanguage(): AppLanguage {
  return storage.getStore()?.language ?? DEFAULT_LANGUAGE;
}

/** Code de langue pour Intl (dates, nombres) : « fr-FR », « en-GB » ou « pt-PT ». */
export function intlLocale(language: AppLanguage = currentLanguage()): string {
  return language === 'fr' ? 'fr-FR' : language;
}
