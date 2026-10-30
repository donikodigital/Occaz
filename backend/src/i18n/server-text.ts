// backend/src/i18n/server-text.ts
// [30/10/2026] v1 — Traduction des textes écrits par le serveur (messages d'erreur, notifications, SMS, e-mails, PDF).
//
// Même principe que l'application : le TEXTE FRANÇAIS D'ORIGINE sert de clé, et le français n'est jamais modifié. Un texte à valeurs
// variables s'écrit avec des trous numérotés dans l'ordre où ils apparaissent dans le code : « Le véhicule ne dispose que de {0}
// places. ». On reconnaît le modèle dans le texte final, on garde les valeurs (nombres, villes, noms…) et on traduit le reste ; la
// traduction peut changer l'ordre des trous (« {1} … {0} »). Un texte inconnu reste en français : jamais de texte vide ni d'erreur.
//
// POUR TRADUIRE UN NOUVEAU TEXTE DU SERVEUR : ajouter une ligne [français, anglais, portugais] dans le fichier de src/i18n/texts/ du
// domaine concerné (voir texts/index.ts). Un test vérifie que les trous sont les mêmes dans les trois langues.
import { AppLanguage } from './language';
import { tryTranslateNotificationText } from './notification-text';
import { TEXTS } from './texts';

type Target = Exclude<AppLanguage, 'fr'>;
const INDEX: Record<Target, 1 | 2> = { 'en-GB': 1, 'pt-PT': 2 };

/** Apostrophes courbes et espaces insécables (nombres français) ramenés à la forme simple, pour comparer sans se soucier de la typographie. */
const norm = (value: string): string => value.replace(/[’‘]/g, "'").replace(/[  ]/g, ' ');

interface Pattern {
  prefix: string;
  regex: RegExp;
  holes: number[];
  template: string;
  /** Nombre de caractères fixes : les modèles les plus précis passent d'abord. */
  weight: number;
}

interface Compiled {
  exact: Map<string, string>;
  patterns: Pattern[];
}

