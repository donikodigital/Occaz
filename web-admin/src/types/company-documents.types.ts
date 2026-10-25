// web-admin/src/types/company-documents.types.ts
// [25/10/2026] v1 — Documents de l'entreprise (miroir de backend/src/company-documents).
import type { Paginated } from '@/services/api/types';

export type CompanyDocumentCategory = 'MEETING_MINUTES' | 'LEGAL' | 'CONTRACT' | 'FINANCE' | 'HR' | 'INSURANCE' | 'OTHER';

export interface CompanyDocument {
  id: string;
  title: string;
  category: CompanyDocumentCategory;
  description: string | null;
  /** « 2026-10-12 » ou null. */
  documentDate: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Réservé : visible du seul SuperAdmin et de la personne qui l'a déposé. */
  restricted: boolean;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Peut le modifier ou le supprimer (SuperAdmin ou la personne qui l'a déposé). */
  canChange: boolean;
  /** Vrai pour un PDF ou une image : s'ouvre dans le navigateur ; sinon le fichier est enregistré. */
  opensInBrowser: boolean;
}

export type CompanyDocumentPage = Paginated<CompanyDocument>;

export interface CompanyDocumentStats {
  total: number;
  totalBytes: number;
  byCategory: Record<CompanyDocumentCategory, number>;
}

export interface DocumentUploadTicket {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  maxBytes: number;
}

/** Ce que la personne renseigne sur un document (à l'ajout comme à la modification). */
export interface CompanyDocumentFields {
  title: string;
  category: CompanyDocumentCategory;
  /** « 2026-10-12 » ou vide. */
  documentDate: string;
  description: string;
  restricted: boolean;
}

export interface DocumentLink {
  url: string;
  fileName: string;
  mode: 'open' | 'download';
  expiresInSeconds: number;
}
