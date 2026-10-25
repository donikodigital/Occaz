// web-admin/src/services/api/company-documents.api.ts
// [25/10/2026] v1 — Documents de l'entreprise.
//
// Envoi en trois temps (le fichier ne passe jamais par notre serveur) : 1) le serveur donne un lien d'envoi signé, 2) le navigateur envoie le
// fichier directement au stockage (R2/S3), 3) le navigateur confirme, et le serveur crée la fiche après avoir vérifié le fichier.
// L'étape 2 est une requête vers le domaine du stockage : le bucket doit autoriser ce site (réglage CORS, méthode PUT).
import { api } from './client';
import { ApiError } from './ApiError';
import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentFields,
  CompanyDocumentPage,
  CompanyDocumentStats,
  DocumentLink,
  DocumentUploadTicket,
} from '@/types/company-documents.types';

/** Les champs de la fiche tels que l'API les attend : date et description vides = « effacer ». */
function toPayload(fields: CompanyDocumentFields) {
  return {
    title: fields.title.trim(),
    category: fields.category,
    documentDate: fields.documentDate,
    description: fields.description.trim(),
    restricted: fields.restricted,
  };
}

/** Envoie le fichier au lien signé, avec la progression (0–100). */
function putFile(url: string, file: File, contentType: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new ApiError(`Le stockage a refusé le fichier (code ${request.status}). Réessaie.`, request.status));
    };
    request.onerror = () =>
      reject(
        new ApiError(
          "L'envoi vers le stockage a échoué. Vérifie ta connexion ; si cela persiste, le stockage doit autoriser ce site (réglage CORS du bucket).",
          0,
        ),
      );
    request.onabort = () => reject(new ApiError("L'envoi a été interrompu.", 0));
    request.timeout = 5 * 60_000;
    request.ontimeout = () => reject(new ApiError("L'envoi a pris trop de temps : réessaie avec une meilleure connexion.", 0));
    request.send(file);
  });
}

export const companyDocumentsApi = {
  list: (params: { page?: number; limit?: number; category?: CompanyDocumentCategory; search?: string }) =>
    api.get<CompanyDocumentPage>('/company-documents', { query: params }),

  stats: () => api.get<CompanyDocumentStats>('/company-documents/stats'),

  /** Les trois temps d'un ajout. `onProgress` : progression de l'envoi du fichier. */
  async upload(input: { file: File; contentType: string; fields: CompanyDocumentFields; onProgress: (percent: number) => void }): Promise<CompanyDocument> {
    const ticket = await api.post<DocumentUploadTicket>('/company-documents/upload-url', { contentType: input.contentType, sizeBytes: input.file.size });
    await putFile(ticket.uploadUrl, input.file, input.contentType, input.onProgress);
    return api.post<CompanyDocument>('/company-documents', {
      ...toPayload(input.fields),
      // À l'ajout, une date ou une description vide s'omet (rien à effacer).
      documentDate: input.fields.documentDate || undefined,
      description: input.fields.description.trim() || undefined,
      storageKey: ticket.storageKey,
      fileName: input.file.name,
      contentType: input.contentType,
    });
  },

  update: (id: string, fields: CompanyDocumentFields) => api.patch<CompanyDocument>(`/company-documents/${id}`, toPayload(fields)),

  remove: (id: string) => api.delete<{ deleted: true }>(`/company-documents/${id}`),

  link: (id: string, mode: 'open' | 'download') => api.get<DocumentLink>(`/company-documents/${id}/link`, { query: { mode } }),

  /**
   * Ouvre le document dans un nouvel onglet (PDF, images) ou l'enregistre. L'onglet est ouvert AVANT l'appel réseau : un onglet ouvert après une
   * attente est bloqué par les navigateurs. Si le navigateur le bloque quand même, on enregistre le fichier à la place.
   */
  async open(doc: Pick<CompanyDocument, 'id' | 'opensInBrowser'>, mode: 'open' | 'download'): Promise<void> {
    const wantsTab = mode === 'open' && doc.opensInBrowser;
    const tab = wantsTab ? window.open('about:blank', '_blank') : null;
    const effective: 'open' | 'download' = wantsTab && tab ? 'open' : 'download';
    try {
      const link = await companyDocumentsApi.link(doc.id, effective);
      if (tab && effective === 'open') {
        tab.location.href = link.url;
      } else {
        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch (error) {
      tab?.close();
      throw error;
    }
  },
};
