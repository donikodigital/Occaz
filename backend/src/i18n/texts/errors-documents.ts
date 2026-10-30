// backend/src/i18n/texts/errors-documents.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_DOCUMENTS: readonly TextRow[] = [
  ["Document introuvable.", "Document not found.", "Documento não encontrado."],
  ["Ce document a déjà été vérifié : il ne peut pas être supprimé. Pour le changer, envoyez-en un nouveau.", "This document has already been verified: it cannot be deleted. To change it, upload a new one.", "Este documento já foi verificado: não pode ser eliminado. Para o alterar, envie um novo."],
];
