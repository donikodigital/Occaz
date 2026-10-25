// web-admin/src/utils/companyDocuments.ts
// [25/10/2026] v1 — Libellés, couleurs, types de fichiers acceptés et petits formatages des documents de l'entreprise.
import type { Tone } from '@/components/admin/AdminUi';
import type { CompanyDocumentCategory } from '@/types/company-documents.types';

export const CATEGORY_ORDER: CompanyDocumentCategory[] = ['MEETING_MINUTES', 'LEGAL', 'CONTRACT', 'FINANCE', 'HR', 'INSURANCE', 'OTHER'];

export const CATEGORY_LABELS: Record<CompanyDocumentCategory, string> = {
  MEETING_MINUTES: 'PV de réunion',
  LEGAL: 'Statuts et juridique',
  CONTRACT: 'Contrats',
  FINANCE: 'Finance et fiscalité',
  HR: 'Ressources humaines',
  INSURANCE: 'Assurances',
  OTHER: 'Autres',
};

export const CATEGORY_HINTS: Record<CompanyDocumentCategory, string> = {
  MEETING_MINUTES: 'Procès-verbaux, comptes rendus, feuilles de présence',
  LEGAL: 'Statuts, immatriculation, attestations, autorisations',
  CONTRACT: 'Contrats, conventions, partenariats',
  FINANCE: 'Déclarations, relevés, factures importantes',
  HR: 'Contrats de travail, règlement intérieur',
  INSURANCE: 'Polices, attestations d’assurance',
  OTHER: 'Tout autre document important',
};

export const CATEGORY_TONES: Record<CompanyDocumentCategory, Tone> = {
  MEETING_MINUTES: 'primary',
  LEGAL: 'accent',
  CONTRACT: 'success',
  FINANCE: 'primary',
  HR: 'success',
  INSURANCE: 'accent',
  OTHER: 'neutral',
};

/** 25 Mo : la même limite que le serveur (qui la contrôle de nouveau après l'envoi). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Extension → type de fichier accepté (le navigateur ne renseigne pas toujours `file.type` pour Word ou Excel). */
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const ACCEPTED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION));

export const FILE_INPUT_ACCEPT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp'].join(',');
export const ACCEPTED_FORMATS_TEXT = 'PDF, Word, Excel, PowerPoint, JPG, PNG ou WebP — 25 Mo au plus';

/** Type de contenu à déclarer pour ce fichier, ou null s'il n'est pas accepté. L'extension prime : `file.type` est parfois vide ou générique. */
export function resolveContentType(file: { name: string; type: string }): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExtension = TYPE_BY_EXTENSION[extension];
  if (byExtension) return byExtension;
  return ACCEPTED_TYPES.has(file.type) ? file.type : null;
}

export type FileKind = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'other';

export function fileKindOf(contentType: string): FileKind {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.includes('word')) return 'word';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'excel';
  if (contentType.includes('powerpoint') || contentType.includes('presentation')) return 'powerpoint';
  if (contentType.startsWith('image/')) return 'image';
  return 'other';
}

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  image: 'Image',
  other: 'Fichier',
};

/** « 2,4 Mo », « 340 Ko », « 812 o » (formats français). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  const mega = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: mega < 10 ? 1 : 0 }).format(mega)} Mo`;
}

/** « 2026-10-12 » → « 12 octobre 2026 » (sans passer par un fuseau : le jour affiché est toujours celui saisi). */
export function formatDocumentDate(value: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDepositDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** Titre proposé à partir du nom du fichier : « PV_reunion_octobre.docx » → « PV reunion octobre ». */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 && fileName.length - dot <= 6 ? fileName.slice(0, dot) : fileName;
  return stem.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}
