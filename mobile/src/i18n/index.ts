// mobile/src/i18n/index.ts
// [28/10/2026] v1 — Langues de l'app : français (par défaut), anglais (Royaume-Uni) et portugais (Portugal).
//
// Principe : le TEXTE FRANÇAIS D'ORIGINE sert de clé. En français, t('Connexion') renvoie exactement 'Connexion' — l'app française ne peut
// donc pas changer. En anglais / portugais, t() cherche la clé dans le dictionnaire (locales/en-GB.ts, locales/pt-PT.ts) et retombe sur
// le français si elle n'y est pas (jamais de texte vide ni de clé technique affichée).
//
//  - Dans un composant ou un hook : `const t = useT();` (le composant se redessine quand la langue change).
//  - Hors composant (fonction utilitaire appelée pendant un rendu) : `translate('…')`.
//  - Valeurs à insérer : t('Bonjour {name}', { name }).
//  - Singulier / pluriel : t.n(count, '{count} place', '{count} places').
//  - Constante de module (évaluée une seule fois, avant le choix de la langue) : écrire la valeur sous forme de getter (voir
//    utils/tripStatusLabels.ts) ou traduire à l'affichage ; N_('…') sert seulement à marquer un texte à traduire plus tard.
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { en } from './locales/en-GB';
import { pt } from './locales/pt-PT';

export type Language = 'fr' | 'en-GB' | 'pt-PT';

export const DEFAULT_LANGUAGE: Language = 'fr';

export interface LanguageOption {
  code: Language;
  /** Nom de la langue, toujours écrit dans cette langue (jamais traduit : chacun doit pouvoir la reconnaître). */
  label: string;
  /** Code pays ISO du drapeau affiché (utils/phone.ts → flagEmoji). */
  flagIso: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'fr', label: 'Français', flagIso: 'FR' },
  { code: 'en-GB', label: 'English (United Kingdom)', flagIso: 'GB' },
  { code: 'pt-PT', label: 'Português (Portugal)', flagIso: 'PT' },
];

export type TranslationParams = Record<string, string | number | null | undefined>;
export type Dictionary = Record<string, string>;

const STORAGE_KEY = 'appLanguage';

const DICTIONARIES: Record<Exclude<Language, 'fr'>, Dictionary> = {
  'en-GB': en,
  'pt-PT': pt,
};

function isLanguage(value: unknown): value is Language {
  return value === 'fr' || value === 'en-GB' || value === 'pt-PT';
}

// ---------------------------------------------------------------------------
// Langue choisie (mémorisée sur l'appareil, lue avant le premier écran)
// ---------------------------------------------------------------------------

interface LanguageState {
  language: Language;
  /** Faux tant que le choix mémorisé n'a pas été lu : l'app attend pour ne pas afficher un éclair de français. */
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  isHydrated: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) set({ language: stored });
    } catch {
      // Lecture impossible : on reste en français, l'app démarre quand même.
    } finally {
      set({ isHydrated: true });
    }
  },
  setLanguage: (language) => {
    set({ language });
    AsyncStorage.setItem(STORAGE_KEY, language).catch(() => undefined);
  },
}));

// ---------------------------------------------------------------------------
// Traduction
// ---------------------------------------------------------------------------

const warnedMissing = new Set<string>();

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function lookup(language: Language, key: string): string {
  if (language === 'fr') return key;
  const translated = DICTIONARIES[language][key];
  if (translated !== undefined) return translated;
  if (__DEV__ && !warnedMissing.has(`${language}|${key}`)) {
    warnedMissing.add(`${language}|${key}`);
    console.warn(`[i18n] Traduction ${language} manquante : « ${key} »`);
  }
  return key;
}

function translateFor(language: Language, key: string, params?: TranslationParams): string {
  return interpolate(lookup(language, key), params);
}

/**
 * Forme à utiliser selon le nombre. En français tout ce qui n'est pas « > 1 » est au singulier (« 0 place », « 1 place » — comme avant) ;
 * en anglais comme en portugais seul 1 l'est (« 0 seats », « 0 lugares »).
 */
function pluralKey(language: Language, count: number, one: string, other: string): string {
  const isOne = language === 'fr' ? !(count > 1) : count === 1;
  return isOne ? one : other;
}

export interface TFunction {
  (key: string, params?: TranslationParams): string;
  /** t.n(3, '{count} place', '{count} places') — `{count}` est remplacé par le nombre. */
  n: (count: number, one: string, other: string, params?: TranslationParams) => string;
}

function makeT(language: Language): TFunction {
  const t = ((key: string, params?: TranslationParams) => translateFor(language, key, params)) as TFunction;
  t.n = (count, one, other, params) => translateFor(language, pluralKey(language, count, one, other), { count, ...params });
  return t;
}

/** Fonction de traduction liée à la langue courante ; le composant qui l'appelle se redessine quand la langue change. */
export function useT(): TFunction {
  const language = useLanguageStore((state) => state.language);
  return useMemo(() => makeT(language), [language]);
}

/** Langue courante (pour un composant qui doit simplement se redessiner quand elle change). */
export function useLanguage(): Language {
  return useLanguageStore((state) => state.language);
}

/** Même chose que t(), hors composant : lit la langue courante au moment de l'appel (à appeler pendant un rendu, jamais à l'import). */
export function translate(key: string, params?: TranslationParams): string {
  return translateFor(useLanguageStore.getState().language, key, params);
}

export function translateN(count: number, one: string, other: string, params?: TranslationParams): string {
  const language = useLanguageStore.getState().language;
  return translateFor(language, pluralKey(language, count, one, other), { count, ...params });
}

/** Marque un texte à traduire plus tard (constante de module) : renvoie le texte tel quel. */
export function N_(text: string): string {
  return text;
}

/** Locale Intl de la langue courante — dates, heures et nombres suivent la langue choisie. */
export function intlLocale(): 'fr-FR' | 'en-GB' | 'pt-PT' {
  const language = useLanguageStore.getState().language;
  return language === 'fr' ? 'fr-FR' : language;
}
