// backend/src/i18n/language.spec.ts
// Quelle langue pour quelle requête : paramètre ?lang=, en-tête de l'application, compte connecté, français.
import { parseLanguage, languageFromRequest } from './language';
import { currentLanguage, runWithLanguage, intlLocale } from './language-context';
import { LanguageInterceptor } from './language.interceptor';
import { lastValueFrom, of } from 'rxjs';

describe('parseLanguage', () => {
  it.each([
    ['fr', 'fr'],
    ['fr-FR', 'fr'],
    ['en', 'en-GB'],
    ['en-US', 'en-GB'],
    ['en_GB', 'en-GB'],
    ['pt', 'pt-PT'],
    ['pt-BR', 'pt-PT'],
    ['PT-pt', 'pt-PT'],
    ['pt-PT,fr;q=0.8', 'pt-PT'],
  ])('%s → %s', (input, expected) => {
    expect(parseLanguage(input)).toBe(expected);
  });

  it.each([[undefined], [null], [42], [''], ['de'], ['zz-ZZ']])('%p → inconnue', (input) => {
    expect(parseLanguage(input)).toBeNull();
  });
});

describe('languageFromRequest', () => {
  it('?lang= avant l\'en-tête, l\'en-tête avant le compte, le compte avant le français', () => {
    expect(languageFromRequest({ headers: { 'x-app-language': 'en-GB' }, query: { lang: 'pt' }, user: { language: 'fr' } })).toBe('pt-PT');
    expect(languageFromRequest({ headers: { 'x-app-language': 'en-GB' }, user: { language: 'pt-PT' } })).toBe('en-GB');
    expect(languageFromRequest({ headers: {}, user: { language: 'pt-PT' } })).toBe('pt-PT');
    expect(languageFromRequest({ headers: {} })).toBe('fr');
  });

  it('Accept-Language est ignoré : le back-office d\'un poste en anglais reste en français', () => {
    expect(languageFromRequest({ headers: { 'accept-language': 'en-US,en;q=0.9' } })).toBe('fr');
  });

  it('un en-tête répété ou invalide ne casse rien', () => {
    expect(languageFromRequest({ headers: { 'x-app-language': ['pt', 'en'] as never } })).toBe('pt-PT');
    expect(languageFromRequest({ headers: { 'x-app-language': 'klingon' }, user: { language: 'en-GB' } })).toBe('en-GB');
  });
});

describe('contexte de langue', () => {
  it('français hors contexte, langue du destinataire à l\'intérieur — même après un await', async () => {
    expect(currentLanguage()).toBe('fr');
    await runWithLanguage('pt-PT', async () => {
      await Promise.resolve();
      expect(currentLanguage()).toBe('pt-PT');
      await runWithLanguage('en-GB', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(currentLanguage()).toBe('en-GB');
      });
      expect(currentLanguage()).toBe('pt-PT');
    });
    expect(currentLanguage()).toBe('fr');
  });

  it('une langue inconnue retombe sur le français', () => {
    runWithLanguage('klingon', () => expect(currentLanguage()).toBe('fr'));
    runWithLanguage(null, () => expect(currentLanguage()).toBe('fr'));
  });

  it('deux requêtes en parallèle ne se mélangent pas', async () => {
    const run = (language: string, delay: number) =>
      runWithLanguage(language, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return currentLanguage();
      });
    expect(await Promise.all([run('en-GB', 5), run('pt-PT', 1), run('fr', 3)])).toEqual(['en-GB', 'pt-PT', 'fr']);
  });

  it('code de langue pour les dates et nombres', () => {
    expect(intlLocale('fr')).toBe('fr-FR');
    expect(intlLocale('en-GB')).toBe('en-GB');
    runWithLanguage('pt-PT', () => expect(intlLocale()).toBe('pt-PT'));
  });
});

describe('LanguageInterceptor', () => {
  const context = (request: unknown, type = 'http') => ({ getType: () => type, switchToHttp: () => ({ getRequest: () => request }) }) as never;

  it('la route s\'exécute dans la langue de la requête', async () => {
    const seen: string[] = [];
    const next = { handle: () => of(null).pipe() };
    const handler = {
      handle: () => {
        seen.push(currentLanguage());
        return next.handle();
      },
    };
    await lastValueFrom(new LanguageInterceptor().intercept(context({ headers: { 'x-app-language': 'en-GB' } }), handler));
    await lastValueFrom(new LanguageInterceptor().intercept(context({ headers: {}, user: { language: 'pt-PT' } }), handler));
    await lastValueFrom(new LanguageInterceptor().intercept(context({ headers: {}, query: { lang: 'pt' } }), handler));
    expect(seen).toEqual(['en-GB', 'pt-PT', 'pt-PT']);
  });

  it('hors HTTP, rien ne change', async () => {
    const seen: string[] = [];
    const handler = { handle: () => { seen.push(currentLanguage()); return of(1); } };
    await lastValueFrom(new LanguageInterceptor().intercept(context({}, 'rpc'), handler));
    expect(seen).toEqual(['fr']);
  });
});