/** Trou d'un modèle traduit : {0}. Dans le texte français d'origine, {#0} est un trou qui n'accepte que des chiffres (« {#0} colis »). */
const HOLE = /\{(\d+)\}/g;
const SOURCE_HOLE = /\{(#?)(\d+)\}/g;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(language: Target): Compiled {
  const column = INDEX[language];
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const row of TEXTS) {
    const source = norm(row[0]);
    const target = row[column];
    if (!target) continue;
    if (!/\{#?\d+\}/.test(source)) {
      exact.set(source, target);
      continue;
    }
    const holes: number[] = [];
    let literal = 0;
    let last = 0;
    let body = '';
    for (const match of source.matchAll(SOURCE_HOLE)) {
      const before = source.slice(last, match.index);
      literal += before.length;
      body += escapeRegex(before) + (match[1] ? '(\\d+)' : '(.*?)');
      holes.push(Number(match[2]));
      last = (match.index ?? 0) + match[0].length;
    }
    const tail = source.slice(last);
    literal += tail.length;
    body += escapeRegex(tail);
    patterns.push({
      prefix: source.slice(0, source.search(/\{#?\d+\}/)),
      regex: new RegExp(`^${body}$`, 's'),
      holes,
      template: target,
      weight: literal,
    });
  }
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, patterns };
}

const cache = new Map<Target, Compiled>();
function compiled(language: Target): Compiled {
  let entry = cache.get(language);
  if (!entry) {
    entry = compile(language);
    cache.set(language, entry);
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Valeurs qui changent d'un texte à l'autre : recomposées dans la langue choisie
// ---------------------------------------------------------------------------

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS: Record<Target, string[]> = {
  'en-GB': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  'pt-PT': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};

const FR_WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const WEEKDAYS: Record<Target, string[]> = {
  'en-GB': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  'pt-PT': ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'],
};
const DAY_WORDS: Record<Target, Record<string, string>> = {
  'en-GB': { "aujourd'hui": 'today', demain: 'tomorrow' },
  'pt-PT': { "aujourd'hui": 'hoje', demain: 'amanhã' },
};

/**
 * Valeurs recomposées dans la langue choisie : « mardi 12 octobre 2026 » → « Tuesday 12 October 2026 » / « terça-feira, 12 de outubro de 2026 » ;
 * « 14 h 30 » → « 14:30 » ; « demain à 14:30 » → « tomorrow at 14:30 » ; « le 12 octobre » → « on 12 October ». Le reste est gardé tel quel.
 */
export function localizeValue(value: string, language: Target): string {
  let result = value.replace(/\b(\d{1,2}) h (\d{2})\b/g, (_m, h: string, m: string) => `${h.padStart(2, '0')}:${m}`);
  result = result.replace(
    /\b(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) )?(\d{1,2})(?:er)? (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)( \d{4})?/gi,
    (_m, weekday: string | undefined, day: string, month: string, year?: string) => {
      const name = MONTHS[language][FR_MONTHS.indexOf(month.toLowerCase())];
      const dayName = weekday ? WEEKDAYS[language][FR_WEEKDAYS.indexOf(weekday.toLowerCase())] : '';
      if (language === 'pt-PT') return `${dayName ? `${dayName}, ` : ''}${day} de ${name}${year ? ` de ${year.trim()}` : ''}`;
      return `${dayName ? `${dayName} ` : ''}${day} ${name}${year ?? ''}`;
    },
  );
  const dayWords = DAY_WORDS[language];
  result = result.replace(/^(aujourd['’]hui|demain)(?= à \d|$)/i, (word) => dayWords[word.toLowerCase().replace('’', "'")] ?? word);
  result = result.replace(/^le (?=\d)/, language === 'pt-PT' ? 'no dia ' : 'on ');
  result = result.replace(/(^|\s)à (\d{1,2}:\d{2})$/, (_m, lead: string, clock: string) => `${lead}${language === 'pt-PT' ? 'às' : 'at'} ${clock}`);
  return result;
}

function fill(template: string, values: string[], holes: number[], language: Target): string {
  const filled = template.replace(HOLE, (match, index: string) => {
    const position = holes.indexOf(Number(index));
    if (position < 0) return match;
    return translateValue(values[position] ?? '', language);
  });
  // Portugais : « a » + « a próxima paragem » (valeur traduite) se contracte en « à próxima paragem ».
  return language === 'pt-PT' ? filled.replace(/\ba a (?=\p{L})/gu, 'à ') : filled;
}

/** « photo de profil, permis de conduire et carte grise du véhicule » : une liste dont chaque élément est un morceau de français connu. */
function translateList(value: string, language: Target): string | null {
  if (!/, | et /.test(value)) return null;
  const items = value.split(/, | et /).map((item) => translateWhole(item.trim(), language, false));
  if (items.some((item) => item === null)) return null;
  const translated = items as string[];
  const and = language === 'pt-PT' ? ' e ' : ' and ';
  return `${translated.slice(0, -1).join(', ')}${and}${translated[translated.length - 1]}`;
}

/**
 * Valeur d'un trou : date et heure recomposées, ou morceau de français connu (« votre colis », « Conducteur », « dans 3 jours »…) traduit à son
 * tour. Un nom, une ville ou un montant n'est jamais dans la table : il reste tel quel.
 */
function translateValue(value: string, language: Target): string {
  const local = localizeValue(value, language);
  return translateWhole(local, language, false) ?? translateWhole(value, language, false) ?? translateList(value, language) ?? local;
}

function translateWhole(text: string, language: Target, withNotifications = true): string | null {
  const { exact, patterns } = compiled(language);
  const key = norm(text);
  const direct = exact.get(key);
  if (direct !== undefined) return direct;
  for (const pattern of patterns) {
    if (!key.startsWith(pattern.prefix)) continue;
    const match = pattern.regex.exec(key);
    if (match) return fill(pattern.template, match.slice(1), pattern.holes, language);
  }
  // Titres et corps de notification (modèles partagés avec l'application).
  return withNotifications ? tryTranslateNotificationText(text, language) : null;
}

/**
 * Texte du serveur dans la langue demandée. Un message fabriqué en plusieurs phrases (« A. B. ») dont aucun modèle ne couvre
 * l'ensemble est traduit phrase par phrase ; les phrases inconnues restent en français.
 */
export function translateText(text: string, language: AppLanguage): string {
  if (language === 'fr' || !text) return text;
  const whole = translateWhole(text, language);
  if (whole !== null) return whole;

  // Texte écrit sur plusieurs lignes (e-mail) : chaque ligne est traduite à part, les lignes vides sont gardées.
  if (text.includes('\n')) {
    let translated = false;
    const lines = text.split('\n').map((line) => {
      const result = line.trim() ? translateText(line, language) : line;
      if (result !== line) translated = true;
      return result;
    });
    return translated ? lines.join('\n') : text;
  }

  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return text;
  let translatedAny = false;
  const out = parts.map((part) => {
    const result = translateWhole(part, language);
    if (result === null) return part;
    translatedAny = true;
    return result;
  });
  return translatedAny ? out.join(' ') : text;
}

/** Message d'erreur HTTP : une phrase, ou la liste des erreurs de validation. Tout autre type est rendu tel quel. */
export function translateMessage<T>(message: T, language: AppLanguage): T {
  if (language === 'fr') return message;
  if (typeof message === 'string') return translateText(message, language) as unknown as T;
  if (Array.isArray(message)) return message.map((item) => (typeof item === 'string' ? translateText(item, language) : item)) as unknown as T;
  return message;
}

/** Réponse à structure libre (suivi public d'un colis…) : chaque texte est traduit, les nombres, dates et identifiants sont gardés. */
export function translateDeep<T>(value: T, language: AppLanguage): T {
  if (language === 'fr') return value;
  if (typeof value === 'string') return translateText(value, language) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => translateDeep(item, language)) as unknown as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, translateDeep(item, language)])) as T;
  }
  return value;
}
