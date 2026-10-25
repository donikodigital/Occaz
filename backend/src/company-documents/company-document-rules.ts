// backend/src/company-documents/company-document-rules.ts
// [25/10/2026] v1 — Règles pures des documents de l'entreprise (sans base de données ni réseau) : catégories, types de fichiers acceptés,
// taille, nom de fichier, visibilité et droit de modification.
//
// Visibilité : un document « réservé » (restricted) n'est vu que du SuperAdmin et de la personne qui l'a déposé. Les autres documents sont vus
// de tous ceux qui ont le droit de lecture. Modifier / supprimer : le SuperAdmin, ou la personne qui a déposé le document.
import { AccountType, Prisma } from '@prisma/client';

export const COMPANY_DOCUMENT_CATEGORIES = ['MEETING_MINUTES', 'LEGAL', 'CONTRACT', 'FINANCE', 'HR', 'INSURANCE', 'OTHER'] as const;
export type CompanyDocumentCategoryKey = (typeof COMPANY_DOCUMENT_CATEGORIES)[number];

/** Dossier du stockage : « company-document/<id du compte qui dépose>/<uuid>.<extension> ». */
export const COMPANY_DOCUMENT_FOLDER = 'company-document';

/** 25 Mo : largement assez pour un PV scanné ou un contrat, sans transformer le stockage en disque de sauvegarde. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Types acceptés (jamais de type libre venant du client) → extension du fichier dans le stockage. */
export const DOCUMENT_CONTENT_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type DocumentContentType = keyof typeof DOCUMENT_CONTENT_TYPES;

export const DOCUMENT_CONTENT_TYPE_LIST = Object.keys(DOCUMENT_CONTENT_TYPES) as DocumentContentType[];
export const DOCUMENT_EXTENSIONS: readonly string[] = [...new Set(Object.values(DOCUMENT_CONTENT_TYPES))];

/** Ces types s'ouvrent dans le navigateur ; les fichiers Office sont enregistrés. */
const INLINE_TYPES: ReadonlySet<string> = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export function opensInBrowser(contentType: string): boolean {
  return INLINE_TYPES.has(contentType);
}

/** Nom de fichier propre pour l'affichage : sans chemin, sans caractères de contrôle, espaces réduits, 150 caractères au plus (extension gardée). */
export function cleanFileName(name: string | null | undefined): string {
  const base = (name ?? '')
    .normalize('NFC')
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || base === '.' || base === '..') return 'document';
  if (base.length <= 150) return base;
  const dot = base.lastIndexOf('.');
  const extension = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : '';
  return `${base.slice(0, 150 - extension.length).trimEnd()}${extension}`;
}

/**
 * En-tête Content-Disposition d'un lien de lecture : nom lisible (UTF-8, RFC 5987) avec un repli ASCII pour les vieux navigateurs.
 * `inline` : ouvre dans le navigateur ; sinon : enregistre le fichier.
 */
export function contentDispositionFor(fileName: string, inline: boolean): string {
  const name = cleanFileName(fileName);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\%]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Le titre proposé quand la personne n'en saisit pas : le nom du fichier sans son extension. */
export function titleFromFileName(fileName: string): string {
  const name = cleanFileName(fileName);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 && name.length - dot <= 6 ? name.slice(0, dot) : name;
  return stem.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Document';
}

export interface DocumentViewer {
  id: string;
  accountType: AccountType;
}

export interface DocumentVisibility {
  restricted: boolean;
  uploadedById: string | null;
}

export function isSuperAdmin(viewer: DocumentViewer): boolean {
  return viewer.accountType === AccountType.SUPERADMIN;
}

export function canSeeCompanyDocument(viewer: DocumentViewer, document: DocumentVisibility): boolean {
  return !document.restricted || isSuperAdmin(viewer) || document.uploadedById === viewer.id;
}

export function canChangeCompanyDocument(viewer: DocumentViewer, document: DocumentVisibility): boolean {
  return isSuperAdmin(viewer) || document.uploadedById === viewer.id;
}

/** Filtre Prisma équivalent à canSeeCompanyDocument (pour les listes). */
export function visibleDocumentsWhere(viewer: DocumentViewer): Prisma.CompanyDocumentWhereInput {
  if (isSuperAdmin(viewer)) return {};
  return { OR: [{ restricted: false }, { uploadedById: viewer.id }] };
}

/** « 2026-10-12 » → Date (minuit UTC) ; null pour vide ; erreur de forme → undefined (l'appelant refuse). */
export function parseDocumentDate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Refuse les dates qui n'existent pas (31 février) : Date les « corrige » silencieusement.
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return undefined;
  return date;
}
